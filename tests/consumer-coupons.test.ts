import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, Person, Reward } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { listShopperCoupons } from "@/lib/consumer/coupons";

describe("the rewards a shopper is holding", () => {
  const suffix = Date.now();

  let brand: Brand;
  let otherBrand: Brand;
  let person: Person;
  let stranger: Person;
  let campaign: Campaign;
  let reward: Reward;
  let membershipId: string;
  let strangerMembershipId: string;
  let otherMembershipId: string;
  let otherRewardId: string;
  let otherCampaignId: string;

  async function makeCoupon(code: string, data: Record<string, unknown> = {}) {
    return prisma.coupon.create({
      data: {
        brandId: brand.id,
        campaignId: campaign.id,
        rewardId: reward.id,
        brandMembershipId: membershipId,
        code,
        ...data,
      },
    });
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Copper Kettle", slug: `wc-a-${suffix}` } });
    otherBrand = await prisma.brand.create({ data: { name: "Amber Oak", slug: `wc-b-${suffix}` } });

    campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: `Rounds ${suffix}`, status: "ACTIVE" },
    });
    reward = await prisma.reward.create({
      data: {
        brandId: brand.id,
        campaignId: campaign.id,
        rewardName: "A free beverage",
        couponDescription: "One per visit",
        retailers: ["Sea Point", "Gardens"],
      },
    });

    person = await prisma.person.create({ data: { phoneHash: `wc-${suffix}`, phoneEncrypted: "e" } });
    stranger = await prisma.person.create({ data: { phoneHash: `wc-s-${suffix}`, phoneEncrypted: "e" } });

    membershipId = (await prisma.brandMembership.create({ data: { brandId: brand.id, personId: person.id } })).id;
    strangerMembershipId = (
      await prisma.brandMembership.create({ data: { brandId: brand.id, personId: stranger.id } })
    ).id;

    const otherCampaign = await prisma.campaign.create({
      data: { brandId: otherBrand.id, name: `Other ${suffix}`, status: "ACTIVE" },
    });
    otherCampaignId = otherCampaign.id;
    otherRewardId = (
      await prisma.reward.create({
        data: { brandId: otherBrand.id, campaignId: otherCampaign.id, rewardName: "Something else" },
      })
    ).id;
    otherMembershipId = (
      await prisma.brandMembership.create({ data: { brandId: otherBrand.id, personId: person.id } })
    ).id;
  });

  afterAll(async () => {
    for (const b of [brand, otherBrand]) {
      await prisma.coupon.deleteMany({ where: { brandId: b.id } });
      await prisma.reward.deleteMany({ where: { brandId: b.id } });
      await prisma.brandMembership.deleteMany({ where: { brandId: b.id } });
      await prisma.campaign.deleteMany({ where: { brandId: b.id } });
      await prisma.brand.delete({ where: { id: b.id } });
    }
    await prisma.person.deleteMany({ where: { id: { in: [person.id, stranger.id] } } });
  });

  it("carries the code, the promise and the terms", async () => {
    await makeCoupon(`WA-${suffix % 10000}`);

    const { open } = await listShopperCoupons(person.id, brand.id);
    const found = open.find((c) => c.code === `WA-${suffix % 10000}`);
    expect(found).toBeDefined();
    expect(found?.rewardName).toBe("A free beverage");
    expect(found?.terms).toBe("One per visit");
    expect(found?.retailers).toEqual(["Sea Point", "Gardens"]);
  });

  it("puts a redeemed coupon on the closed side rather than hiding it", async () => {
    const code = `WB-${suffix % 10000}`;
    await makeCoupon(code, { status: "REDEEMED", statusChangedAt: new Date() });

    const { open, closed } = await listShopperCoupons(person.id, brand.id);
    expect(open.map((c) => c.code)).not.toContain(code);
    expect(closed.map((c) => c.code)).toContain(code);
  });

  it("closes a coupon whose date has passed, even while the row still says ISSUED", async () => {
    // Nothing sweeps for expiries, so the row is only corrected when a
    // counter tries it. Showing the code in the meantime would send
    // somebody to a till to be refused.
    const code = `WC-${suffix % 10000}`;
    await makeCoupon(code, { expiresAt: new Date("2020-01-01T00:00:00Z") });

    const { open, closed } = await listShopperCoupons(person.id, brand.id);
    expect(open.map((c) => c.code)).not.toContain(code);
    expect(closed.map((c) => c.code)).toContain(code);
  });

  it("keeps a coupon whose date has not arrived", async () => {
    const code = `WD-${suffix % 10000}`;
    await makeCoupon(code, { expiresAt: new Date("2099-01-01T00:00:00Z") });

    const { open } = await listShopperCoupons(person.id, brand.id);
    expect(open.map((c) => c.code)).toContain(code);
  });

  it("never shows one shopper another shopper's code", async () => {
    const code = `WE-${suffix % 10000}`;
    await prisma.coupon.create({
      data: {
        brandId: brand.id,
        campaignId: campaign.id,
        rewardId: reward.id,
        brandMembershipId: strangerMembershipId,
        code,
      },
    });

    const mine = await listShopperCoupons(person.id, brand.id);
    expect([...mine.open, ...mine.closed].map((c) => c.code)).not.toContain(code);

    const theirs = await listShopperCoupons(stranger.id, brand.id);
    expect(theirs.open.map((c) => c.code)).toContain(code);
  });

  it("shows only the brand whose site the shopper is on", async () => {
    const code = `WF-${suffix % 10000}`;
    await prisma.coupon.create({
      data: {
        brandId: otherBrand.id,
        campaignId: otherCampaignId,
        rewardId: otherRewardId,
        brandMembershipId: otherMembershipId,
        code,
      },
    });

    const here = await listShopperCoupons(person.id, brand.id);
    expect([...here.open, ...here.closed].map((c) => c.code)).not.toContain(code);

    const there = await listShopperCoupons(person.id, otherBrand.id);
    expect(there.open.map((c) => c.code)).toContain(code);
  });
});
