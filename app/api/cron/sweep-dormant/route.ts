import { NextRequest, NextResponse } from "next/server";
import { sweepDormantShoppers } from "@/lib/consumer/dormancy";
import { cronRequestIsAuthorised } from "@/lib/security/cron-auth";
import { logger } from "@/lib/security/logger";

/**
 * Erases shoppers who have shown no sign of life for the configured window.
 * Scheduled daily in vercel.json, and inert until somebody sets that window
 * - see lib/consumer/dormancy.ts.
 *
 * Its own route rather than a step inside sweep-sessions, following that
 * file's own argument and for a much stronger version of its reason. Those
 * sweeps delete expired sessions, spent passcodes and lapsed rate limits:
 * rows nothing can read any more. This one destroys people's phone numbers,
 * irreversibly. Different job, different blast radius, and a failure in
 * either must not be able to stop or mask the other.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!cronRequestIsAuthorised(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await sweepDormantShoppers();
  if (!result.ran) {
    // Logged at info rather than passed over in silence. "The retention
    // sweep has quietly done nothing for a year" is the exact failure this
    // whole piece of work is about.
    logger.info("dormancy sweep: not run", { reason: result.reason });
    return NextResponse.json(result);
  }

  return NextResponse.json({ ran: true, erased: result.erased, cutoff: result.cutoff.toISOString() });
}
