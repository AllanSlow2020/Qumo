import { NextRequest, NextResponse } from "next/server";
import { sweepExpiredSessions } from "@/lib/consumer/session";
import { sweepExpiredPasscodes } from "@/lib/consumer/otp";
import { sweepExpiredRateLimits } from "@/lib/security/rate-limit";
import { sweepExpiredResets } from "@/lib/staff/reset";
import { cronRequestIsAuthorised } from "@/lib/security/cron-auth";
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
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!cronRequestIsAuthorised(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Two sweeps, one job, because they are the same job: rows kept only
  // until a window or a session closes. Sequential rather than
  // Promise.all - a cron has no deadline worth racing for, and a failure
  // in one should not leave the other's outcome ambiguous.
  const deleted = await sweepExpiredSessions();
  const rateLimitsDeleted = await sweepExpiredRateLimits();
  // Same family: a row kept only until a window closes. A spent or expired
  // reset is useless, and keeping it is keeping a record of who forgot their
  // password and when.
  const resetsDeleted = await sweepExpiredResets();
  // The fourth of the same family, and the one that was missing: PhoneOtp
  // had no sweep at all, so every passcode ever sent was still on disk -
  // a permanent log of when each number asked to sign in, kept past any
  // purpose. See OTP_RETENTION_MS.
  const passcodesDeleted = await sweepExpiredPasscodes();

  logger.info("session sweep: run complete", {
    deleted,
    rateLimitsDeleted,
    resetsDeleted,
    passcodesDeleted,
  });
  return NextResponse.json({ deleted, rateLimitsDeleted, resetsDeleted, passcodesDeleted });
}
