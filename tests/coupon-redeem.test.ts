import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, Reward, User } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ForbiddenError } from "@/lib/auth/rbac";
import { normaliseCouponCode, redeemCouponForSession } from "@/lib/coupons/manage";

describe("taking a coupon at the counter", () => {
  const suffix = Date.now();

  let brand: Brand;
  let otherBrand: Brand;
  let owner: User;
  let secondOwner: User;
  let quality: User;
  let otherOwner: User;
  let campaign: Campaign;
  let reward: Reward;
  let membershipId: string;
  let otherMembershipId: string;
  let otherCampaignId: string;
  let otherRewardId: string;

  const actor = (user: User) => ({
    user: { id: user.id, brandId: user.brandId, role: user.role, name: user.name, email: user.email },
  });

  async function makeUser(brandId: string, role: User["role"], label: string): Promise<User> {
    return prisma.user.create({
      data: {
        brandId,
        email: `${label}-${suffix}@example.test`,
        passwordHash: "x",
        name: label,
        role,
      },
    });
  }

  /** A coupon of this brand's live card, in whatever state the case needs. */
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
    brand = await prisma.brand.create({ data: { name: "Copper Kettle", slug: `redeem-a-${suffix}` } });
    otherBrand = await prisma.brand.create({ data: { name: "Amber Oak", slug: `redeem-b-${suffix}` } });

    owner = await makeUser(brand.id, "OWNER", "owner");
    secondOwner = await makeUser(brand.id, "ADMIN", "admin");
    quality = await makeUser(brand.id, "QUALITY", "quality");
    otherOwner = await makeUser(otherBrand.id, "OWNER", "other-owner");

    campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: `Rounds card ${suffix}`, status: "ACTIVE" },
    });
    reward = await prisma.reward.create({
      data: {
        brandId: brand.id,
        campaignId: campaign.id,
        rewardName: "A free beverage",
        couponName: "Rounds card reward",
      },
    });

    const person = await prisma.person.create({
      data: { phoneHash: `hash-${suffix}`, phoneEncrypted: "enc" },
    });
    const membership = await prisma.brandMembership.create({
      data: { brandId: brand.id, personId: person.id },
    });
    membershipId = membership.id;

    const otherCampaign = await prisma.campaign.create({
      data: { brandId: otherBrand.id, name: `Other card ${suffix}`, status: "ACTIVE" },
    });
    otherCampaignId = otherCampaign.id;
    const otherReward = await prisma.reward.create({
      data: { brandId: otherBrand.id, campaignId: otherCampaign.id, rewardName: "Something else" },
    });
    otherRewardId = otherReward.id;
    const otherPerson = await prisma.person.create({
      data: { phoneHash: `hash-other-${suffix}`, phoneEncrypted: "enc" },
    });
    const otherMembership = await prisma.brandMembership.create({
      data: { brandId: otherBrand.id, personId: otherPerson.id },
    });
    otherMembershipId = otherMembership.id;
  });

  afterAll(async () => {
    for (const b of [brand, otherBrand]) {
      await prisma.couponFraudEvent.deleteMany({ where: { brandId: b.id } });
      await prisma.coupon.deleteMany({ where: { brandId: b.id } });
      await prisma.auditEvent.deleteMany({ where: { brandId: b.id } });
      await prisma.reward.deleteMany({ where: { brandId: b.id } });
      await prisma.brandMembership.deleteMany({ where: { brandId: b.id } });
      await prisma.campaign.deleteMany({ where: { brandId: b.id } });
      await prisma.user.deleteMany({ where: { brandId: b.id } });
      await prisma.brand.delete({ where: { id: b.id } });
    }
    await prisma.person.deleteMany({ where: { phoneHash: { in: [`hash-${suffix}`, `hash-other-${suffix}`] } } });
  });

  it("hands the reward over and says what it was", async () => {
    await makeCoupon(`AAAA-${suffix % 10000}`);
    const result = await redeemCouponForSession(actor(owner), `AAAA-${suffix % 10000}`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rewardName).toBe("A free beverage");
    expect(result.couponName).toBe("Rounds card reward");
  });

  it("records who took it and when", async () => {
    const code = `BBBB-${suffix % 10000}`;
    const coupon = await makeCoupon(code);
    await redeemCouponForSession(actor(owner), code);

    const after = await prisma.coupon.findUnique({ where: { id: coupon.id } });
    expect(after?.status).toBe("REDEEMED");
    expect(after?.statusChangedByUserId).toBe(owner.id);
    expect(after?.statusChangedAt).toBeInstanceOf(Date);
  });

  it("refuses the second counter, and says who got there first", async () => {
    const code = `CCCC-${suffix % 10000}`;
    await makeCoupon(code);
    await redeemCouponForSession(actor(owner), code);

    const second = await redeemCouponForSession(actor(secondOwner), code);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toBe("ALREADY_REDEEMED");
    expect(second.changedBy).toBe("owner");
    expect(second.changedAt).toBeInstanceOf(Date);
  });

  it("writes down every refusal, a mistyped code included", async () => {
    const result = await redeemCouponForSession(actor(owner), "ZZZZ-9999");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("NOT_FOUND");

    const events = await prisma.couponFraudEvent.findMany({
      where: { brandId: brand.id, couponCode: "ZZZZ-9999" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.reason).toBe("NOT_FOUND");
    expect(events[0]?.attemptedByUserId).toBe(owner.id);
  });

  it("will not show one brand another brand's coupon", async () => {
    const code = `DDDD-${suffix % 10000}`;
    await prisma.coupon.create({
      data: {
        brandId: otherBrand.id,
        campaignId: otherCampaignId,
        rewardId: otherRewardId,
        brandMembershipId: otherMembershipId,
        code,
      },
    });

    // Not "already redeemed", not "expired": as far as this brand is
    // concerned the code does not exist, which is the only answer that
    // leaks nothing about another brand's programme.
    const result = await redeemCouponForSession(actor(owner), code);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("NOT_FOUND");

    const untouched = await prisma.coupon.findUnique({ where: { code } });
    expect(untouched?.status).toBe("ISSUED");
  });

  it("refuses an expired coupon and corrects the row while it is looking", async () => {
    const code = `EEEE-${suffix % 10000}`;
    const coupon = await makeCoupon(code, { expiresAt: new Date("2020-01-01T00:00:00Z") });

    const result = await redeemCouponForSession(actor(owner), code);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("EXPIRED");

    const after = await prisma.coupon.findUnique({ where: { id: coupon.id } });
    expect(after?.status).toBe("EXPIRED");
  });

  it("honours an expiry that has not arrived yet", async () => {
    const code = `FFFF-${suffix % 10000}`;
    await makeCoupon(code, { expiresAt: new Date("2099-01-01T00:00:00Z") });

    const result = await redeemCouponForSession(actor(owner), code);
    expect(result.ok).toBe(true);
  });

  it("refuses a cancelled coupon", async () => {
    const code = `GGGG-${suffix % 10000}`;
    await makeCoupon(code, { status: "CANCELLED", statusChangedAt: new Date() });

    const result = await redeemCouponForSession(actor(owner), code);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("ALREADY_CANCELLED");
  });

  it("reads a code typed in lower case with a stray space", async () => {
    const code = `HHHH-${suffix % 10000}`;
    await makeCoupon(code);

    const result = await redeemCouponForSession(actor(owner), ` hhhh-${suffix % 10000} `);
    expect(result.ok).toBe(true);
  });

  it("keeps QUALITY away from it", async () => {
    const code = `JJJJ-${suffix % 10000}`;
    await makeCoupon(code);

    await expect(redeemCouponForSession(actor(quality), code)).rejects.toThrow(ForbiddenError);

    const untouched = await prisma.coupon.findUnique({ where: { code } });
    expect(untouched?.status).toBe("ISSUED");
  });

  it("leaves an audit entry naming the coupon", async () => {
    const code = `KKKK-${suffix % 10000}`;
    await makeCoupon(code);
    await redeemCouponForSession(actor(owner), code);

    const entry = await prisma.auditEvent.findFirst({
      where: { brandId: brand.id, action: "coupon.redeemed", targetLabel: code },
    });
    expect(entry).not.toBeNull();
    expect(entry?.actorName).toBe("owner");
  });

  it("normalises a code the same way everywhere", () => {
    expect(normaliseCouponCode(" fc-7xqp-928k ")).toBe("FC-7XQP-928K");
  });

  it("will not let two counters take the same coupon", async () => {
    const code = `LLLL-${suffix % 10000}`;
    await makeCoupon(code);

    // Both reads see ISSUED; the conditional update decides. Whichever
    // order they land in, exactly one hands a beverage over.
    const [first, second] = await Promise.all([
      redeemCouponForSession(actor(owner), code),
      redeemCouponForSession(actor(secondOwner), code),
    ]);

    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    const loser = first.ok ? second : first;
    expect(loser.ok).toBe(false);
    if (loser.ok) return;
    expect(loser.reason).toBe("ALREADY_REDEEMED");
  });
});
