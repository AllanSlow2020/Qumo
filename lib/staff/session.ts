import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { STAFF_SESSION_COOKIE } from "./session-cookie";

/**
 * Sessions for brand staff. Deliberately the same design as the shopper's —
 * opaque random token, only its hash stored, revocable by stamp — and
 * deliberately not the same code, because the two must never be able to
 * resolve each other's tokens.
 *
 * Sharing an implementation here would mean one function that takes a table
 * name, and one call site passing the wrong one is a privilege escalation.
 * The duplication is about sixty lines and it buys a boundary that cannot be
 * crossed by getting an argument wrong.
 */

/**
 * Twelve hours, against the shopper's thirty days.
 *
 * A shopper's session lives on their own phone and unlocks their own
 * balance. A staff session lives on whatever machine is at the desk and
 * unlocks a brand's stores, campaigns and signing secrets — including the
 * ability to rotate the secret that makes till slips forgeable. Those do not
 * deserve the same window, and a console that asks for a password each
 * morning is a normal thing to work with.
 */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** How long a dead row is kept before the sweep removes it. */
export const STAFF_SESSION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Unkeyed sha256, and correct here for the same reason it is on the shopper
 * side: the token is 32 bytes from a CSPRNG, so there is no guessable
 * preimage for a keyed hash to protect. HMAC is for low-entropy secrets —
 * the six-digit passcode in lib/consumer/otp.ts is keyed, and must be.
 */
function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export type StaffIdentity = {
  sessionId: string;
  userId: string;
  /**
   * Read from the database on every request, never from the cookie, a form
   * or a header. This is the value every tenant-scoped query is built on, so
   * the moment it can be influenced by the request, `forBrand` stops meaning
   * anything.
   */
  brandId: string;
  role: Role;
  name: string;
  email: string;
};

/** Mints a session and returns the raw token — the only time it exists. */
export async function createStaffSession(userId: string, now: Date = new Date()): Promise<string> {
  const rawToken = randomBytes(32).toString("base64url");
  await prisma.staffSession.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    },
  });
  return rawToken;
}

/**
 * Resolves a token to who is holding it, or null.
 *
 * The join onto User is not incidental. A session is only as live as the
 * account behind it, so a deactivated user's session stops working on the
 * next request rather than at its expiry — "I've removed their access" has
 * to be true when it is said, not twelve hours later.
 */
export async function resolveStaffToken(rawToken: string, now: Date = new Date()): Promise<StaffIdentity | null> {
  if (!rawToken) return null;

  const session = await prisma.staffSession.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: {
      id: true,
      revokedAt: true,
      expiresAt: true,
      user: { select: { id: true, brandId: true, role: true, name: true, email: true, isActive: true } },
    },
  });

  if (!session) return null;
  if (session.revokedAt !== null) return null;
  if (session.expiresAt <= now) return null;
  if (!session.user.isActive) return null;

  return {
    sessionId: session.id,
    userId: session.user.id,
    brandId: session.user.brandId,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
  };
}

/** The signed-in staff member for this request, from the cookie. */
export async function getStaffSession(): Promise<StaffIdentity | null> {
  const token = (await cookies()).get(STAFF_SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveStaffToken(token);
}

export async function revokeStaffSessionByToken(
  rawToken: string,
  reason: "SIGNED_OUT" | "SIGNED_OUT_EVERYWHERE" | "PASSWORD_CHANGED" | "DEACTIVATED" = "SIGNED_OUT",
  now: Date = new Date(),
): Promise<boolean> {
  // Conditioned on still being live, so a second sign-out does not overwrite
  // the reason the first one recorded.
  const result = await prisma.staffSession.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: now, revokedReason: reason },
  });
  return result.count === 1;
}

/**
 * Ends every session a staff account holds.
 *
 * Called on sign-out-everywhere, and it must also be called whenever an
 * account is deactivated or its password changes. Those two are the reason
 * this function is not just a convenience: without it, revoking someone's
 * access leaves their existing session working until it expires, which is
 * exactly the window an ex-employee needs.
 */
export async function revokeAllStaffSessions(
  userId: string,
  reason: "SIGNED_OUT_EVERYWHERE" | "PASSWORD_CHANGED" | "DEACTIVATED" = "SIGNED_OUT_EVERYWHERE",
  now: Date = new Date(),
): Promise<number> {
  const result = await prisma.staffSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now, revokedReason: reason },
  });
  return result.count;
}

/** Live sessions for one account, newest first. */
export async function listActiveStaffSessions(
  userId: string,
  now: Date = new Date(),
): Promise<{ id: string; createdAt: Date }[]> {
  return prisma.staffSession.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Deletes rows long past their expiry. Paired with the shopper sweep. */
export async function sweepExpiredStaffSessions(now: Date = new Date()): Promise<number> {
  const result = await prisma.staffSession.deleteMany({
    where: { expiresAt: { lt: new Date(now.getTime() - STAFF_SESSION_RETENTION_MS) } },
  });
  return result.count;
}
