import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Person } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { describeEarnRule, getMembershipStatus, joinBrand, listOffers } from "@/lib/consumer/join";
import { setOptOut } from "@/lib/consumer/membership";
import { encryptPhone, hashPhone } from "@/lib/security/crypto";

describe("what a promotion says on a poster", () => {
  it("turns basis points into a percentage a person would say out loud", () => {
    expect(
      describeEarnRule({
        type: "PERCENT_OF_SPEND",
        unit: "CENTS",
        amount: 0,
        basisPoints: 500,
        minSpendCents: null,
        completesAt: null,
      }).headline,
    ).toBe("Get 5% of every purchase back");

    // Not "2.50%", and not "2.5000000000000004%" either.
    expect(
      describeEarnRule({
        type: "PERCENT_OF_SPEND",
        unit: "CENTS",
        amount: 0,
        basisPoints: 250,
        minSpendCents: null,
        completesAt: null,
      }).headline,
    ).toBe("Get 2.5% of every purchase back");
  });

  it("describes a stamp card by what completes it", () => {
    const { headline } = describeEarnRule({
      type: "FLAT_PER_SCAN",
      unit: "STAMPS",
      amount: 1,
      basisPoints: null,
      minSpendCents: null,
      completesAt: 10,
    });
    expect(headline).toBe("Collect 1 stamp per purchase — 10 earns a reward");
  });

  it("states the qualifying basket in rands, not cents", () => {
    const { condition } = describeEarnRule({
      type: "FLAT_PER_SCAN",
      unit: "POINTS",
      amount: 50,
      basisPoints: null,
      minSpendCents: 5_000,
      completesAt: null,
    });
    expect(condition).toBe("On purchases of R50 or more.");
  });
});

describe("joining from a poster", () => {
  const suffix = Date.now();

  let brand: Brand;
  let otherBrand: Brand;
  let shopper: Person;

  async function ledgerRowsFor(b: Brand): Promise<number> {
    const membership = await prisma.brandMembership.findFirst({
      where: { brandId: b.id, personId: shopper.id },
    });
    if (!membership) return 0;
    return prisma.pointsTransaction.count({ where: { brandMembershipId: membership.id } });
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Licken", slug: `join-a-${suffix}` } });
    otherBrand = await prisma.brand.create({ data: { name: "Campari", slug: `join-b-${suffix}` } });

    for (const [b, bp] of [
      [brand, 500],
      [otherBrand, 1_000],
    ] as const) {
      const campaign = await prisma.campaign.create({
        data: { brandId: b.id, name: `${b.name} promo`, status: "ACTIVE" },
      });
      await prisma.earnRule.create({
        data: {
          brandId: b.id,
          campaignId: campaign.id,
          type: "PERCENT_OF_SPEND",
          unit: "CENTS",
          amount: 0,
          basisPoints: bp,
        },
      });
    }

    // A campaign that is not running must not appear on a poster.
    const paused = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Last winter", status: "PAUSED" },
    });
    await prisma.earnRule.create({
      data: {
        brandId: brand.id,
        campaignId: paused.id,
        type: "FLAT_PER_SCAN",
        unit: "POINTS",
        amount: 99,
        basisPoints: null,
      },
    });

    const phone = `+2784${String(suffix).slice(-7)}`;
    shopper = await prisma.person.create({
      data: { phoneHash: hashPhone(phone), phoneEncrypted: encryptPhone(phone), firstName: "Allan" },
    });
  });

  afterAll(async () => {
    for (const b of [brand, otherBrand]) {
      await prisma.pointsTransaction.deleteMany({ where: { brandId: b.id } });
      await prisma.brandMembership.deleteMany({ where: { brandId: b.id } });
      await prisma.earnRule.deleteMany({ where: { brandId: b.id } });
      await prisma.campaign.deleteMany({ where: { brandId: b.id } });
      await prisma.brand.delete({ where: { id: b.id } });
    }
    await prisma.person.delete({ where: { id: shopper.id } });
  });

  it("shows only this brand's running promotions", async () => {
    const offers = await listOffers(brand.id);
    expect(offers.map((o) => o.headline)).toEqual(["Get 5% of every purchase back"]);
    // Not the paused one, and not the other brand's.
    expect(offers.some((o) => o.headline.includes("99"))).toBe(false);
    expect(offers.some((o) => o.headline.includes("10%"))).toBe(false);
  });

  it("joins, and awards absolutely nothing", async () => {
    // The property the whole poster/slip distinction rests on. A poster is a
    // static code anyone can scan without buying anything, so if this ever
    // moved the ledger it would move it for everyone who walked past.
    expect(await getMembershipStatus(shopper.id, brand.id)).toEqual({ joined: false, optedOut: false });

    await joinBrand(shopper.id, brand.id);

    expect(await getMembershipStatus(shopper.id, brand.id)).toEqual({ joined: true, optedOut: false });
    expect(await ledgerRowsFor(brand)).toBe(0);
  });

  it("is safe to press twice", async () => {
    // Two taps on a slow connection is the ordinary case at a till, not the
    // exotic one.
    await joinBrand(shopper.id, brand.id);
    await joinBrand(shopper.id, brand.id);

    const count = await prisma.brandMembership.count({ where: { brandId: brand.id, personId: shopper.id } });
    expect(count).toBe(1);
    expect(await ledgerRowsFor(brand)).toBe(0);
  });

  it("joins one brand without joining the other", async () => {
    expect(await getMembershipStatus(shopper.id, otherBrand.id)).toEqual({ joined: false, optedOut: false });
  });

  it("brings somebody back without touching what they earned", async () => {
    const membership = await prisma.brandMembership.findFirstOrThrow({
      where: { brandId: brand.id, personId: shopper.id },
    });
    const campaign = await prisma.campaign.findFirstOrThrow({ where: { brandId: brand.id, status: "ACTIVE" } });
    await prisma.pointsTransaction.create({
      data: {
        brandId: brand.id,
        brandMembershipId: membership.id,
        campaignId: campaign.id,
        amount: 600,
        unit: "CENTS",
        reason: "PURCHASE_ACCRUAL",
      },
    });

    expect(await setOptOut(shopper.id, brand.id, true)).toBe(true);
    expect(await getMembershipStatus(shopper.id, brand.id)).toEqual({ joined: false, optedOut: true });

    await joinBrand(shopper.id, brand.id);

    expect(await getMembershipStatus(shopper.id, brand.id)).toEqual({ joined: true, optedOut: false });
    // Rejoining is an opt-in, not a reset. The fear that stops people
    // leaving is that they will lose what they had, and it is unfounded by
    // design in both directions.
    const totals = await prisma.pointsTransaction.aggregate({
      where: { brandMembershipId: membership.id, unit: "CENTS" },
      _sum: { amount: true },
    });
    expect(totals._sum.amount).toBe(600);
  });
});
