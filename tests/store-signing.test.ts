import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Person } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ForbiddenError } from "@/lib/auth/rbac";
import { encryptPhone, hashPhone } from "@/lib/security/crypto";
import { buildReceiptUrl } from "@/lib/stores/payload";
import { redeemReceipt } from "@/lib/stores/receipt";
import {
  StoreError,
  createStoreForSession,
  disableStoreSigningForSession,
  listStores,
  rotateStoreSecretForSession,
  setStoreActiveForSession,
} from "@/lib/stores/manage";

/**
 * Managing a store's signing secret from the console.
 *
 * The engine functions existed and were tested for tenancy; what was never
 * asserted is the thing a brand actually experiences when they press the
 * button — that a rotation makes new slips work and old ones stop.
 */
describe("issuing and rotating a store's signing secret", () => {
  const suffix = Date.now();

  let brand: Brand;
  let otherBrand: Brand;
  let shopper: Person;

  const owner = (brandId: string) => ({ user: { id: `${brandId}-owner`, brandId, role: "OWNER", name: "Test Owner" } });
  const marketing = (brandId: string) => ({ user: { id: `${brandId}-marketing`, brandId, role: "MARKETING", name: "Test Marketing" } });

  function form(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  let txn = 0;
  /** A slip as a till would print it, signed with whatever secret is passed. */
  function slip(storeCode: string, secret: string | null, amountCents = 10_000): string {
    txn += 1;
    const url = buildReceiptUrl(
      "https://qumo.test",
      {
        storeCode,
        externalTxnId: `sign-${suffix}-${txn}`,
        amountCents,
        purchasedAt: new Date(),
      },
      secret,
    );
    return new URL(url).search.slice(1);
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Licken", slug: `sign-a-${suffix}` } });
    otherBrand = await prisma.brand.create({ data: { name: "Campari", slug: `sign-b-${suffix}` } });

    const campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "5% back", status: "ACTIVE" },
    });
    await prisma.earnRule.create({
      data: {
        brandId: brand.id,
        campaignId: campaign.id,
        type: "PERCENT_OF_SPEND",
        unit: "CENTS",
        amount: 0,
        basisPoints: 500,
      },
    });

    const phone = `+2785${String(suffix).slice(-7)}`;
    shopper = await prisma.person.create({
      data: { phoneHash: hashPhone(phone), phoneEncrypted: encryptPhone(phone), firstName: "Allan" },
    });
  });

  afterAll(async () => {
    for (const b of [brand, otherBrand]) {
      await prisma.pointsTransaction.deleteMany({ where: { brandId: b.id } });
      await prisma.purchaseScan.deleteMany({ where: { brandId: b.id } });
      await prisma.brandMembership.deleteMany({ where: { brandId: b.id } });
      await prisma.store.deleteMany({ where: { brandId: b.id } });
      await prisma.earnRule.deleteMany({ where: { brandId: b.id } });
      await prisma.campaign.deleteMany({ where: { brandId: b.id } });
      await prisma.brand.delete({ where: { id: b.id } });
    }
    await prisma.person.delete({ where: { id: shopper.id } });
  });

  it("hands back the secret once, and only the ciphertext is stored", async () => {
    const created = await createStoreForSession(
      owner(brand.id),
      form({ name: "Sandton", code: `SGN-${suffix}-A`, signed: "on" }),
    );

    expect(created.signingSecret).toMatch(/^[0-9a-f]{64}$/);

    const row = await prisma.store.findUniqueOrThrow({ where: { id: created.id } });
    // A database dump must not be a set of usable signing keys.
    expect(row.signingSecretEncrypted).not.toBeNull();
    expect(row.signingSecretEncrypted).not.toContain(created.signingSecret!);
  });

  it("signs a slip that then verifies, and refuses one signed with anything else", async () => {
    const created = await createStoreForSession(
      owner(brand.id),
      form({ name: "Rosebank", code: `SGN-${suffix}-B`, signed: "on" }),
    );
    const secret = created.signingSecret!;

    const good = await redeemReceipt(slip(created.code, secret), shopper.id, new Date(), brand.id);
    expect(good.ok).toBe(true);

    const forged = await redeemReceipt(
      slip(created.code, "0".repeat(64)),
      shopper.id,
      new Date(),
      brand.id,
    );
    expect(forged).toEqual({ ok: false, reason: "BAD_SIGNATURE" });

    // And an unsigned slip at a signed store is refused outright rather than
    // quietly downgraded — otherwise turning signing on would achieve
    // nothing at all.
    const unsigned = await redeemReceipt(slip(created.code, null), shopper.id, new Date(), brand.id);
    expect(unsigned).toEqual({ ok: false, reason: "SIGNATURE_REQUIRED" });
  });

  it("rotation makes new slips work and old ones stop", async () => {
    // The consequence the console warns about before anyone clicks, asserted
    // rather than assumed. A slip in a shopper's pocket, signed minutes ago,
    // stops verifying — which is the point of a rotation and also the reason
    // it is not a routine thing to do at lunchtime.
    const created = await createStoreForSession(
      owner(brand.id),
      form({ name: "Menlyn", code: `SGN-${suffix}-C`, signed: "on" }),
    );
    const oldSecret = created.signingSecret!;
    const inFlight = slip(created.code, oldSecret);

    const newSecret = await rotateStoreSecretForSession(owner(brand.id), created.id);
    expect(newSecret).not.toBe(oldSecret);

    expect(await redeemReceipt(inFlight, shopper.id, new Date(), brand.id)).toEqual({
      ok: false,
      reason: "BAD_SIGNATURE",
    });
    expect((await redeemReceipt(slip(created.code, newSecret), shopper.id, new Date(), brand.id)).ok).toBe(true);
  });

  it("turns signing on for a store created without it", async () => {
    // The path a brand takes when their POS vendor comes back and says yes
    // after all.
    const created = await createStoreForSession(
      owner(brand.id),
      form({ name: "Fourways", code: `SGN-${suffix}-D`, signed: "" }),
    );
    expect(created.signingSecret).toBeNull();
    expect((await redeemReceipt(slip(created.code, null), shopper.id, new Date(), brand.id)).ok).toBe(true);

    const secret = await rotateStoreSecretForSession(owner(brand.id), created.id);
    // Now an unsigned slip from that till is no longer good enough.
    expect(await redeemReceipt(slip(created.code, null), shopper.id, new Date(), brand.id)).toEqual({
      ok: false,
      reason: "SIGNATURE_REQUIRED",
    });
    expect((await redeemReceipt(slip(created.code, secret), shopper.id, new Date(), brand.id)).ok).toBe(true);
  });

  it("turns signing off again, and says so on the list", async () => {
    const created = await createStoreForSession(
      owner(brand.id),
      form({ name: "Centurion", code: `SGN-${suffix}-E`, signed: "on" }),
    );
    await disableStoreSigningForSession(owner(brand.id), created.id);

    const listed = (await listStores(brand.id)).find((s) => s.id === created.id);
    expect(listed?.isSigned).toBe(false);
    expect((await redeemReceipt(slip(created.code, null), shopper.id, new Date(), brand.id)).ok).toBe(true);
  });

  it("stops accepting slips when a store is switched off", async () => {
    const created = await createStoreForSession(
      owner(brand.id),
      form({ name: "Closed", code: `SGN-${suffix}-F`, signed: "on" }),
    );
    await setStoreActiveForSession(owner(brand.id), created.id, false);

    expect(await redeemReceipt(slip(created.code, created.signingSecret), shopper.id, new Date(), brand.id)).toEqual({
      ok: false,
      reason: "STORE_INACTIVE",
    });
  });

  it("refuses a role that isn't allowed to manage stores", async () => {
    // Hiding the button is courtesy; this is the access control.
    await expect(
      createStoreForSession(marketing(brand.id), form({ name: "Nope", code: `SGN-${suffix}-G`, signed: "on" })),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses to touch another brand's store", async () => {
    const created = await createStoreForSession(
      owner(brand.id),
      form({ name: "Ours", code: `SGN-${suffix}-H`, signed: "on" }),
    );
    // Same id, wrong brand: the scoped query simply does not find it, so it
    // reads as "doesn't exist" rather than "not yours" — which is also the
    // right thing to tell somebody probing for other brands' store ids.
    await expect(rotateStoreSecretForSession(owner(otherBrand.id), created.id)).rejects.toThrow(StoreError);

    // And the secret is untouched.
    const still = await prisma.store.findUniqueOrThrow({ where: { id: created.id } });
    expect(still.signingSecretEncrypted).not.toBeNull();
  });

  it("refuses a duplicate store code without saying whose it is", async () => {
    await createStoreForSession(owner(brand.id), form({ name: "First", code: `SGN-${suffix}-DUP`, signed: "on" }));
    // Codes are globally unique because a scanned slip carries nothing else,
    // so a clash can be with another brand's store — and the message must
    // not confirm that another brand has taken it.
    await expect(
      createStoreForSession(owner(otherBrand.id), form({ name: "Second", code: `SGN-${suffix}-DUP`, signed: "on" })),
    ).rejects.toThrow(StoreError);
  });
});
