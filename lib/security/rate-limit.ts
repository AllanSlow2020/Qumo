import { prisma } from "@/lib/db/client";

/**
 * A fixed-window rate limiter whose counters live in Postgres, so every
 * instance of the app counts against the same number.
 *
 * ── What changed, and why ────────────────────────────────────────────────
 *
 * This was a Map in module scope. It said plainly that on a multi-instance
 * deployment each instance counts independently, so the effective limit is
 * (limit x instance count), and that this was a first line of defence
 * against casual abuse rather than enough on its own. That was true while
 * the app only ran on one laptop. It stops being true the moment it is
 * deployed to a platform that scales by running more copies, which is the
 * whole point of the platform it is about to be deployed to.
 *
 * So: one row per key, one statement per check, and a limit that means the
 * number it says.
 *
 * ── Why one statement ────────────────────────────────────────────────────
 *
 * The obvious implementation - read the row, decide, write it back - has a
 * race that defeats the entire feature: two requests read count = 2 against
 * a limit of 3, both decide they are allowed, both write 3. A limiter with
 * a race is a limiter an attacker can simply run in parallel, which is
 * exactly how someone brute-forcing an OTP would be attacking it.
 *
 * INSERT ... ON CONFLICT DO UPDATE is atomic in Postgres: the row is locked
 * for the duration, so concurrent callers queue rather than interleave, and
 * the count returned to each is that caller's own place in the sequence.
 * The window reset happens inside the same statement, so an expired window
 * cannot be observed by one request and reset by another in between.
 *
 * ── Failure direction ────────────────────────────────────────────────────
 *
 * If the database is unreachable this throws rather than returning
 * `allowed: true`. Failing open on a limiter that guards login would mean
 * the one moment the system is under stress is the one moment brute force
 * is unlimited. Nothing this limiter guards can work without the database
 * anyway, so failing closed costs nothing real.
 */

export type RateLimitResult = {
  allowed: boolean;
  /** Attempts left in this window once the current one is counted. */
  remaining: number;
  /** When the window rolls over, for telling a caller when to come back. */
  resetAt: Date;
};

type CounterRow = { count: number; resetAt: Date };

/**
 * Counts one attempt against `key` and says whether it is allowed.
 *
 * A blocked attempt still increments. That is deliberate: a fixed window
 * has a fixed end, so a climbing count changes nothing about when the
 * caller is let back in, and not counting blocked attempts would mean the
 * row cannot tell the difference between someone who stopped at the limit
 * and someone who is still hammering it - which is the more interesting of
 * the two to be able to see later.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  /** Injectable so a window can be expired in a test without waiting for it. */
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const resetAt = new Date(now.getTime() + windowMs);

  // $queryRaw rather than an upsert: Prisma's upsert is a read followed by
  // a write, which is the race described above. This is one statement.
  const rows = await prisma.$queryRaw<CounterRow[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"
  `;

  const row = rows[0];
  if (!row) {
    // RETURNING on a statement that always writes a row cannot come back
    // empty. If it somehow does, refuse rather than wave the caller
    // through on a counter we failed to read.
    throw new Error(`Rate limit counter returned no row for key: ${key}`);
  }

  return {
    allowed: row.count <= limit,
    remaining: Math.max(0, limit - row.count),
    resetAt: row.resetAt,
  };
}

/**
 * Deletes counters whose window has closed. Wired to the daily cron beside
 * the session sweep.
 *
 * A closed window's row is dead weight - the next check on that key resets
 * it anyway - so nothing is lost by deleting it, and leaving it means one
 * row per phone number that ever attempted a login, forever.
 */
export async function sweepExpiredRateLimits(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({ where: { resetAt: { lte: now } } });
  return count;
}
