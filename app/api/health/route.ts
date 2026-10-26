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
 ── Why it asks twice ───────────────────────────────────────────────────
 *
 * `select 1` proves a connection and nothing else, and this shipped with
 * only that for about an hour. It was wrong in the worst direction: a
 * database that answers but has no tables returns a healthy 200 here while
 * every page in the app fails on a missing one, which is precisely the
 * outage this route was written during. A green check during an outage is
 * worse than no check, because it sends the next person looking somewhere
 * else.
 *
 * So there are two questions, reported separately because they have
 * different fixes. The connection is the network, the credentials and the
 * host. The schema is whether migrations have run. Either one failing is a
 * 503, but knowing which tells you whether to look at a connection string
 * or at a deploy step.
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

/** Rejects rather than hanging, so an unreachable host reports instead of holding the function open. */
function withTimeout<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), TIMEOUT_MS)),
  ]);
}

export async function GET(): Promise<NextResponse> {
  const started = Date.now();

  try {
    await withTimeout(prisma.$queryRaw`select 1`);
  } catch (err) {
    logger.error("health check failed to connect", { err: String(err), ms: Date.now() - started });
    return NextResponse.json({ ok: false, database: false, schema: false }, { status: 503 });
  }

  try {
    // The cheapest question that still needs the schema to exist. Brand
    // because it is the table every single page reads before it can render
    // anything: resolving which brand a host belongs to is the first query
    // of every request, so if this one is missing the site is entirely down
    // whatever else is true.
    await withTimeout(prisma.brand.count());
  } catch (err) {
    logger.error("health check found no schema", { err: String(err), ms: Date.now() - started });
    return NextResponse.json({ ok: false, database: true, schema: false }, { status: 503 });
  }

  return NextResponse.json({ ok: true, database: true, schema: true, ms: Date.now() - started });
}
