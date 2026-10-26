import { timingSafeEqual } from "node:crypto";

/**
 * The guard on every scheduled route.
 *
 * Vercel Cron attaches `Authorization: Bearer $CRON_SECRET`. With
 * CRON_SECRET unset nothing can match and the route always refuses, which
 * is the safe direction for a URL whose whole purpose is deleting rows.
 *
 * Shared rather than copied. It was inline in the one cron route that
 * existed, and the second one would have been a second copy of a constant
 * time comparison - the kind of duplicate that stays correct until one side
 * is changed.
 */
export function cronRequestIsAuthorised(suppliedHeader: string | null, expected: string | undefined): boolean {
  if (!expected || !suppliedHeader) return false;
  const a = Buffer.from(suppliedHeader);
  const b = Buffer.from(`Bearer ${expected}`);
  /*
   * Constant time, like every other secret comparison in this repo.
   *
   * `!==` on strings stops at the first differing byte, which in principle
   * hands the secret over one character at a time. Hard to exploit across a
   * network and completely free to avoid.
   *
   * Length is checked first because timingSafeEqual throws on a mismatch,
   * and a length difference is not something worth hiding anyway.
   */
  return a.length === b.length && timingSafeEqual(a, b);
}
