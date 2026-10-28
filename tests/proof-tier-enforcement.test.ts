import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, Person, Store } from "@prisma/client";
import type { ProofTier } from "@/lib/proof/tier";
import { prisma } from "@/lib/db/client";
import { encryptSecret } from "@/lib/security/crypto";
import { buildReceiptUrl } from "@/lib/stores/payload";
import { redeemReceipt } from "@/lib/stores/receipt";

describe("how much proof a promotion insists on", () => {
  const suffix = `tier-${Date.now()}`;
  const SECRET = "b".repeat(64);

  let brand: Brand;
  let campaign: Campaign;
  let signedStore: Store;
  let unsignedStore: Store;
  let shopper: Person;

  let n = 0;
  const txn = () => `${suffix}-${(n += 1)}`;

  const slip = (store: Store, opts: { txn?: string } = {}) =>
    new URL(
      buildReceiptUrl(
        "https://qumo.test",
        {
          storeCode: store.code,
          externalTxnId: opts.txn ?? txn(),
          amountCents: 8500,
          purchasedAt: new Date(),
        },
        store.signingSecretEncrypted ? SECRET : null,
      ),
    ).search.slice(1);

  const setFloor = (floor: ProofTier) =>
    prisma.earnRule.update({ where: { campaignId: campaign.id }, data: { minProofTier: floor } });

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Tiered", slug: suffix } });
    campaign = await prisma.campaign.create({
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
    // Upper case, because parseReceiptPayload upper-cases the store code
    // it reads off the slip and the lookup is exact. A lower-case fixture
    // simply never finds its own store.
    signedStore = await prisma.store.create({
      data: {
        brandId: brand.id,
        name: "Signed",
        code: `S-${suffix}`.toUpperCase(),
        signingSecretEncrypted: encryptSecret(SECRET),
      },
    });
    unsignedStore = await prisma.store.create({
      data: { brandId: brand.id, name: "Unsigned", code: `U-${suffix}`.toUpperCase() },
    });
    shopper = await prisma.person.create({
      data: { phoneHash: `h-${suffix}`, phoneEncrypted: `e-${suffix}` },
    });
  });

  afterAll(async () => {
    await prisma.pointsTransaction.deleteMany({ where: { brandId: brand.id } });
    await prisma.purchaseScan.deleteMany({ where: { brandId: brand.id } });
    await prisma.brandMembership.deleteMany({ where: { brandId: brand.id } });
    await prisma.earnRule.deleteMany({ where: { brandId: brand.id } });
    await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
    await prisma.store.deleteMany({ where: { brandId: brand.id } });
    await prisma.brand.delete({ where: { id: brand.id } });
    await prisma.person.delete({ where: { id: shopper.id } });
  });

  it("defaults to the floor that matches what the code already did", async () => {
    // An unsigned store earned before this column existed. The default has
    // to keep that true, or adding the column silently switches off every
    // unsigned store on the platform.
    const rule = await prisma.earnRule.findUnique({ where: { campaignId: campaign.id } });
    expect(rule?.minProofTier).toBe("UNSIGNED");

    const result = await redeemReceipt(slip(unsignedStore), shopper.id);
    expect(result.ok).toBe(true);
  });

  it("records what each scan actually proved, not what the store can do today", async () => {
    const t1 = txn();
    await redeemReceipt(slip(signedStore, { txn: t1 }), shopper.id);
    const signed = await prisma.purchaseScan.findFirst({ where: { externalTxnId: t1 } });
    expect(signed?.proofTier).toBe("SIGNED");

    const t2 = txn();
    await redeemReceipt(slip(unsignedStore, { txn: t2 }), shopper.id);
    const unsigned = await prisma.purchaseScan.findFirst({ where: { externalTxnId: t2 } });
    expect(unsigned?.proofTier).toBe("UNSIGNED");
  });

  it("keeps the old boolean in step with the new column", async () => {
    // Both are written from one decision. If they ever disagree, every
    // report built on wasSigned starts telling a different story from the
    // one built on proofTier.
    const scans = await prisma.purchaseScan.findMany({ where: { brandId: brand.id } });
    expect(scans.length).toBeGreaterThan(0);
    for (const scan of scans) {
      expect(scan.wasSigned).toBe(scan.proofTier === "SIGNED");
    }
  });

  it("does not re-grade an old scan when the store starts signing later", async () => {
    // The property the per-scan column exists for, and the one the
    // migration's backfill protects. A store that gains a signing secret
    // in November must not turn October's unsigned scans into signed ones,
    // because a fraud investigation asks what was true at the time.
    const later = await prisma.store.create({
      data: { brandId: brand.id, name: "Later", code: `L-${suffix}`.toUpperCase() },
    });
    const t = txn();
    await redeemReceipt(slip(later, { txn: t }), shopper.id);
    expect((await prisma.purchaseScan.findFirst({ where: { externalTxnId: t } }))?.proofTier).toBe("UNSIGNED");

    await prisma.store.update({
      where: { id: later.id },
      data: { signingSecretEncrypted: encryptSecret(SECRET) },
    });

    const after = await prisma.purchaseScan.findFirst({ where: { externalTxnId: t } });
    expect(after?.proofTier).toBe("UNSIGNED");
    expect(after?.wasSigned).toBe(false);
  });

  it("refuses a slip that proved less than the promotion asks for", async () => {
    await setFloor("SIGNED");
    const result = await redeemReceipt(slip(unsignedStore), shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("PROOF_TOO_WEAK");
    // Carried out so the shopper can be told what this promotion does take.
    expect(result.wanted).toBe("SIGNED");
  });

  it("awards nothing at all when it refuses on proof", async () => {
    await setFloor("SIGNED");
    const before = await prisma.pointsTransaction.count({ where: { brandId: brand.id } });
    const t = txn();
    await redeemReceipt(slip(unsignedStore, { txn: t }), shopper.id);
    expect(await prisma.pointsTransaction.count({ where: { brandId: brand.id } })).toBe(before);
    // And it does not burn the slip number either, so the shopper can
    // still use the same slip if the brand lowers the floor.
    expect(await prisma.purchaseScan.findFirst({ where: { externalTxnId: t } })).toBeNull();
  });

  it("still accepts stronger proof than it asked for", async () => {
    await setFloor("SIGNED");
    expect((await redeemReceipt(slip(signedStore), shopper.id)).ok).toBe(true);

    await setFloor("PHOTO");
    expect((await redeemReceipt(slip(signedStore), shopper.id)).ok).toBe(true);
    expect((await redeemReceipt(slip(unsignedStore), shopper.id)).ok).toBe(true);
  });
});
