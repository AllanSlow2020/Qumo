import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, Person, Store } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { buildReceiptUrl } from "@/lib/stores/payload";
import { redeemReceipt } from "@/lib/stores/receipt";
import { isSlipEarnable, slipAward } from "@/lib/campaigns/slip-earning";
import { CampaignError, setCampaignStatusForSession } from "@/lib/campaigns/manage";

describe("a till slip earning a flat award", () => {
  const suffix = Date.now();

  let brand: Brand;
  let doorless: Brand;
  let store: Store;
  let shopper: Person;
  let card: Campaign;

  let txnCounter = 0;
  function slip(cents = 4500): string {
    txnCounter += 1;
    const url = buildReceiptUrl(
      "https://qumo.test",
      {
        storeCode: store.code,
        externalTxnId: `${suffix}-${txnCounter}`,
        amountCents: cents,
        purchasedAt: new Date(),
      },
      null,
    );
    return new URL(url).search.slice(1);
  }

  const owner = (brandId: string) => ({
    user: { id: `${brandId}-owner`, brandId, role: "OWNER", name: "Test Owner" },
  });

  async function stampBalance() {
    const membership = await prisma.brandMembership.findFirst({
      where: { brandId: brand.id, personId: shopper.id },
    });
    if (!membership) return 0;
    const totals = await prisma.pointsTransaction.aggregate({
      where: { brandMembershipId: membership.id, unit: "STAMPS" },
      _sum: { amount: true },
    });
    return totals._sum.amount ?? 0;
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Copper Kettle", slug: `slipflat-${suffix}` } });
    doorless = await prisma.brand.create({ data: { name: "Amber Oak", slug: `slipnodoor-${suffix}` } });

    store = await prisma.store.create({
      data: { brandId: brand.id, name: "Sea Point", code: `TILL-${suffix}` },
    });

    card = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Rounds card", status: "ACTIVE" },
    });
    await prisma.earnRule.create({
      data: {
        brandId: brand.id,
        campaignId: card.id,
        type: "FLAT_PER_SCAN",
        unit: "STAMPS",
        amount: 1,
        completesAt: 3,
      },
    });
    await prisma.reward.create({
      data: { brandId: brand.id, campaignId: card.id, rewardName: "A free coffee" },
    });

    shopper = await prisma.person.create({
      data: { phoneHash: `slipflat-${suffix}`, phoneEncrypted: "e" },
    });
  });

  afterAll(async () => {
    for (const b of [brand, doorless]) {
      await prisma.coupon.deleteMany({ where: { brandId: b.id } });
      await prisma.pointsTransaction.deleteMany({ where: { brandId: b.id } });
      await prisma.purchaseScan.deleteMany({ where: { brandId: b.id } });
      await prisma.reward.deleteMany({ where: { brandId: b.id } });
      await prisma.earnRule.deleteMany({ where: { brandId: b.id } });
      await prisma.brandMembership.deleteMany({ where: { brandId: b.id } });
      await prisma.campaign.deleteMany({ where: { brandId: b.id } });
      await prisma.store.deleteMany({ where: { brandId: b.id } });
      await prisma.auditEvent.deleteMany({ where: { brandId: b.id } });
      await prisma.brand.delete({ where: { id: b.id } });
    }
    await prisma.person.delete({ where: { id: shopper.id } });
  });

  it("gives one stamp for a slip, whatever the basket came to", async () => {
    // The whole point. Before this, the only lever that produced stamps
    // from a slip was a share of spend awarded in stamps, which multiplies
    // stamps by rands: a R45 basket at the form's own default awarded 225.
    const first = await redeemReceipt(slip(4500), shopper.id);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.unit).toBe("STAMPS");
    expect(first.awarded).toBe(1);

    const second = await redeemReceipt(slip(120_00), shopper.id);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.awarded).toBe(1);
  });

  it("completes the card from slips alone and issues a coupon", async () => {
    // Two scans so far, and the card finishes at three.
    expect(await stampBalance()).toBe(2);

    const third = await redeemReceipt(slip(3000), shopper.id);
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(third.coupon).not.toBeNull();
    expect(third.coupon?.name).toBe("A free coffee");

    // Completion is a deduction, not a reset.
    expect(await stampBalance()).toBe(0);
  });

  it("treats a flat rule worth nothing as no promotion, rather than burning the slip", async () => {
    await prisma.earnRule.update({ where: { campaignId: card.id }, data: { amount: 0 } });

    const result = await redeemReceipt(slip(5000), shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("NO_CAMPAIGN");

    await prisma.earnRule.update({ where: { campaignId: card.id }, data: { amount: 1 } });
  });

  it("refuses a second promotion a slip could also satisfy", async () => {
    const second = await prisma.campaign.create({
      data: { brandId: brand.id, name: "5% back", status: "PAUSED" },
    });
    await prisma.earnRule.create({
      data: {
        brandId: brand.id,
        campaignId: second.id,
        type: "PERCENT_OF_SPEND",
        unit: "CENTS",
        amount: 0,
        basisPoints: 500,
      },
    });

    // A slip carries a store and an amount and nothing that says which
    // promotion it belongs to, so two live ones make the same receipt
    // worth two different things.
    await expect(setCampaignStatusForSession(owner(brand.id), second.id, "ACTIVE")).rejects.toThrow(
      CampaignError,
    );

    await prisma.earnRule.deleteMany({ where: { campaignId: second.id } });
    await prisma.campaign.delete({ where: { id: second.id } });
  });

  it("allows two live promotions for a brand with no till printing codes", async () => {
    // A pack code carries its own campaign id, so there is no ambiguity to
    // protect against and the rule would just be a restriction.
    const made: Campaign[] = [];
    for (const name of ["Stickers A", "Stickers B"]) {
      const c = await prisma.campaign.create({
        data: { brandId: doorless.id, name, status: "PAUSED" },
      });
      await prisma.earnRule.create({
        data: { brandId: doorless.id, campaignId: c.id, type: "FLAT_PER_SCAN", unit: "CENTS", amount: 500 },
      });
      made.push(c);
    }

    for (const c of made) {
      await setCampaignStatusForSession(owner(doorless.id), c.id, "ACTIVE");
    }

    const live = await prisma.campaign.count({ where: { brandId: doorless.id, status: "ACTIVE" } });
    expect(live).toBe(2);
  });

  it("knows which rules a slip can satisfy, and what each is worth", () => {
    expect(isSlipEarnable({ type: "FLAT_PER_SCAN", amount: 1, basisPoints: null })).toBe(true);
    expect(isSlipEarnable({ type: "FLAT_PER_SCAN", amount: 0, basisPoints: null })).toBe(false);
    expect(isSlipEarnable({ type: "PERCENT_OF_SPEND", amount: 0, basisPoints: 500 })).toBe(true);
    expect(isSlipEarnable({ type: "PERCENT_OF_SPEND", amount: 0, basisPoints: null })).toBe(false);
    expect(isSlipEarnable(null)).toBe(false);

    // A flat rule has nothing to multiply, which is the entire fix.
    expect(slipAward({ type: "FLAT_PER_SCAN", amount: 1, basisPoints: null }, 120_00)).toBe(1);
    expect(slipAward({ type: "PERCENT_OF_SPEND", amount: 0, basisPoints: 500 }, 100_00)).toBe(500);
  });
});
