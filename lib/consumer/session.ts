import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { ShopperSessionRevokeReason } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { CONSUMER_SESSION_COOKIE } from "./session-cookie";

/**
 * Shopper sessions, kept deliberately separate from staff sessions.
 *
 * Staff auth is NextAuth (lib/auth/config.ts) and every staff session
 * carries brandId and role — the two values the tenant guard trusts to
 * decide what a request may see. A shopper is a fundamentally different
 * principal: a Person, belonging to no brand, who may hold memberships at
 * several. Putting both through one session mechanism would mean one
 * decoding mistake could present a shopper as staff with some brandId
 * attached, which is the worst failure this system has. Two cookies, two
 * secrets-in-effect, two verification paths, and no code that reads one
 * can accidentally accept the other.
 *
 * ── What changed, and why ────────────────────────────────────────────────
 *
 * This was a stateless signed token: `personId.expiresAt.hmac`, verified
 * with arithmetic and no database read. It said plainly that it had no
 * revocation list, so a stolen cookie stayed valid for its full 30 days,
 * and that this was acceptable *only* while a shopper session could do
 * nothing but read balances and history — to be revisited before it could
 * spend a wallet balance.
 *
 * It then became able to spend one, and the note did not get revisited.
 * This is that revisit. A stolen cookie could generate spend codes against
 * a real balance for a month with nothing anyone could do about it, and
 * "sign out" cleared the thief's victim's cookie, not the thief's.
 *
 * So: an opaque random token, a row per session, and a check on every
 * request. The costs are real and worth naming — one indexed SELECT on
 * every shopper page render, and a table that needs sweeping
 * (sweepExpiredSessions, wired to a daily cron). What it buys is that
 * "sign out" and "sign out everywhere" now actually end a session for
 * whoever holds the cookie, which is the only version of those words that
 * means anything.
 *
 * The token carries no claims. There is no personId to swap and no expiry
 * to extend, because both now live in a row that the holder of the cookie
 * cannot reach — the class of attack the old token's tests were mostly
 * about simply does not exist in this shape.
 */

export { CONSUMER_SESSION_COOKIE } from "./session-cookie";

/**
 * Not routed through forBrand() or forPerson(): a session is looked up by
 * its token before any person context exists — that lookup is how the
 * person is established. The same narrow, already-documented exception
 * that PasswordResetToken and the User-by-email lookup at login take. Every
 * *other* query here names an explicit personId supplied by an already
 * verified session.
 *
 * ShopperSession is deliberately absent from TENANT_SCOPED_MODELS: it has
 * no brandId, belongs to no tenant, and a brand has no business reading one.
 */

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * How long a dead session's row is kept before the sweep deletes it. Long
 * enough that "when did this session end, and was it me who ended it?" can
 * still be answered after a shopper notices something wrong weeks later;
 * short enough that the table is not an indefinite log of someone's
 * sign-in history.
 */
export const SESSION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * 32 random bytes. Unkeyed sha256 is correct here for the same reason it
 * is correct for a password reset token and wrong for a 6-digit OTP: with
 * 256 bits of entropy there is no keyspace to walk, so keying the digest
 * would protect against nothing. hashOtpCode() explains the other side of
 * that argument (lib/security/crypto.ts).
 */
function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Creates a session row and returns the raw token — the only moment it
 * exists in plaintext anywhere. Only its hash is stored.
 */
export async function createSession(personId: string, now: Date = new Date()): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  await prisma.shopperSession.create({
    data: {
      personId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    },
  });
  return rawToken;
}

/** Who a live token belongs to, and which session it is. */
export type SessionIdentity = { sessionId: string; personId: string };

/**
 * Resolves a token to a live session, or null for anything that fails —
 * unknown, revoked, expired or malformed. Callers get no detail about
 * which, because none of them can act on the difference and the difference
 * is exactly what someone probing stolen cookies would like to learn.
 */
export async function resolveSessionToken(rawToken: string, now: Date = new Date()): Promise<SessionIdentity | null> {
  if (!rawToken) {
    return null;
  }

  // No length or shape check first: the query is an index lookup on a hash
  // of whatever arrived, so a malformed token is simply a hash that matches
  // no row. Validating the format beforehand would add a branch that can
  // disagree with the hashing, and answer nothing the lookup does not.
  const session = await prisma.shopperSession.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { id: true, personId: true, expiresAt: true, revokedAt: true },
  });

  if (!session || session.revokedAt !== null || session.expiresAt <= now) {
    return null;
  }
  return { sessionId: session.id, personId: session.personId };
}

/** The personId behind a live token, or null. */
export async function verifySessionToken(rawToken: string, now: Date = new Date()): Promise<string | null> {
  return (await resolveSessionToken(rawToken, now))?.personId ?? null;
}

/** Signs a shopper in on this device. */
export async function setConsumerSession(personId: string): Promise<void> {
  const rawToken = await createSession(personId);
  const store = await cookies();
  store.set(CONSUMER_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

/**
 * The signed-in shopper and the session they are using, or null.
 *
 * The sessionId is what lets the wallet screen say "this device" against
 * one row in the list. Worth having because the alternative ways to tell
 * two sessions apart — user-agent, IP — are personal data this product
 * does not collect, and a list of identical-looking rows is not something
 * anyone can act on.
 */
export async function getConsumerSessionDetail(): Promise<SessionIdentity | null> {
  const store = await cookies();
  const token = store.get(CONSUMER_SESSION_COOKIE)?.value;
  return token ? resolveSessionToken(token) : null;
}

/** The personId of the signed-in shopper, or null. */
export async function getConsumerSession(): Promise<string | null> {
  return (await getConsumerSessionDetail())?.personId ?? null;
}

/**
 * Revokes one session by its token. Idempotent, and scoped to live rows so
 * a second sign-out cannot overwrite the reason the first one recorded.
 */
export async function revokeSessionByToken(
  rawToken: string,
  reason: ShopperSessionRevokeReason = ShopperSessionRevokeReason.SIGNED_OUT,
  now: Date = new Date(),
): Promise<boolean> {
  const result = await prisma.shopperSession.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: now, revokedReason: reason },
  });
  return result.count > 0;
}

/**
 * Ends every live session this person has, on every device, and returns
 * how many. This is the button that matters: the one a shopper presses
 * after losing a phone, and the only way to evict a cookie that somebody
 * else is holding.
 */
export async function revokeAllSessions(
  personId: string,
  reason: ShopperSessionRevokeReason = ShopperSessionRevokeReason.SIGNED_OUT_EVERYWHERE,
  now: Date = new Date(),
): Promise<number> {
  const result = await prisma.shopperSession.updateMany({
    where: { personId, revokedAt: null, expiresAt: { gt: now } },
    data: { revokedAt: now, revokedReason: reason },
  });
  return result.count;
}

/** Live sessions for a person, newest first — what the wallet screen shows. */
export async function listActiveSessions(
  personId: string,
  now: Date = new Date(),
): Promise<{ id: string; createdAt: Date }[]> {
  return prisma.shopperSession.findMany({
    where: { personId, revokedAt: null, expiresAt: { gt: now } },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Signs out of this device only, and clears the cookie. */
export async function clearConsumerSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(CONSUMER_SESSION_COOKIE)?.value;
  if (token) {
    // Revoke before clearing. The other order would delete the only copy of
    // the token this request has and leave the row live forever — a session
    // nobody can see and nobody can end.
    await revokeSessionByToken(token);
  }
  store.delete(CONSUMER_SESSION_COOKIE);
}

/**
 * Deletes rows that expired more than SESSION_RETENTION_MS ago. Called by
 * the daily cron (app/api/cron/sweep-sessions).
 *
 * Keyed on expiresAt rather than revokedAt so one condition covers both
 * ways a session dies. A revoked session keeps its original expiry, so it
 * is swept on the same schedule as one that simply lapsed — and a row is
 * never deleted while it could still be the answer to "is this cookie
 * valid?", because an unexpired row is never in range.
 */
export async function sweepExpiredSessions(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SESSION_RETENTION_MS);
  const result = await prisma.shopperSession.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  return result.count;
}
