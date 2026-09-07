import { headers } from "next/headers";
import { rateLimit } from "./rate-limit";

/**
 * A per-client cap on login attempts, sitting in front of both sign-in
 * surfaces.
 *
 * ── Why this is not in the proxy any more ────────────────────────────────
 *
 * It used to be. The proxy runs in the Edge runtime, where there is no
 * database connection, so the only limiter available there was an
 * in-process Map — the very thing that made the limit meaningless across
 * instances. Keeping the check at the edge would have meant keeping the
 * counter that cannot be shared, so the check moved to where the shared
 * counter can be read.
 *
 * What is lost: a blocked request now reaches the server action instead of
 * being refused at the edge. That costs one function invocation and buys a
 * limit that means the number it says, which is the right trade for an
 * auth endpoint. What is gained beyond correctness: this guards the
 * *submission* rather than the page load, so someone reading a login page
 * twenty-one times in a minute is no longer treated as an attacker.
 *
 * ── How it relates to the other limits ───────────────────────────────────
 *
 * Three limits guard shopper login and they are deliberately keyed
 * differently, because each defeats an attack the others do not:
 *
 *   - this one, per client address, stops one machine working through many
 *     phone numbers;
 *   - the send and verify limits in lib/consumer/otp.ts, per phone hash,
 *     stop an attacker rotating addresses to keep hammering one number;
 *   - the per-code attempt cap, per issued code, stops a million-value
 *     keyspace being walked one guess at a time.
 *
 * An attacker who defeats one still meets the other two.
 */

const LOGIN_LIMIT = 20;
const LOGIN_WINDOW_MS = 60_000;

/**
 * The caller's address, as reported by the proxy in front of us.
 *
 * `x-forwarded-for` is client-controlled on a server reachable directly,
 * and only trustworthy because Vercel overwrites it at the edge. The first
 * entry is the original client; the rest are proxies. Falling back to a
 * single "unknown" bucket is deliberate: if the header is missing then
 * every such request shares one allowance, which fails towards refusing
 * rather than towards a free pass.
 */
async function clientKey(): Promise<string> {
  const forwardedFor = (await headers()).get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

/**
 * True when this attempt may proceed. `scope` separates the two sign-in
 * surfaces so a shopper hammering their own login cannot lock a brand's
 * staff out of the console.
 */
export async function loginAttemptAllowed(scope: "shopper" | "staff"): Promise<boolean> {
  const { allowed } = await rateLimit(`login:${scope}:${await clientKey()}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  return allowed;
}

/** Shown on both surfaces, and says the one thing the person can act on. */
export const TOO_MANY_ATTEMPTS = "Too many attempts. Please wait a minute and try again.";
