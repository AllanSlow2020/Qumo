import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, Person, Store } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { encryptSecret } from "@/lib/security/crypto";
import { generatePackCode } from "@/lib/packs/code";
import { redeemPackCode } from "@/lib/packs/scan";
import { buildReceiptUrl } from "@/lib/stores/payload";
import { redeemReceipt } from "@/lib/stores/receipt";
import { getWalletHistory } from "@/lib/consumer/wallet";

/**
 * Where a ledger row says it came from.
 *
 * The shopper-facing symptom was small — an activity list reading
 * "Purchase" four times where it should read "Sea Point", "Claremont",
 * "Sea Point", "Gardens" — but the cause was not: nothing in the ledger
 * recorded which scan produced a row, so the history could not be checked
 * against anybody's memory of their own week. These tests hold the link in
 * place from both ends: the write path attaches it, and the read path
 * surfaces it.
 */
describe("ledger provenance", () => {
  const suffix = Date.now();
  const SECRET = "b".repeat(64);
  // 5% of R400.00 is R20.00, and a card that completes at R15.00 means one
  // scan writes both rows — the award and the deduction — which is the
  // case the completion branch has to get right.
  const BASKET_CENTS = 40_000;
  const CARD_CENTS = 1_500;

  let brand: Brand;
  let spend: Campaign;
  let sleeve: Campaign;
  let store: Store;
  let shopper: Person;

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Provenance Co", slug: `provenance-${suffix}` } });

    spend = await prisma.campaign.create({
      data: { brandId: brand.id, name: "5% back", status: "ACTIVE" },
    });
    await prisma.reward.create({
      data: { brandId: brand.id, campaignId: spend.id, rewardName: "Free wings", couponName: "Free wings" },
    });
    await prisma.earnRule.create({
      data: {
        brandId: brand.id,
        campaignId: spend.id,
        type: "PERCENT_OF_SPEND",
        unit: "CENTS",
        amount: 0,
        basisPoints: 500,
        completesAt: CARD_CENTS,
      },
    });

    // The other earn path, which has no store behind it at all — the case
    // the null has to stay honest about.
    sleeve = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Wing box sleeve", status: "ACTIVE" },
    });
    await prisma.earnRule.create({
      data: { brandId: brand.id, campaignId: sleeve.id, type: "FLAT_PER_SCAN", unit: "POINTS", amount: 10 },
    });

    store = await prisma.store.create({
      data: {
        brandId: brand.id,
        name: "Sea Point",
        code: `PROV-${suffix}`,
        signingSecretEncrypted: encryptSecret(SECRET),
      },
    });

    shopper = await prisma.person.create({ data: { phoneHash: `prov-me-${suffix}`, phoneEncrypted: "x" } });
  });

  afterAll(async () => {
    await prisma.coupon.deleteMany({ where: { brandId: brand.id } });
    await prisma.pointsTransaction.deleteMany({ where: { brandId: brand.id } });
    await prisma.purchaseScan.deleteMany({ where: { brandId: brand.id } });
    await prisma.packCode.deleteMany({ where: { brandId: brand.id } });
    await prisma.packBatch.deleteMany({ where: { brandId: brand.id } });
    await prisma.store.deleteMany({ where: { brandId: brand.id } });
    await prisma.earnRule.deleteMany({ where: { brandId: brand.id } });
    await prisma.reward.deleteMany({ where: { brandId: brand.id } });
    await prisma.brandMembership.deleteMany({ where: { brandId: brand.id } });
    await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
    await prisma.person.delete({ where: { id: shopper.id } });
    await prisma.brand.delete({ where: { id: brand.id } });
  });

  function slip(): string {
    const url = buildReceiptUrl(
      "https://qumo.test",
      {
        storeCode: store.code,
        externalTxnId: `PROV-${suffix}`,
        amountCents: BASKET_CENTS,
        purchasedAt: new Date(),
      },
      SECRET,
    );
    return new URL(url).search.slice(1);
  }

  it("attaches the scan to every row that scan wrote", async () => {
    const result = await redeemReceipt(slip(), shopper.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The award completed the card, so there are two rows to check and not
    // one. A version that only tagged the award would pass a weaker test.
    expect(result.coupon).not.toBeNull();

    const scan = await prisma.purchaseScan.findFirstOrThrow({ where: { brandId: brand.id } });
    const rows = await prisma.pointsTransaction.findMany({
      where: { brandId: brand.id, campaignId: spend.id },
      orderBy: { amount: "desc" },
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.purchaseScanId)).toEqual([scan.id, scan.id]);
    // The deduction is the row a shopper would dispute, so it is the one
    // that most needs to say where it came from.
    expect(rows[1]?.reason).toBe("COUPON_UNLOCKED");
  });

  it("gives the wallet the store and the basket, not just a reason code", async () => {
    const history = await getWalletHistory(shopper.id, 50, brand.id);
    const earned = history.find((e) => e.reason === "PURCHASE_ACCRUAL");

    expect(earned?.storeName).toBe("Sea Point");
    expect(earned?.amountCents).toBe(BASKET_CENTS);
    expect(earned?.campaignName).toBe("5% back");
  });

  it("leaves the store null for an earn path that has no store", async () => {
    const code = generatePackCode();
    const batch = await prisma.packBatch.create({
      data: { brandId: brand.id, campaignId: sleeve.id, label: `prov-${suffix}`, quantity: 1 },
    });
    await prisma.packCode.create({ data: { brandId: brand.id, campaignId: sleeve.id, batchId: batch.id, code } });
    expect((await redeemPackCode(code, shopper.id)).ok).toBe(true);

    const history = await getWalletHistory(shopper.id, 50, brand.id);
    const scanned = history.find((e) => e.reason === "PACK_SCAN_AWARDED");

    // Null rather than invented. A sleeve code was not bought anywhere we
    // know of, and the wallet falls back to the promotion's name for it.
    expect(scanned?.storeName).toBeNull();
    expect(scanned?.amountCents).toBeNull();
    expect(scanned?.campaignName).toBe("Wing box sleeve");
  });
});
