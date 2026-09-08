import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, Person, Reward } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { generatePackCode } from "@/lib/packs/code";
import { redeemPackCode } from "@/lib/packs/scan";

/**
 * "Buy 10, get the 10th free" - the stamp card, which is the same ledger
 * as everything else with a threshold on it.
 */
describe("stamp card completion", () => {
  const suffix = Date.now();
  let brand: Brand;
  let campaign: Campaign;
  let reward: Reward;
  let shopper: Person;

  const CARD_SIZE = 3;

  async function scanOnce(personId: string, campaignId = campaign.id) {
    const code = generatePackCode();
    const batch = await prisma.packBatch.create({
      data: { brandId: brand.id, campaignId, label: `stamp-${code.slice(0, 4)}`, quantity: 1 },
    });
    await prisma.packCode.create({ data: { brandId: brand.id, campaignId, batchId: batch.id, code } });
    return redeemPackCode(code, personId);
  }

  async function stampBalance(personId: string) {
    const membership = await prisma.brandMembership.findFirstOrThrow({
      where: { brandId: brand.id, personId },
    });
    const totals = await prisma.pointsTransaction.aggregate({
      where: { brandMembershipId: membership.id, unit: "STAMPS" },
      _sum: { amount: true },
    });
    return totals._sum.amount ?? 0;
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Coffee Co", slug: `stamp-${suffix}` } });
    campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Coffee Card", status: "ACTIVE" },
    });
    reward = await prisma.reward.create({
      data: {
        brandId: brand.id,
        campaignId: campaign.id,
        rewardName: "Free coffee",
        couponName: "Free coffee",
        codePrefix: "CC",
      },
    });
    await prisma.earnRule.create({
      data: {
        brandId: brand.id,
        campaignId: campaign.id,
        type: "FLAT_PER_SCAN",
        unit: "STAMPS",
        amount: 1,
        completesAt: CARD_SIZE,
      },
    });
    shopper = await prisma.person.create({ data: { phoneHash: `stamp-me-${suffix}`, phoneEncrypted: "x" } });
  });

  afterAll(async () => {
    await prisma.coupon.deleteMany({ where: { brandId: brand.id } });
    await prisma.pointsTransaction.deleteMany({ where: { brandId: brand.id } });
    await prisma.packCode.deleteMany({ where: { brandId: brand.id } });
    await prisma.packBatch.deleteMany({ where: { brandId: brand.id } });
    await prisma.earnRule.deleteMany({ where: { brandId: brand.id } });
    await prisma.reward.deleteMany({ where: { brandId: brand.id } });
    await prisma.brandMembership.deleteMany({ where: { brandId: brand.id } });
    await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
    await prisma.person.deleteMany({ where: { phoneHash: { startsWith: "stamp-" } } });
    await prisma.brand.delete({ where: { id: brand.id } });
  });

  it("issues no coupon before the card is full", async () => {
    for (let i = 0; i < CARD_SIZE - 1; i += 1) {
      const result = await scanOnce(shopper.id);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.coupon).toBeNull();
      expect(result.newBalance).toBe(i + 1);
    }
  });

  it("issues a coupon and deducts the card when the last stamp lands", async () => {
    const result = await scanOnce(shopper.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.coupon).not.toBeNull();
    expect(result.coupon?.name).toBe("Free coffee");
    // The brand's code prefix is honoured, same as any other coupon.
    expect(result.coupon?.code.startsWith("CC-")).toBe(true);

    // Deducted as a ledger row, not reset - so balance is still a pure sum.
    expect(result.newBalance).toBe(0);
    expect(await stampBalance(shopper.id)).toBe(0);

    const deduction = await prisma.pointsTransaction.findFirst({
      where: { brandId: brand.id, reason: "COUPON_UNLOCKED", unit: "STAMPS" },
    });
    expect(deduction?.amount).toBe(-CARD_SIZE);
  });

  it("issues a real coupon row the brand can redeem", async () => {
    const coupon = await prisma.coupon.findFirstOrThrow({ where: { brandId: brand.id } });
    expect(coupon.status).toBe("ISSUED");
    expect(coupon.rewardId).toBe(reward.id);
    expect(coupon.campaignId).toBe(campaign.id);
  });

  it("starts the next card from zero and completes it again", async () => {
    for (let i = 0; i < CARD_SIZE - 1; i += 1) {
      const result = await scanOnce(shopper.id);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.coupon).toBeNull();
    }
    const completing = await scanOnce(shopper.id);
    expect(completing.ok).toBe(true);
    if (!completing.ok) return;
    expect(completing.coupon).not.toBeNull();

    expect(await prisma.coupon.count({ where: { brandId: brand.id } })).toBe(2);
  });

  it("respects the reward's coupon budget", async () => {
    // maxCoupons is the brand's liability cap - crossing the threshold must
    // not issue past it, even though the stamps were legitimately earned.
    await prisma.reward.update({ where: { id: reward.id }, data: { maxCoupons: 2 } });

    for (let i = 0; i < CARD_SIZE; i += 1) {
      await scanOnce(shopper.id);
    }

    expect(await prisma.coupon.count({ where: { brandId: brand.id } })).toBe(2);
    // The stamps stay on the balance rather than vanishing - the shopper
    // earned them, and the brand can raise the cap later.
    expect(await stampBalance(shopper.id)).toBe(CARD_SIZE);

    await prisma.reward.update({ where: { id: reward.id }, data: { maxCoupons: null } });
  });

  it("completes only one card per scan, carrying the surplus forward", async () => {
    const bigCampaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Big award", status: "ACTIVE" },
    });
    await prisma.reward.create({
      data: {
        brandId: brand.id,
        campaignId: bigCampaign.id,
        rewardName: "Bulk",
        couponName: "Bulk",
      },
    });
    await prisma.earnRule.create({
      data: {
        brandId: brand.id,
        campaignId: bigCampaign.id,
        type: "FLAT_PER_SCAN",
        unit: "STAMPS",
        amount: 5,
        completesAt: 2,
      },
    });

    const fresh = await prisma.person.create({
      data: { phoneHash: `stamp-bulk-${suffix}`, phoneEncrypted: "x" },
    });
    const result = await scanOnce(fresh.id, bigCampaign.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 5 stamps, a 2-stamp card: one coupon, 3 left toward the next.
    expect(result.coupon).not.toBeNull();
    expect(result.newBalance).toBe(3);
  });

  it("does not complete anything for a campaign with no threshold", async () => {
    const plain = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Points only", status: "ACTIVE" },
    });
    await prisma.earnRule.create({
      data: { brandId: brand.id, campaignId: plain.id, type: "FLAT_PER_SCAN", unit: "POINTS", amount: 500 },
    });

    const fresh = await prisma.person.create({
      data: { phoneHash: `stamp-plain-${suffix}`, phoneEncrypted: "x" },
    });
    const result = await scanOnce(fresh.id, plain.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.coupon).toBeNull();
    expect(result.newBalance).toBe(500);
  });
});
