import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import {
  costPerMemberCents,
  delta,
  getPerformance,
  isNoMovement,
  isPeriod,
  repeatRate,
} from "@/lib/console/performance";

/**
 * A dashboard is where a plausible-looking wrong number hides best: nobody
 * checks a percentage that looks about right. So the arithmetic is pinned
 * to data built by hand, and the two headline figures are checked against
 * counts done a different way than the code does them.
 */

const run = randomUUID().slice(0, 8);
const DAY = 24 * 60 * 60 * 1000;

let brand: { id: string };
let other: { id: string };
let seaPoint: { id: string };
let claremont: { id: string };
let cashback: { id: string };
let members: { id: string }[] = [];

async function member(index: number) {
  const person = await prisma.person.create({
    data: { phoneHash: `perf-${run}-${index}`, phoneEncrypted: "x" },
  });
  return prisma.brandMembership.create({
    data: { brandId: brand.id, personId: person.id, joinedAt: new Date(Date.now() - 40 * DAY) },
  });
}

async function earn(membershipId: string, storeId: string, cents: number, daysAgo: number, txn: string) {
  const at = new Date(Date.now() - daysAgo * DAY);
  await prisma.purchaseScan.create({
    data: {
      brandId: brand.id,
      storeId,
      brandMembershipId: membershipId,
      campaignId: cashback.id,
      externalTxnId: txn,
      amountCents: cents * 20,
      wasSigned: true,
      purchasedAt: at,
      scannedAt: at,
    },
  });
  await prisma.pointsTransaction.create({
    data: {
      brandId: brand.id,
      brandMembershipId: membershipId,
      campaignId: cashback.id,
      amount: cents,
      unit: "CENTS",
      reason: "PURCHASE_ACCRUAL",
      createdAt: at,
    },
  });
}

beforeAll(async () => {
  brand = await prisma.brand.create({ data: { name: `Perf ${run}`, slug: `perf-${run}` } });
  other = await prisma.brand.create({ data: { name: `Rival ${run}`, slug: `rival-${run}` } });

  seaPoint = await prisma.store.create({
    data: { brandId: brand.id, name: "Sea Point", code: `SP${run}`, signingSecretEncrypted: "enc" },
  });
  claremont = await prisma.store.create({
    data: { brandId: brand.id, name: "Claremont", code: `CL${run}` },
  });

  cashback = await prisma.campaign.create({
    data: { brandId: brand.id, name: "5% back", status: "ACTIVE" },
  });
  await prisma.earnRule.create({
    data: {
      brandId: brand.id,
      campaignId: cashback.id,
      type: "PERCENT_OF_SPEND",
      unit: "CENTS",
      amount: 0,
      basisPoints: 500,
      maxTotalAmount: 10_000,
    },
  });

  members = [];
  for (let i = 0; i < 6; i += 1) members.push(await member(i));

  // Four earned once, one earned three times, one earned five times.
  await earn(members[0]!.id, seaPoint.id, 100, 2, `a-${run}`);
  await earn(members[1]!.id, seaPoint.id, 100, 3, `b-${run}`);
  await earn(members[2]!.id, seaPoint.id, 100, 4, `c-${run}`);
  await earn(members[3]!.id, claremont.id, 100, 5, `d-${run}`);

  for (let i = 0; i < 3; i += 1) await earn(members[4]!.id, seaPoint.id, 100, i + 1, `e${i}-${run}`);
  for (let i = 0; i < 5; i += 1) await earn(members[5]!.id, seaPoint.id, 100, i + 1, `f${i}-${run}`);

  // Outside the 30-day window, so it must not be counted in the period.
  await earn(members[0]!.id, claremont.id, 5_000, 60, `old-${run}`);
});

afterAll(async () => {
  for (const id of [brand.id, other.id]) {
    await prisma.pointsTransaction.deleteMany({ where: { brandId: id } });
    await prisma.purchaseScan.deleteMany({ where: { brandId: id } });
    await prisma.earnRule.deleteMany({ where: { brandId: id } });
    await prisma.campaign.deleteMany({ where: { brandId: id } });
    await prisma.brandMembership.deleteMany({ where: { brandId: id } });
    await prisma.store.deleteMany({ where: { brandId: id } });
    await prisma.brand.delete({ where: { id } });
  }
  await prisma.person.deleteMany({ where: { phoneHash: { startsWith: `perf-${run}` } } });
});

describe("the period", () => {
  it("accepts only the windows the screen offers", () => {
    expect(isPeriod(7)).toBe(true);
    expect(isPeriod(30)).toBe(true);
    expect(isPeriod(90)).toBe(true);
    // A window off the end of a URL is not a window.
    expect(isPeriod(31)).toBe(false);
    expect(isPeriod("thirty")).toBe(false);
    expect(isPeriod(undefined)).toBe(false);
  });

  it("counts only what happened inside it", async () => {
    const p = await getPerformance(brand.id, 30);
    // Twelve earn events inside the window; the sixty-day-old one is out.
    expect(p.slips).toBe(12);
    expect(p.issued.find((r) => r.unit === "CENTS")!.amount).toBe(1_200);
  });

  it("reports what is still owed across all time, not just the window", async () => {
    const p = await getPerformance(brand.id, 7);
    // The old R50 is still owed even though it is outside a seven-day view.
    expect(p.outstanding.find((r) => r.unit === "CENTS")!.amount).toBe(6_200);
  });
});

describe("repeat, which is the number that decides it", () => {
  it("distributes people by how often they came back", async () => {
    const p = await getPerformance(brand.id, 30);
    // Four came once, one came three times, one came five times.
    expect(p.repeat).toEqual({ once: 4, twice: 1, more: 1 });
    expect(p.membersReached).toBe(6);
  });

  it("is the share who earned more than once", async () => {
    const p = await getPerformance(brand.id, 30);
    expect(repeatRate(p)).toBeCloseTo(2 / 6, 5);
  });

  /**
   * Dividing by nobody is not a rate of zero. Printing 0% where nobody has
   * earned reads as "they came and did not return", which is the opposite
   * of what happened.
   */
  it("is null rather than zero when nobody has earned", async () => {
    const p = await getPerformance(other.id, 30);
    expect(repeatRate(p)).toBeNull();
    expect(costPerMemberCents(p)).toBeNull();
  });
});

describe("cost per person reached", () => {
  it("divides what was issued by the people it reached", async () => {
    const p = await getPerformance(brand.id, 30);
    // R12.00 issued across six people.
    expect(costPerMemberCents(p)).toBe(200);
  });
});

describe("where it is running", () => {
  it("puts the busiest store first and computes its share", async () => {
    const p = await getPerformance(brand.id, 30);
    const [first, second] = p.byStore;

    expect(first!.name).toBe("Sea Point");
    expect(first!.scans).toBe(11);
    expect(second!.name).toBe("Claremont");
    expect(second!.scans).toBe(1);

    // The shares add up to one, which is the way a share table goes wrong.
    expect(p.byStore.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 5);
  });

  it("says which stores cannot sign, because that is the exposure", async () => {
    const p = await getPerformance(brand.id, 30);
    expect(p.byStore.find((s) => s.name === "Sea Point")!.isSigned).toBe(true);
    expect(p.byStore.find((s) => s.name === "Claremont")!.isSigned).toBe(false);
  });

  it("keeps a store with no scans in the list", async () => {
    // A quiet store is the finding, not a row to hide.
    await prisma.store.create({ data: { brandId: brand.id, name: "Zzz Quiet", code: `QQ${run}` } });
    const p = await getPerformance(brand.id, 30);
    const quiet = p.byStore.find((s) => s.name === "Zzz Quiet");
    expect(quiet).toBeDefined();
    expect(quiet!.scans).toBe(0);
    expect(quiet!.share).toBe(0);
  });
});

describe("by promotion", () => {
  it("measures the ceiling against everything ever issued, not the window", async () => {
    const p = await getPerformance(brand.id, 7);
    const row = p.byCampaign.find((c) => c.name === "5% back")!;

    // R62.00 issued all time against a R100.00 ceiling, even though the
    // seven-day window only contains part of it. A budget is a lifetime
    // budget whichever window you happen to be looking at.
    expect(row.ceilingUsed).toBeCloseTo(6_200 / 10_000, 5);
  });

  it("counts distinct people per promotion rather than earn events", async () => {
    const p = await getPerformance(brand.id, 30);
    expect(p.byCampaign.find((c) => c.name === "5% back")!.members).toBe(6);
  });

  /**
   * Found by looking at a seeded campaign that read "100%" when it was
   * really at 179%. The ceiling is checked before every award, so nothing
   * can breach it while it stands — but lowering a ceiling below what has
   * already been issued puts a campaign over immediately, and that is
   * exactly the moment a brand needs to be told rather than reassured.
   */
  it("reports a campaign over its ceiling as over, not as exactly full", async () => {
    await prisma.earnRule.updateMany({
      where: { campaignId: cashback.id },
      data: { maxTotalAmount: 1_000 },
    });

    const p = await getPerformance(brand.id, 30);
    const row = p.byCampaign.find((c) => c.name === "5% back")!;
    expect(row.ceilingUsed).toBeGreaterThan(1);
    expect(row.ceilingUsed).toBeCloseTo(6_200 / 1_000, 5);

    await prisma.earnRule.updateMany({
      where: { campaignId: cashback.id },
      data: { maxTotalAmount: 10_000 },
    });
  });

  it("says 'no ceiling' as a state rather than as a zero", async () => {
    const uncapped = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Uncapped", status: "ACTIVE" },
    });
    await prisma.earnRule.create({
      data: {
        brandId: brand.id,
        campaignId: uncapped.id,
        type: "FLAT_PER_SCAN",
        unit: "POINTS",
        amount: 10,
      },
    });

    const p = await getPerformance(brand.id, 30);
    expect(p.byCampaign.find((c) => c.name === "Uncapped")!.ceilingUsed).toBeNull();
  });
});

describe("tenancy", () => {
  it("shows one brand nothing of another's", async () => {
    const p = await getPerformance(other.id, 30);
    expect(p.slips).toBe(0);
    expect(p.membersReached).toBe(0);
    expect(p.byStore).toHaveLength(0);
    expect(p.byCampaign).toHaveLength(0);
  });
});

describe("the chart", () => {
  it("returns one bucket per day of the window", async () => {
    expect((await getPerformance(brand.id, 7)).scansByDay).toHaveLength(7);
    expect((await getPerformance(brand.id, 90)).scansByDay).toHaveLength(90);
  });

  it("agrees with the total printed beside it", async () => {
    const p = await getPerformance(brand.id, 30);
    expect(p.scansByDay.reduce((sum, d) => sum + d.count, 0)).toBe(p.slips);
  });
});

/**
 * The comparison against the window before.
 *
 * A figure with nothing to compare it to is not a finding: "42% came back"
 * is unreadable on its own, and the only question anybody actually has is
 * whether that is better or worse than it was.
 */
describe("comparison with the previous window", () => {
  it("measures the window immediately before, with no gap and no overlap", async () => {
    const p = await getPerformance(brand.id, 7);
    expect(p.previous).toBeDefined();

    // The previous window ends exactly where this one starts. A gap loses
    // days; an overlap counts them twice, and both look plausible.
    const previousEnd = new Date(p.previous!.from.getTime() + 7 * DAY);
    expect(previousEnd.getTime()).toBeCloseTo(p.from.getTime(), -3);
  });

  /**
   * The test that was missing, and the bug it would have caught.
   *
   * Every period filter started as `gte: from` with no upper bound. That is
   * right exactly once — for the current window, where "now" is the end of
   * time anyway — and wrong the moment the same function measures an
   * earlier window: an open-ended range from the start of the previous
   * period runs to today and swallows the current one whole.
   *
   * The symptom was that every comparison on the screen read "no change",
   * because the previous window contained the current window's data and
   * then some. A bug that makes a number look boring rather than wrong is
   * the kind that ships.
   */
  it("does not let the current window leak into the previous one", async () => {
    const p = await getPerformance(brand.id, 7);

    // Everything in this suite was scanned within the last five days, so a
    // correctly bounded previous window — days 7 to 14 — contains none of
    // it. Unbounded, it would contain all twelve.
    expect(p.previous!.slips).toBe(0);
    expect(p.previous!.membersReached).toBe(0);
    expect(p.slips).toBe(12);
  });

  it("does not recurse forever", async () => {
    const p = await getPerformance(brand.id, 7);
    expect((p.previous as { previous?: unknown }).previous).toBeUndefined();
  });

  it("finds the older scans in the earlier window rather than this one", async () => {
    // The 60-day-old R50 scan is outside a 30-day window and outside the
    // 30 before it, so neither should see it; the 90-day window should.
    const ninety = await getPerformance(brand.id, 90);
    expect(ninety.slips).toBe(13);
  });
});

describe("delta", () => {
  it("reports the movement between two figures", () => {
    expect(delta(120, 100)).toEqual({ absolute: 20, relative: 0.2 });
    expect(delta(80, 100)).toEqual({ absolute: -20, relative: -0.2 });
  });

  /**
   * Everything is an infinite increase on nothing, and "+∞%" tells a brand
   * less than the two raw numbers do.
   */
  it("has no relative change when there was nothing before", () => {
    expect(delta(50, 0)).toEqual({ absolute: 50, relative: null });
  });

  it("is null when either side is missing, rather than treating it as zero", () => {
    // A repeat rate of null means nobody earned, which is not the same as
    // a repeat rate of zero, and subtracting the two would invent a fall.
    expect(delta(null, 0.5)).toBeNull();
    expect(delta(0.5, null)).toBeNull();
  });
});

describe("a brand with nothing yet", () => {
  /**
   * The state every brand is in on day one, and the one screen state I had
   * never actually looked at.
   */
  it("returns a whole, empty shape rather than throwing or half-filling", async () => {
    const p = await getPerformance(other.id, 30);

    expect(p.slips).toBe(0);
    expect(p.packCodes).toBe(0);
    expect(p.membersReached).toBe(0);
    expect(p.issued).toEqual([]);
    expect(p.outstanding).toEqual([]);
    expect(p.repeat).toEqual({ once: 0, twice: 0, more: 0 });
    expect(p.byStore).toEqual([]);
    expect(p.byCampaign).toEqual([]);
    // Still seven-times-thirty buckets, so the chart has a shape to be
    // empty in rather than undefined to crash on.
    expect(p.scansByDay).toHaveLength(30);
    expect(p.previous).toBeDefined();

    expect(repeatRate(p)).toBeNull();
    expect(costPerMemberCents(p)).toBeNull();
  });
});

describe("isNoMovement", () => {
  /**
   * A brand on its first day should see a clean screen, not a row of "no
   * change" notes. Saying "no change" implies there was something to change
   * from, and there was not.
   */
  it("is true when there was nothing then and nothing now", () => {
    expect(isNoMovement(delta(0, 0))).toBe(true);
  });

  it("is false for a real change, including one from nothing", () => {
    expect(isNoMovement(delta(5, 0))).toBe(false);
    expect(isNoMovement(delta(0, 5))).toBe(false);
    expect(isNoMovement(delta(120, 100))).toBe(false);
  });

  it("is false when there is nothing to compare at all", () => {
    expect(isNoMovement(null)).toBe(false);
  });
});
