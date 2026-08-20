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
 */
export async function getWallet(personId: string): Promise<BrandWallet[]> {
  const scoped = forPerson(personId);

  const memberships = await scoped.brandMembership.findMany({
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
};

/**
 * The ledger itself, newest first — the shopper's own audit trail. This is
 * why the ledger is immutable: every number on the wallet screen can be
 * explained by pointing at the rows that produced it.
 */
export async function getWalletHistory(personId: string, limit = 50): Promise<WalletEntry[]> {
  const rows = await forPerson(personId).pointsTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, brandId: true, amount: true, unit: true, reason: true, createdAt: true },
  });

  return rows.map((row) => ({ ...row, reason: row.reason as string }));
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
