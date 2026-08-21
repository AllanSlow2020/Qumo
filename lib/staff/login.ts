import { prisma } from "@/lib/db/client";
import { verifyPassword } from "./password";
import { createStaffSession } from "./session";

/**
 * Signing in a member of a brand's staff.
 *
 * One failure message for every way of failing, and one shape of work for
 * every way of failing. Both matter, and the second is the one people skip.
 */

/**
 * A real scrypt hash of a random string nobody knows, verified against when
 * the email does not exist.
 *
 * Without it this function returns in about a microsecond for an unknown
 * address and about a hundred milliseconds for a known one, and that gap is
 * a free membership oracle: an attacker learns which addresses belong to a
 * brand's staff without ever guessing a password, which is the list they
 * want before they start phishing. Hashing against a decoy makes both paths
 * do the same work.
 *
 * Generated once and pasted here rather than computed at module load, which
 * would put a hundred milliseconds of scrypt into every cold start to
 * protect a value that is not secret. It is a decoy; publishing it costs
 * nothing.
 */
const DECOY_HASH =
  "scrypt$32768$8$1$AJER0yOaOsHKgh1xzQVKNQ$q9F_vqVjd14fzioSWWsKu8ZZMZ6ENhpA4KWbpw_4255Hp5ilScKBlAGKk6VpWqbZAEnNk-ciz1ZQ_6pBkygG-Q";

/**
 * Deliberately vague, and identical for a wrong password, an unknown
 * address, and a deactivated account. Telling a deactivated employee that
 * their password was right confirms both the address and the password to
 * whoever is holding them.
 */
export const LOGIN_FAILED = "That email and password don't match an active account.";

export type LoginResult = { ok: true; token: string; userId: string } | { ok: false; error: string };

export async function signInStaff(
  rawEmail: string,
  password: string,
  now: Date = new Date(),
): Promise<LoginResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !password) {
    return { ok: false, error: LOGIN_FAILED };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, isActive: true },
  });

  // The decoy runs on the unknown-address path so both paths cost the same.
  const matched = await verifyPassword(password, user?.passwordHash ?? DECOY_HASH);

  if (!user || !matched || !user.isActive) {
    return { ok: false, error: LOGIN_FAILED };
  }

  const token = await createStaffSession(user.id, now);
  return { ok: true, token, userId: user.id };
}
