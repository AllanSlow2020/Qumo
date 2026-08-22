import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, Person } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { generatePackCode, formatPackCode } from "@/lib/packs/code";
import { checkCampaignWindow, redeemPackCode } from "@/lib/packs/scan";

describe("lib/packs/scan", () => {
  const suffix = Date.now();
  let brand: Brand;
  let otherBrand: Brand;
  let campaign: Campaign;
  let shopper: Person;
  let otherShopper: Person;

  async function makeCode(campaignId: string, brandId: string, status: "UNSCANNED" | "VOID" = "UNSCANNED") {
    const code = generatePackCode();
    const batch = await prisma.packBatch.create({
      data: { brandId, campaignId, label: `t-${suffix}-${code.slice(0, 4)}`, quantity: 1 },
    });
    await prisma.packCode.create({ data: { brandId, campaignId, batchId: batch.id, code, status } });
    return code;
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Scan Brand", slug: `scan-brand-${suffix}` } });
    otherBrand = await prisma.brand.create({ data: { name: "Other Brand", slug: `scan-other-${suffix}` } });

    campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Scan Campaign", status: "ACTIVE" },
    });
    await prisma.earnRule.create({
      data: { brandId: brand.id, campaignId: campaign.id, type: "FLAT_PER_SCAN", unit: "POINTS", amount: 50 },
    });

    shopper = await prisma.person.create({ data: { phoneHash: `scan-me-${suffix}`, phoneEncrypted: "x" } });
    otherShopper = await prisma.person.create({ data: { phoneHash: `scan-them-${suffix}`, phoneEncrypted: "x" } });
  });

  afterAll(async () => {
    const brandIds = [brand.id, otherBrand.id];
    await prisma.pointsTransaction.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.packCode.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.packBatch.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.earnRule.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.brandMembership.deleteMany({ where: { personId: { in: [shopper.id, otherShopper.id] } } });
    await prisma.campaign.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.person.deleteMany({ where: { id: { in: [shopper.id, otherShopper.id] } } });
    await prisma.brand.deleteMany({ where: { id: { in: brandIds } } });
  });

  it("awards the campaign's amount and reports the new balance", async () => {
    const code = await makeCode(campaign.id, brand.id);
    const result = await redeemPackCode(code, shopper.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.amount).toBe(50);
    expect(result.unit).toBe("POINTS");
    expect(result.brandName).toBe("Scan Brand");
    expect(result.newBalance).toBe(50);
  });

  it("creates the brand membership on a first scan", async () => {
    const newcomer = await prisma.person.create({
      data: { phoneHash: `scan-new-${suffix}`, phoneEncrypted: "x" },
    });
    // A membership is the record of a real relationship — it must not exist
    // before the shopper has actually interacted with the brand.
    expect(await prisma.brandMembership.count({ where: { personId: newcomer.id } })).toBe(0);

    const code = await makeCode(campaign.id, brand.id);
    expect((await redeemPackCode(code, newcomer.id)).ok).toBe(true);

    expect(await prisma.brandMembership.count({ where: { personId: newcomer.id, brandId: brand.id } })).toBe(1);

    await prisma.pointsTransaction.deleteMany({ where: { brandMembership: { personId: newcomer.id } } });
    await prisma.brandMembership.deleteMany({ where: { personId: newcomer.id } });
    await prisma.person.delete({ where: { id: newcomer.id } });
  });

  it("accepts the code in any form a shopper might present it", async () => {
    const code = await makeCode(campaign.id, brand.id);
    // A label carries the hyphenated form; someone typing it may lower-case
    // it or drop the separators entirely.
    const result = await redeemPackCode(formatPackCode(code).toLowerCase(), shopper.id);
    expect(result.ok).toBe(true);
  });

  it("awards once, however many times the same shopper opens it", async () => {
    // Rewritten to the invariant that matters. It used to assert that the
    // second call failed, which encoded a behaviour rather than a rule — and
    // the behaviour was wrong: the App Router renders this page twice on one
    // navigation, so the second call is what a first-time scanner actually
    // sees, and it told them the sticker was spent. What must be true is
    // that the ledger moves once. The refusal that still matters — somebody
    // else's code — is the test below.
    const code = await makeCode(campaign.id, brand.id);

    const first = await redeemPackCode(code, shopper.id);
    expect(first.ok).toBe(true);

    const membership = await prisma.brandMembership.findFirstOrThrow({
      where: { brandId: brand.id, personId: shopper.id },
    });
    // A delta, not a total: this shopper has earned from other codes in
    // this file, and a total would be asserting how many tests ran before
    // this one.
    const countAwards = () =>
      prisma.pointsTransaction.count({
        where: { brandMembershipId: membership.id, campaignId: campaign.id, reason: "PACK_SCAN_AWARDED" },
      });
    const before = await countAwards();

    const second = await redeemPackCode(code, shopper.id);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.alreadyEarned).toBe(true);
    expect(second.amount).toBe(first.amount);
    // A coupon is never shown twice: two sightings read as two coupons, and
    // it is already in their rewards.
    expect(second.coupon).toBeNull();

    // The whole point: re-opening the page moved nothing.
    expect(await countAwards()).toBe(before);
  });

  it("refuses a code already claimed by someone else", async () => {
    const code = await makeCode(campaign.id, brand.id);
    expect((await redeemPackCode(code, shopper.id)).ok).toBe(true);

    const stolen = await redeemPackCode(code, otherShopper.id);
    expect(stolen.ok).toBe(false);
  });

  it("awards once when the same code is scanned concurrently", async () => {
    // The real attack: a label photographed and shared in a group chat, or
    // one shopper double-tapping. A read-then-write would let both through
    // and pay out twice.
    const code = await makeCode(campaign.id, brand.id);
    const ledgerBefore = await prisma.pointsTransaction.count({ where: { brandId: brand.id } });

    const results = await Promise.all([
      redeemPackCode(code, shopper.id),
      redeemPackCode(code, otherShopper.id),
      redeemPackCode(code, shopper.id),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);

    const packCode = await prisma.packCode.findUniqueOrThrow({ where: { code } });
    expect(packCode.status).toBe("SCANNED");

    // The assertion that matters: three attempts, exactly one ledger row.
    // A read-then-write would have paid out two or three times.
    const ledgerAfter = await prisma.pointsTransaction.count({ where: { brandId: brand.id } });
    expect(ledgerAfter - ledgerBefore).toBe(1);
  });

  it("does not write a ledger row for a scan that fails", async () => {
    const before = await prisma.pointsTransaction.count({ where: { brandId: brand.id } });
    await redeemPackCode(generatePackCode(), shopper.id);
    expect(await prisma.pointsTransaction.count({ where: { brandId: brand.id } })).toBe(before);
  });

  it("rejects an unknown code", async () => {
    const result = await redeemPackCode(generatePackCode(), shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("UNKNOWN_CODE");
  });

  it("rejects a malformed code without touching the database", async () => {
    const result = await redeemPackCode("not-a-code", shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("UNKNOWN_CODE");
  });

  it("rejects a voided code", async () => {
    const code = await makeCode(campaign.id, brand.id, "VOID");
    const result = await redeemPackCode(code, shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Distinct from ALREADY_SCANNED: "we withdrew this" and "someone
    // claimed this" are different facts to a fraud investigation.
    expect(result.reason).toBe("VOID");
  });

  it("rejects a scan against a campaign that isn't running", async () => {
    const paused = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Paused", status: "PAUSED" },
    });
    await prisma.earnRule.create({
      data: { brandId: brand.id, campaignId: paused.id, type: "FLAT_PER_SCAN", unit: "POINTS", amount: 10 },
    });
    const code = await makeCode(paused.id, brand.id);

    const result = await redeemPackCode(code, shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("CAMPAIGN_NOT_ACTIVE");

    // A rejected scan must leave the code claimable once the campaign
    // resumes — otherwise a brand pausing a campaign destroys stock.
    expect((await prisma.packCode.findUniqueOrThrow({ where: { code } })).status).toBe("UNSCANNED");
  });

  it("rejects a scan when the campaign has no earn rule", async () => {
    const unset = await prisma.campaign.create({
      data: { brandId: brand.id, name: "No rule", status: "ACTIVE" },
    });
    const code = await makeCode(unset.id, brand.id);

    const result = await redeemPackCode(code, shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("NO_EARN_RULE");
  });

  it("accrues into the unit the campaign configures", async () => {
    const stampCampaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Stamps", status: "ACTIVE" },
    });
    await prisma.earnRule.create({
      data: { brandId: brand.id, campaignId: stampCampaign.id, type: "FLAT_PER_SCAN", unit: "STAMPS", amount: 1 },
    });

    const result = await redeemPackCode(await makeCode(stampCampaign.id, brand.id), shopper.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.unit).toBe("STAMPS");
    // Stamps and points are separate balances at the same brand — the
    // 50 points earned earlier must not leak into this total.
    expect(result.newBalance).toBe(1);
  });
});

describe("checkCampaignWindow", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("accepts an active campaign inside its window", () => {
    expect(
      checkCampaignWindow(
        { status: "ACTIVE", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-30") },
        now,
      ),
    ).toBeNull();
  });

  it("accepts an active campaign with no dates set", () => {
    expect(checkCampaignWindow({ status: "ACTIVE", startDate: null, endDate: null }, now)).toBeNull();
  });

  it("tells a shopper who scanned early that it hasn't started", () => {
    // Distinct from "not running" — the shopper should know to come back.
    expect(
      checkCampaignWindow({ status: "ACTIVE", startDate: new Date("2026-07-01"), endDate: null }, now),
    ).toBe("CAMPAIGN_NOT_STARTED");
  });

  it("reports an ended campaign", () => {
    expect(
      checkCampaignWindow({ status: "ACTIVE", startDate: null, endDate: new Date("2026-06-01") }, now),
    ).toBe("CAMPAIGN_ENDED");
  });

  it("puts status ahead of dates", () => {
    expect(checkCampaignWindow({ status: "DRAFT", startDate: null, endDate: null }, now)).toBe("CAMPAIGN_NOT_ACTIVE");
  });
});
