import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/security/logger";

/**
 * One URL that answers "is it the deployment or the database".
 *
 * Written after an outage where every page returned a server error and
 * telling those two apart meant reading deployment logs. The shopper-facing
 * pages cannot answer it: each one resolves its brand with a query, so a
 * database that is down and an application that is broken look identical
 * from outside, and the error page is deliberately vague about both.
 *
 * ── What it will not say ─────────────────────────────────────────────────
 *
 * No host, no port, no driver message, no version, no counts. Those are the
 * things that make a health endpoint worth probing, and none of them help
 * the person who needs this: they already know which deployment they are
 * looking at, and the detail is in the log this writes. What comes back is
 * whether the database answered, and nothing else.
 *
 * Unauthenticated on purpose. A secret here would be one more thing to have
 * configured correctly before you can find out why nothing is configured
 * correctly, and the single bit it returns is not worth protecting. It is
 * the same "public URL" shape as the cron and webhook routes, minus the
 * shared secret, because there is nothing behind it to protect.
 */

/** Long enough for a cold connection, short enough not to hold a function open. */
const TIMEOUT_MS = 5000;

// Never cached or prerendered: a cached health check is a health check that
// reports the state of the last build rather than of right now, which is
// worse than not having one.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const started = Date.now();

  try {
    // The cheapest possible round trip. Deliberately not a count or a table
    // read: this is asking whether the connection works, and a query that
    // depends on a migration having run would conflate two different
    // failures.
    await Promise.race([
      prisma.$queryRaw`select 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), TIMEOUT_MS)),
    ]);
  } catch (err) {
    // The detail goes here, where it is already going for every other
    // failure, and not into the response.
    logger.error("health check failed", { err: String(err), ms: Date.now() - started });
    return NextResponse.json({ ok: false, database: false }, { status: 503 });
  }

  return NextResponse.json({ ok: true, database: true, ms: Date.now() - started });
}
