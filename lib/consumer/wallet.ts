import type { LedgerUnit } from "@prisma/client";
import { forPerson } from "./scope";

/**
 * A shopper's balances, derived — always — by summing the ledger.
 *
 * There is no balance column anywhere in this file's reach, and there must
 * never be one. The schema comment on PointsTransaction already commits to
 * this for points; carrying cents makes it non-negotiable, because a
 * stored balance that drifts from the transactions behind it is not just
 * wrong, it is unauditable, and with money involved that is the difference
 * between a bug and a dispute nobody can settle.
 *
 * Balances are grouped per (brand, unit) and never summed across either.
 * Across brands because the wallet is closed-loop: value earned at one
 * brand spends only there, so a combined total would be a number the
 * shopper can never actually use. Across units because adding cents to
 * stamps is nonsense.
 */

export type UnitBalance = {
  unit: LedgerUnit;
  /** Points and stamps are counts; cents are cents. Never a float. */
  amount: number;
};

export type BrandWallet = {
  brandId: string;
  brandName: string;
  brandSlug: string;
  joinedAt: Date;
  balances: UnitBalance[];
};

/**
 * Every brand this shopper holds a membership with, and what they have
 * with each. Brands they have never interacted with do not appear —
 * membership is created by a first scan, not by signing up.
 *
 * `brandId` narrows it to one, which is what every shopper-facing screen
 * now passes: a shopper on chicken-licken.qumo.co.za is on Chicken Licken's
 * site and should not be shown that they also drink Campari. The unfiltered
 * form survives for the one caller entitled to the whole picture — the
 * shopper's own data export, where withholding it would answer a different
 * question than the one the law says they asked.
 */
export async function getWallet(personId: string, brandId?: string): Promise<BrandWallet[]> {
  const scoped = forPerson(personId);

  const memberships = await scoped.brandMembership.findMany({
    where: brandId ? { brandId } : undefined,
    include: { brand: { select: { id: true, name: true, slug: true } } },
    orderBy: { joinedAt: "asc" },
  });

  if (memberships.length === 0) {
    return [];
  }

  // One grouped SUM for every brand at once, rather than a query per
  // membership — a shopper with a dozen brands should still be one round
  // trip. The scope filter is injected by forPerson(); this cannot see
  // another person's rows even if brandMembershipId were wrong.
  const sums = await scoped.pointsTransaction.groupBy({
    by: ["brandMembershipId", "unit"],
    // Narrowed by membership rather than by brandId, so the sums can only
    // ever come from rows belonging to the memberships listed above. A
    // brandId filter would give the same answer today and stop giving it the
    // moment a row's brandId and its membership's brandId disagree.
    where: { brandMembershipId: { in: memberships.map((m) => m.id) } },
    _sum: { amount: true },
  });

  const byMembership = new Map<string, UnitBalance[]>();
  for (const row of sums) {
    const list = byMembership.get(row.brandMembershipId) ?? [];
    // A unit that has only ever netted to zero is still a real balance to
    // show — "0 stamps" is information, an absent row is confusing.
    list.push({ unit: row.unit, amount: row._sum.amount ?? 0 });
    byMembership.set(row.brandMembershipId, list);
  }

  return memberships.map((membership) => ({
    brandId: membership.brand.id,
    brandName: membership.brand.name,
    brandSlug: membership.brand.slug,
    joinedAt: membership.joinedAt,
    balances: (byMembership.get(membership.id) ?? []).sort((a, b) => a.unit.localeCompare(b.unit)),
  }));
}

export type WalletEntry = {
  id: string;
  brandId: string;
  amount: number;
  unit: LedgerUnit;
  reason: string;
  createdAt: Date;
  /** The store this happened at, when it happened at one. */
  storeName: string | null;
  /** What the basket came to, for a row that came from a till slip. */
  amountCents: number | null;
  /** The promotion that produced it, when the row records one. */
  campaignName: string | null;
};

/**
 * The ledger itself, newest first — the shopper's own audit trail. This is
 * why the ledger is immutable: every number on the wallet screen can be
 * explained by pointing at the rows that produced it.
 *
 * "Explained" is the operative word, and a reason code is not an
 * explanation. A row reading "Purchase · 4 Sept · +R8.50" gives a shopper
 * nothing to check it against; "Sea Point · 4 Sept · R170.00 basket" is a
 * thing they either remember doing or do not, which is the whole point of
 * showing them a history. So the store and the basket come back with it.
 *
 * Both are reached through the scan rather than copied onto the ledger row,
 * so there is one answer to "where did this happen" and it cannot drift
 * from the scan that decided it. Both are null for the paths with no till
 * behind them — a pack code, a card completion arriving without its scan —
 * and the caller falls back rather than inventing one.
 */
export async function getWalletHistory(personId: string, limit = 50, brandId?: string): Promise<WalletEntry[]> {
  const rows = await forPerson(personId).pointsTransaction.findMany({
    where: brandId ? { brandId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      brandId: true,
      amount: true,
      unit: true,
      reason: true,
      createdAt: true,
      // Safe to reach through without a scope filter of its own: the row it
      // hangs off has already been narrowed to this person by forPerson(),
      // so the only scan reachable here is one of theirs.
      purchaseScan: { select: { amountCents: true, store: { select: { name: true } } } },
      campaign: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    brandId: row.brandId,
    amount: row.amount,
    unit: row.unit,
    reason: row.reason as string,
    createdAt: row.createdAt,
    storeName: row.purchaseScan?.store.name ?? null,
    amountCents: row.purchaseScan?.amountCents ?? null,
    campaignName: row.campaign?.name ?? null,
  }));
}

/**
 * Formats a ledger amount for display in its own unit. Cents become rands
 * here and nowhere else — the value stays an integer everywhere it is
 * stored, summed or compared, and only becomes "R4.25" at the edge.
 */
export function formatLedgerAmount(amount: number, unit: LedgerUnit): string {
  switch (unit) {
    case "CENTS": {
      const sign = amount < 0 ? "-" : "";
      const abs = Math.abs(amount);
      return `${sign}R${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
    }
    case "STAMPS":
      return `${amount} ${Math.abs(amount) === 1 ? "stamp" : "stamps"}`;
    case "POINTS":
    default:
      return `${amount} ${Math.abs(amount) === 1 ? "point" : "points"}`;
  }
}
