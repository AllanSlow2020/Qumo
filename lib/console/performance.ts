import type { LedgerUnit } from "@prisma/client";
import { forBrand } from "@/lib/db/tenant";

/**
 * The screen that answers "is this working".
 *
 * The overview answers "what is happening" — totals, counts, this week. That
 * is the question a brand asks in month one. From month two they ask a
 * harder one, and until now the console had no answer to it at all.
 *
 * ── The two numbers that decide it ───────────────────────────────────────
 *
 * **Repeat rate.** A loyalty programme where almost everybody scans once is
 * not a loyalty programme; it is a discount with extra steps. The totals
 * hide this completely — a thousand people scanning once and three hundred
 * scanning three times produce similar-looking figures and mean opposite
 * things. So the distribution is reported, not just the average: how many
 * came once, how many twice or three times, how many more than that.
 *
 * **Cost per member reached.** What the brand paid, divided by the people
 * it actually reached. It is the number that makes the spend comparable to
 * anything else in a marketing budget, and it is the one a finance director
 * can act on.
 *
 * Everything else here exists to explain those two.
 *
 * ── Why "by store" is on this page ───────────────────────────────────────
 *
 * A franchise's real question is whether the programme is running at all.
 * If three stores of forty produce most of the scans, that is not a
 * successful pilot, it is an accidental one — and the totals look fine
 * while it happens. The by-store table is how that becomes visible.
 *
 * Everything is scoped through forBrand, like every other read: this page
 * names stores, campaigns and member counts, and none of it may cross a
 * tenant boundary.
 */

/** Windows a person actually asks for. Not free-form: a date picker invites
 *  cherry-picking a good fortnight, and three fixed windows are honest. */
export const PERIODS = [7, 30, 90] as const;
export type PeriodDays = (typeof PERIODS)[number];

export function isPeriod(value: unknown): value is PeriodDays {
  return PERIODS.includes(Number(value) as PeriodDays);
}

export type UnitAmount = { unit: LedgerUnit; amount: number };

export type StoreRow = {
  id: string;
  name: string;
  code: string;
  isSigned: boolean;
  scans: number;
  /** Share of all slips scanned in the period, 0–1. */
  share: number;
};

export type CampaignRow = {
  id: string;
  name: string;
  status: string;
  unit: LedgerUnit | null;
  /** Issued by this campaign in the period, in its own unit. */
  issued: number;
  /** The ceiling, or null for "no ceiling", which is a real answer. */
  ceiling: number | null;
  /**
   * Issued all time against that ceiling, as a ratio, or null when
   * uncapped. Deliberately not clamped: a campaign at 1.8 is a campaign
   * eighty percent over budget, and clamping it to 1 makes that look
   * identical to one that landed exactly on it.
   *
   * It can exceed 1 in one real way — the ceiling is checked before each
   * award, so nothing can breach it while it stands, but lowering a
   * ceiling below what has already been issued puts a campaign over it
   * immediately. A brand cutting a budget mid-campaign is exactly when
   * they need to be told.
   */
  ceilingUsed: number | null;
  members: number;
};

export type Performance = {
  days: PeriodDays;
  from: Date;
  /** Credits issued during the period, per unit. */
  issued: UnitAmount[];
  /** Everything still owed, right now, all time — not period-bound. */
  outstanding: UnitAmount[];
  slips: number;
  packCodes: number;
  /** Distinct people who earned anything during the period. */
  membersReached: number;
  newMembers: number;
  /**
   * How often the people who earned in the period came back.
   *
   * A distribution rather than an average, because the average of "one
   * scan" and "five scans" says nothing about either group.
   */
  repeat: { once: number; twice: number; more: number };
  scansByDay: { day: Date; count: number }[];
  byStore: StoreRow[];
  byCampaign: CampaignRow[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toUnitRows(rows: { unit: LedgerUnit; _sum: { amount: number | null } }[]): UnitAmount[] {
  return rows
    .map((r) => ({ unit: r.unit, amount: r._sum.amount ?? 0 }))
    .filter((r) => r.amount !== 0)
    .sort((a, b) => a.unit.localeCompare(b.unit));
}

export async function getPerformance(
  brandId: string,
  days: PeriodDays,
  now: Date = new Date(),
): Promise<Performance> {
  const scoped = forBrand(brandId);
  const from = new Date(now.getTime() - days * DAY_MS);

  const [issuedRows, outstandingRows, slipRows, packCodes, newMembers, perMember, campaigns, stores] =
    await Promise.all([
      // Credits only. "Issued" is what was handed out; netting redemptions
      // off it would answer a different question, and the outstanding
      // figure beside it already answers that one.
      scoped.pointsTransaction.groupBy({
        by: ["unit"],
        where: { amount: { gt: 0 }, createdAt: { gte: from } },
        _sum: { amount: true },
      }),
      scoped.pointsTransaction.groupBy({ by: ["unit"], _sum: { amount: true } }),
      scoped.purchaseScan.findMany({
        where: { scannedAt: { gte: from } },
        select: { scannedAt: true, storeId: true, brandMembershipId: true },
      }),
      scoped.packCode.count({ where: { status: "SCANNED", scannedAt: { gte: from } } }),
      scoped.brandMembership.count({ where: { joinedAt: { gte: from } } }),
      // Earn events per member in the period, which is what the repeat
      // distribution is built from. Counted over ledger credits rather than
      // over slips, so a pack code counts as coming back too.
      scoped.pointsTransaction.groupBy({
        by: ["brandMembershipId"],
        where: { amount: { gt: 0 }, createdAt: { gte: from } },
        _count: { _all: true },
      }),
      scoped.campaign.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          earnRule: { select: { unit: true, maxTotalAmount: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      scoped.store.findMany({ select: { id: true, name: true, code: true, signingSecretEncrypted: true } }),
    ]);

  // ---- repeat distribution -------------------------------------------------
  const repeat = { once: 0, twice: 0, more: 0 };
  for (const row of perMember) {
    const n = row._count._all;
    if (n <= 1) repeat.once += 1;
    else if (n <= 3) repeat.twice += 1;
    else repeat.more += 1;
  }
  const membersReached = perMember.length;

  // ---- scans per day -------------------------------------------------------
  // Bucketed in memory rather than in SQL: a period is at most ninety days of
  // one brand's scans, and date_trunc in raw SQL would step outside the
  // tenant guard for a query that is not expensive.
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    buckets.set(new Date(now.getTime() - i * DAY_MS).toISOString().slice(0, 10), 0);
  }
  const perStore = new Map<string, number>();
  for (const scan of slipRows) {
    const key = scan.scannedAt.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    perStore.set(scan.storeId, (perStore.get(scan.storeId) ?? 0) + 1);
  }

  // ---- by store ------------------------------------------------------------
  const byStore: StoreRow[] = stores
    .map((store) => ({
      id: store.id,
      name: store.name,
      code: store.code,
      isSigned: store.signingSecretEncrypted !== null,
      scans: perStore.get(store.id) ?? 0,
      share: slipRows.length === 0 ? 0 : (perStore.get(store.id) ?? 0) / slipRows.length,
    }))
    // Busiest first, because the question is which stores are carrying it —
    // and the quiet ones at the bottom are the answer to the other half.
    .sort((a, b) => b.scans - a.scans || a.name.localeCompare(b.name));

  // ---- by campaign ---------------------------------------------------------
  const campaignIds = campaigns.map((c) => c.id);
  const [issuedByCampaign, allTimeByCampaign, membersByCampaign] = await Promise.all([
    campaignIds.length
      ? scoped.pointsTransaction.groupBy({
          by: ["campaignId"],
          where: { amount: { gt: 0 }, createdAt: { gte: from }, campaignId: { in: campaignIds } },
          _sum: { amount: true },
        })
      : [],
    campaignIds.length
      ? scoped.pointsTransaction.groupBy({
          by: ["campaignId"],
          where: { amount: { gt: 0 }, campaignId: { in: campaignIds } },
          _sum: { amount: true },
        })
      : [],
    campaignIds.length
      ? scoped.pointsTransaction.groupBy({
          by: ["campaignId", "brandMembershipId"],
          where: { amount: { gt: 0 }, createdAt: { gte: from }, campaignId: { in: campaignIds } },
        })
      : [],
  ]);

  const issuedIn = new Map(issuedByCampaign.map((r) => [r.campaignId, r._sum.amount ?? 0]));
  const issuedEver = new Map(allTimeByCampaign.map((r) => [r.campaignId, r._sum.amount ?? 0]));
  const memberCount = new Map<string, number>();
  for (const row of membersByCampaign) {
    if (row.campaignId) memberCount.set(row.campaignId, (memberCount.get(row.campaignId) ?? 0) + 1);
  }

  const byCampaign: CampaignRow[] = campaigns.map((c) => {
    const ceiling = c.earnRule?.maxTotalAmount ?? null;
    const ever = issuedEver.get(c.id) ?? 0;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      unit: c.earnRule?.unit ?? null,
      issued: issuedIn.get(c.id) ?? 0,
      ceiling,
      // Measured against issued-all-time, because a ceiling is a lifetime
      // budget: a campaign three quarters spent is three quarters spent
      // whichever window you happen to be looking at. Unclamped — see the
      // note on the field.
      ceilingUsed: ceiling === null || ceiling === 0 ? null : ever / ceiling,
      members: memberCount.get(c.id) ?? 0,
    };
  });

  return {
    days,
    from,
    issued: toUnitRows(issuedRows),
    outstanding: toUnitRows(outstandingRows),
    slips: slipRows.length,
    packCodes,
    membersReached,
    newMembers,
    repeat,
    scansByDay: [...buckets.entries()].map(([key, count]) => ({ day: new Date(key), count })),
    byStore,
    byCampaign,
  };
}

/**
 * What the brand paid per person it actually reached, in cents.
 *
 * Null rather than zero when nobody was reached: dividing by nobody is not
 * a cost of nothing, it is a number that does not exist, and printing R0.00
 * there would read as "free".
 */
export function costPerMemberCents(performance: Performance): number | null {
  const cents = performance.issued.find((r) => r.unit === "CENTS")?.amount ?? 0;
  if (performance.membersReached === 0) return null;
  return Math.round(cents / performance.membersReached);
}

/** Share of people who earned more than once. Null when nobody earned. */
export function repeatRate(performance: Performance): number | null {
  const { once, twice, more } = performance.repeat;
  const total = once + twice + more;
  if (total === 0) return null;
  return (twice + more) / total;
}
