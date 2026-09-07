import type { LedgerUnit } from "@prisma/client";
import { forBrand } from "@/lib/db/tenant";

/**
 * The numbers a brand opens the console to see.
 *
 * Every one of them is derived - there is no reporting table, no nightly
 * rollup, no cached total. At this size that is simply correct: the ledger
 * is the truth and a summary that can disagree with it is worse than no
 * summary. When a brand's ledger is large enough for this to hurt, the fix
 * is a materialised view with an explicit refresh, not a column somebody
 * updates in application code.
 *
 * Scoped through forBrand() throughout, so a console bug cannot show one
 * brand another's figures even if a brandId were wrong.
 */

export type BrandOverview = {
  /**
   * What the brand still owes its shoppers, per unit, right now.
   *
   * The one number a finance director asks for and the plan named as
   * missing: "a brand running 5% cashback has unbounded exposure and no
   * answer for their finance director." This is the answer. It is the sum of
   * every ledger row, so redemptions net it down automatically and it can
   * never drift from the rows behind it.
   */
  outstanding: { unit: LedgerUnit; amount: number }[];
  /** Total ever issued, before anything was spent - the gross cost so far. */
  issued: { unit: LedgerUnit; amount: number }[];
  members: number;
  optedOut: number;
  activeCampaigns: number;
  stores: number;
  /** Stores whose point of sale cannot sign a slip. The exposure, counted. */
  unsignedStores: number;
  /**
   * Live promotions with no ceiling on what they may ever issue.
   *
   * The ceilings exist and default to nothing, which means a brand can
   * switch on five percent cashback with no bound at all and the console
   * said nothing about it. Worse, the unsigned-stores warning on this page
   * told them their ceilings bounded the cost - true only if they set one.
   * A warning that promises a limit nobody set is worse than no warning.
   */
  uncappedCampaigns: number;
  /** Live promotions with no per-person daily cap. One shopper's ceiling. */
  uncappedPerPerson: number;
  scansLast7Days: number;
  newMembersLast7Days: number;
  /**
   * Scans per day for the last seven days, oldest first.
   *
   * A total answers "what happened"; a shape answers "is this working",
   * which is the question the console exists for. Seven discrete days
   * rather than a smoothed line, because there is no value between
   * Tuesday and Wednesday to draw.
   */
  scansByDay: { day: Date; count: number }[];
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function getBrandOverview(brandId: string, now: Date = new Date()): Promise<BrandOverview> {
  const scoped = forBrand(brandId);
  const since = new Date(now.getTime() - WEEK_MS);

  const [
    balances,
    credits,
    members,
    optedOut,
    activeCampaigns,
    stores,
    unsignedStores,
    uncappedCampaigns,
    uncappedPerPerson,
    scans,
    newMembers,
  ] =
    await Promise.all([
      scoped.pointsTransaction.groupBy({ by: ["unit"], _sum: { amount: true } }),
      // Credits only, so "issued" means what was handed out rather than what
      // is left after spending. Two different questions, and a brand asks
      // both - one is a cost, the other is a liability.
      scoped.pointsTransaction.groupBy({ by: ["unit"], where: { amount: { gt: 0 } }, _sum: { amount: true } }),
      scoped.brandMembership.count(),
      scoped.brandMembership.count({ where: { optedOutAt: { not: null } } }),
      scoped.campaign.count({ where: { status: "ACTIVE" } }),
      scoped.store.count(),
      scoped.store.count({ where: { signingSecretEncrypted: null } }),
      // A live promotion with no total ceiling. Counted separately from the
      // per-person one because they answer different questions: this is
      // "what can this campaign cost us in total", the other is "what can
      // one person take".
      scoped.campaign.count({ where: { status: "ACTIVE", earnRule: { maxTotalAmount: null } } }),
      scoped.campaign.count({ where: { status: "ACTIVE", earnRule: { maxPerPersonPerDay: null } } }),
      scoped.purchaseScan.count({ where: { scannedAt: { gte: since } } }),
      scoped.brandMembership.count({ where: { joinedAt: { gte: since } } }),
    ]);

  // One query for the series rather than seven counts. groupBy cannot bucket
  // by day, so the dates come back raw and are counted in memory - seven
  // days of one brand's scans is a small enough set that the alternative
  // (a raw SQL date_trunc) would be optimising the wrong thing.
  const scanDays = await scoped.purchaseScan.findMany({
    where: { scannedAt: { gte: since } },
    select: { scannedAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    buckets.set(day.toISOString().slice(0, 10), 0);
  }
  for (const scan of scanDays) {
    const key = scan.scannedAt.toISOString().slice(0, 10);
    // A scan can land a few minutes outside the window between the two
    // queries; drop it rather than inventing an eighth bar.
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const scansByDay = [...buckets.entries()].map(([key, count]) => ({ day: new Date(key), count }));

  const toRows = (rows: { unit: LedgerUnit; _sum: { amount: number | null } }[]) =>
    rows
      .map((row) => ({ unit: row.unit, amount: row._sum.amount ?? 0 }))
      .sort((a, b) => a.unit.localeCompare(b.unit));

  return {
    outstanding: toRows(balances),
    issued: toRows(credits),
    members,
    optedOut,
    activeCampaigns,
    stores,
    unsignedStores,
    uncappedCampaigns,
    uncappedPerPerson,
    scansLast7Days: scans,
    newMembersLast7Days: newMembers,
    scansByDay,
  };
}
