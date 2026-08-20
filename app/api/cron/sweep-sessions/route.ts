import { NextRequest, NextResponse } from "next/server";
import { sweepExpiredSessions } from "@/lib/consumer/session";
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
 * Guarded like the digest route — Vercel Cron attaches
 * `Authorization: Bearer $CRON_SECRET`. With CRON_SECRET unset no header
 * can match and this always 401s, which is the safe direction for a URL
 * whose whole purpose is deleting rows.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const deleted = await sweepExpiredSessions();

  logger.info("session sweep: run complete", { deleted });
  return NextResponse.json({ deleted });
}
