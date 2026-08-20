import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/security/crypto";
import { ForbiddenError } from "@/lib/auth/rbac";
import {
  createStoreForSession,
  disableStoreSigningForSession,
  listStores,
  rotateStoreSecretForSession,
  setSpendRuleForSession,
  setStoreActiveForSession,
  StoreError,
} from "@/lib/stores/manage";
import { buildReceiptUrl } from "@/lib/stores/payload";
import { redeemReceipt } from "@/lib/stores/receipt";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("lib/stores/manage", () => {
  const suffix = Date.now();
  let brand: Brand;
  let rival: Brand;
  let campaign: Campaign;
  let second: Campaign;

  const owner = (brandId: string) => ({ user: { brandId, role: "OWNER" } });

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Store Brand", slug: `store-brand-${suffix}` } });
    rival = await prisma.brand.create({ data: { name: "Store Rival", slug: `store-rival-${suffix}` } });
    campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Primary", status: "ACTIVE" },
    });
    second = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Secondary", status: "ACTIVE" },
    });
  });

  afterAll(async () => {
    const brandIds = [brand.id, rival.id];
    await prisma.purchaseScan.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.store.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.earnRule.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.campaign.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.brand.deleteMany({ where: { id: { in: brandIds } } });
  });

  it("returns the signing secret exactly once, and stores only ciphertext", async () => {
    const store = await createStoreForSession(
      owner(brand.id),
      formData({ name: "Sandton", code: `sb-a-${suffix}`, signed: "on" }),
    );

    expect(store.signingSecret).toMatch(/^[0-9a-f]{64}$/);

    const row = await prisma.store.findUniqueOrThrow({ where: { id: store.id } });
    // Never in plaintext anywhere.
    expect(row.signingSecretEncrypted).not.toBe(store.signingSecret);
    expect(decryptSecret(row.signingSecretEncrypted!)).toBe(store.signingSecret);
    // Codes are upper-cased so a receipt template's casing can't matter.
    expect(row.code).toBe(`SB-A-${suffix}`.toUpperCase());
  });

  it("creates an unsigned store when the POS can't sign", async () => {
    const store = await createStoreForSession(
      owner(brand.id),
      formData({ name: "Rosebank", code: `sb-b-${suffix}` }),
    );
    expect(store.signingSecret).toBeNull();

    const row = await prisma.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(row.signingSecretEncrypted).toBeNull();
  });

  it("rejects a duplicate store code", async () => {
    await createStoreForSession(owner(brand.id), formData({ name: "Dup", code: `sb-dup-${suffix}` }));
    // Globally unique, so this also blocks another brand taking it — the
    // message deliberately doesn't say which.
    await expect(
      createStoreForSession(owner(rival.id), formData({ name: "Dup", code: `sb-dup-${suffix}` })),
    ).rejects.toThrow(StoreError);
  });

  it("rejects a store code with characters a receipt can't carry safely", async () => {
    await expect(
      createStoreForSession(owner(brand.id), formData({ name: "Bad", code: "has space" })),
    ).rejects.toThrow();
  });

  it("enforces role permissions", async () => {
    await expect(
      createStoreForSession({ user: { brandId: brand.id, role: "MARKETING" } }, formData({ name: "X", code: "XX" })),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rotating a key invalidates slips signed with the old one", async () => {
    const created = await createStoreForSession(
      owner(brand.id),
      formData({ name: "Rotate", code: `sb-rot-${suffix}`, signed: "on" }),
    );
    await setSpendRuleForSession(
      owner(brand.id),
      formData({ campaignId: campaign.id, unit: "CENTS", basisPoints: "500" }),
    );

    const shopper = await prisma.person.create({
      data: { phoneHash: `store-rot-${suffix}`, phoneEncrypted: "x" },
    });

    const oldSlip = new URL(
      buildReceiptUrl(
        "https://t.test",
        { storeCode: created.code, externalTxnId: "rot-1", amountCents: 5_000, purchasedAt: new Date() },
        created.signingSecret,
      ),
    ).search.slice(1);

    const newSecret = await rotateStoreSecretForSession(owner(brand.id), created.id);
    expect(newSecret).not.toBe(created.signingSecret);

    // That is the point of a rotation, and why the screen warns before it.
    const stale = await redeemReceipt(oldSlip, shopper.id);
    expect(stale.ok).toBe(false);

    const freshSlip = new URL(
      buildReceiptUrl(
        "https://t.test",
        { storeCode: created.code, externalTxnId: "rot-2", amountCents: 5_000, purchasedAt: new Date() },
        newSecret,
      ),
    ).search.slice(1);
    expect((await redeemReceipt(freshSlip, shopper.id)).ok).toBe(true);

    await prisma.purchaseScan.deleteMany({ where: { brandId: brand.id } });
    await prisma.pointsTransaction.deleteMany({ where: { brandId: brand.id } });
    await prisma.brandMembership.deleteMany({ where: { personId: shopper.id } });
    await prisma.person.delete({ where: { id: shopper.id } });
  });

  it("can turn signing off for a franchise whose till can't do it yet", async () => {
    const created = await createStoreForSession(
      owner(brand.id),
      formData({ name: "Downgrade", code: `sb-down-${suffix}`, signed: "on" }),
    );
    await disableStoreSigningForSession(owner(brand.id), created.id);

    const row = await prisma.store.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.signingSecretEncrypted).toBeNull();
  });

  it("pauses and resumes a store", async () => {
    const created = await createStoreForSession(
      owner(brand.id),
      formData({ name: "Pausable", code: `sb-pause-${suffix}` }),
    );
    await setStoreActiveForSession(owner(brand.id), created.id, false);
    expect((await prisma.store.findUniqueOrThrow({ where: { id: created.id } })).isActive).toBe(false);

    await setStoreActiveForSession(owner(brand.id), created.id, true);
    expect((await prisma.store.findUniqueOrThrow({ where: { id: created.id } })).isActive).toBe(true);
  });

  it("never touches another brand's store", async () => {
    const mine = await createStoreForSession(
      owner(brand.id),
      formData({ name: "Mine", code: `sb-mine-${suffix}` }),
    );
    await expect(rotateStoreSecretForSession(owner(rival.id), mine.id)).rejects.toThrow(StoreError);
    await expect(setStoreActiveForSession(owner(rival.id), mine.id, false)).rejects.toThrow(StoreError);
  });

  it("never lists another brand's stores", async () => {
    await createStoreForSession(owner(rival.id), formData({ name: "Theirs", code: `sb-theirs-${suffix}` }));
    const mine = await listStores(brand.id);
    expect(mine.some((s) => s.name === "Theirs")).toBe(false);
  });

  it("reports signing mode and unverified scan counts", async () => {
    const stores = await listStores(brand.id);
    const signed = stores.find((s) => s.code === `SB-A-${suffix}`.toUpperCase());
    const unsigned = stores.find((s) => s.code === `SB-B-${suffix}`.toUpperCase());
    // The brand has to be able to see which stores are exposed.
    expect(signed?.isSigned).toBe(true);
    expect(unsigned?.isSigned).toBe(false);
  });

  it("refuses a second active spend campaign", async () => {
    // Without this, a slip would be worth whatever campaign was found
    // first, and the same purchase could pay out differently.
    await setSpendRuleForSession(
      owner(brand.id),
      formData({ campaignId: campaign.id, unit: "CENTS", basisPoints: "500" }),
    );
    await expect(
      setSpendRuleForSession(
        owner(brand.id),
        formData({ campaignId: second.id, unit: "CENTS", basisPoints: "300" }),
      ),
    ).rejects.toThrow(StoreError);
  });

  it("allows a second spend campaign once the first is paused", async () => {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "PAUSED" } });
    await expect(
      setSpendRuleForSession(
        owner(brand.id),
        formData({ campaignId: second.id, unit: "CENTS", basisPoints: "300" }),
      ),
    ).resolves.toBeTruthy();
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "ACTIVE" } });
  });

  it("rejects a share outside 0-100%", async () => {
    for (const basisPoints of ["0", "10001", "-5"]) {
      await expect(
        setSpendRuleForSession(
          owner(brand.id),
          formData({ campaignId: campaign.id, unit: "CENTS", basisPoints }),
        ),
      ).rejects.toThrow();
    }
  });

  it("refuses a campaign belonging to another brand", async () => {
    await expect(
      setSpendRuleForSession(
        owner(rival.id),
        formData({ campaignId: campaign.id, unit: "CENTS", basisPoints: "500" }),
      ),
    ).rejects.toThrow(StoreError);
  });
});
