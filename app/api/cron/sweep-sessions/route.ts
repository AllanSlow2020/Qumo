import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sweepExpiredSessions } from "@/lib/consumer/session";
import { sweepExpiredRateLimits } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

/**
 * Deletes shopper session rows long past their expiry. Scheduled daily in
 * vercel.json.
 *
 * Its own route rather than a step inside the weekly digest: the digest
 * emails every brand's owners and can fail for reasons of its own, and a
 * retention sweep that silently stops running because an unrelated mail
 * send threw is exactly the kind of failure nobody notices for a year.
 * Different job, different cadence, different blast radius.
 *
 * Guarded like the digest route - Vercel Cron attaches
 * `Authorization: Bearer $CRON_SECRET`. With CRON_SECRET unset no header
 * can match and this always 401s, which is the safe direction for a URL
 * whose whole purpose is deleting rows.
 */
/**
 * Constant time, like every other secret comparison in this repo.
 *
 * `!==` on strings stops at the first differing byte, which in principle
 * hands the secret over one character at a time. Hard to exploit across a
 * network and completely free to avoid - and the inconsistency was the real
 * finding: every other comparison of a secret here already does this.
 */
function secretMatches(supplied: string | null, expected: string): boolean {
  if (!supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(`Bearer ${expected}`);
  // Length is checked first because timingSafeEqual throws on a mismatch,
  // and a length difference is not something worth hiding anyway.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected || !secretMatches(request.headers.get("authorization"), expected)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Two sweeps, one job, because they are the same job: rows kept only
  // until a window or a session closes. Sequential rather than
  // Promise.all - a cron has no deadline worth racing for, and a failure
  // in one should not leave the other's outcome ambiguous.
  const deleted = await sweepExpiredSessions();
  const rateLimitsDeleted = await sweepExpiredRateLimits();

  logger.info("session sweep: run complete", { deleted, rateLimitsDeleted });
  return NextResponse.json({ deleted, rateLimitsDeleted });
}
