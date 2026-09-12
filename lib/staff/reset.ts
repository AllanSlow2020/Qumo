import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { CONSOLE_SUBDOMAIN, ROOT_DOMAIN } from "@/lib/brand/host";
import { getEmailClient, type EmailClient } from "@/lib/email/client";
import { hashPassword } from "@/lib/staff/password";
import { revokeAllStaffSessions } from "@/lib/staff/session";
import { logger } from "@/lib/security/logger";
import { PRODUCT_NAME } from "@/lib/product";

/**
 * The way back in when a staff member forgets their password.
 *
 * An owner could already reset a colleague, so the hole this fills is
 * narrower and worse than it sounds: the *only* owner of a brand, locked
 * out, had nobody who could help them. The console has no path back, and
 * the alternative was somebody with a database connection.
 *
 * ── What it will not tell a stranger ─────────────────────────────────────
 *
 * requestReset() behaves identically for an address that has an account and
 * one that does not: same work, same answer, same timing to within the cost
 * of one email. A "no such account" message here would turn the console
 * login into a way to ask which of a list of people work for which brand,
 * which is exactly the question lib/consumer/otp.ts refuses to answer on
 * the shopper side and for the same reason.
 *
 * ── Why the token is hashed ──────────────────────────────────────────────
 *
 * The row is a live account takeover until it expires. Stored as a SHA-256
 * of the value in the link, so a database dump is a list of useless hashes,
 * exactly as sessions and one-time passcodes already are. 32 random bytes,
 * so there is no keyspace to walk and no attempt counter needed.
 */

/** Long enough to find the email, short enough that a forwarded one goes stale. */
const RESET_TTL_MS = 60 * 60 * 1000;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function consoleOrigin(): string {
  const local = ROOT_DOMAIN.split(":")[0] === "localhost";
  const port = local && !ROOT_DOMAIN.includes(":") ? ":3000" : "";
  return `${local ? "http" : "https"}://${CONSOLE_SUBDOMAIN}.${ROOT_DOMAIN}${port}`;
}

/**
 * Issues a reset and emails it, or does nothing at all, and the caller
 * cannot tell which.
 *
 * Returns void deliberately. A boolean would be the account-existence
 * signal the whole design is avoiding, and the first caller in a hurry
 * would render it.
 */
export async function requestReset(
  rawEmail: string,
  now: Date = new Date(),
  email: EmailClient = getEmailClient(),
): Promise<void> {
  const address = rawEmail.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: address },
    select: { id: true, isActive: true, name: true },
  });

  // A deactivated account gets nothing. Letting somebody reset their way
  // back into an account an owner switched off would make deactivation
  // advisory.
  if (!user || !user.isActive) {
    logger.info("password reset requested for no usable account");
    return;
  }

  const rawToken = randomBytes(32).toString("hex");

  await prisma.$transaction(async (tx) => {
    // Every older outstanding reset dies now. Two live links means a stale
    // one read off an old email still works, which is the thing somebody
    // requesting a second reset is usually trying to escape.
    await tx.staffPasswordReset.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: now },
    });
    await tx.staffPasswordReset.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(now.getTime() + RESET_TTL_MS),
      },
    });
  });

  const link = `${consoleOrigin()}/reset?token=${rawToken}`;
  await email.send({
    to: address,
    subject: `Reset your ${PRODUCT_NAME} password`,
    text: [
      `Hello ${user.name},`,
      "",
      `Someone asked to reset the password for your ${PRODUCT_NAME} console account.`,
      "Open this link to choose a new one. It works once and expires in an hour.",
      "",
      link,
      "",
      "If this wasn't you, nothing has changed and you can ignore this. Your",
      "current password still works, and whoever asked did not learn anything",
      "about your account.",
    ].join("\n"),
  });

  logger.info("password reset sent", { userId: user.id });
}

export type ResetOutcome = { ok: true } | { ok: false; reason: "INVALID" | "WEAK" };

/**
 * Spends a reset and sets the new password.
 *
 * The update is conditional on the row still being unspent, so two requests
 * racing the same link cannot both succeed - the second updates zero rows
 * and is refused. Same compare-and-swap the OTP verification uses.
 */
export async function completeReset(
  rawToken: string,
  newPassword: string,
  now: Date = new Date(),
): Promise<ResetOutcome> {
  // Checked before the token is looked up, so a caller learns nothing about
  // the token from being told their password is too short.
  if (newPassword.length < 12) {
    return { ok: false, reason: "WEAK" };
  }

  const reset = await prisma.staffPasswordReset.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { id: true, userId: true, expiresAt: true, consumedAt: true },
  });

  // One answer for unknown, spent and expired. A caller cannot act on the
  // difference, and the difference is what somebody probing old links would
  // like to learn.
  if (!reset || reset.consumedAt || reset.expiresAt <= now) {
    return { ok: false, reason: "INVALID" };
  }

  const passwordHash = await hashPassword(newPassword);

  const spent = await prisma.staffPasswordReset.updateMany({
    where: { id: reset.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (spent.count === 0) {
    return { ok: false, reason: "INVALID" };
  }

  await prisma.user.update({
    where: { id: reset.userId },
    data: {
      passwordHash,
      // They have just chosen it, so the first-sign-in gate is satisfied.
      // Leaving it set would send somebody who just set a password straight
      // to a screen asking them to set one.
      mustChangePassword: false,
    },
  });

  // Everywhere, including wherever the person who locked them out is. A
  // reset that left existing sessions alive would be a password change that
  // did not end the thing it was changed because of.
  await revokeAllStaffSessions(reset.userId, "PASSWORD_CHANGED");

  logger.info("password reset completed", { userId: reset.userId });
  return { ok: true };
}

/** Rows well past their expiry, swept like the session and rate-limit tables. */
export async function sweepExpiredResets(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.staffPasswordReset.deleteMany({
    where: { expiresAt: { lt: new Date(now.getTime() - RESET_TTL_MS) } },
  });
  return count;
}
