import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import { record } from "@/lib/audit/record";
import type { Actor } from "./actor";
import { revokeAllStaffSessions } from "./session";
import { generateTotpSecret, otpauthUrl, totpStep, verifyTotp } from "./totp";
import { verifyPassword } from "./password";

/**
 * Enrolling, using and removing a staff second factor.
 *
 * Everything here is a person acting on their own account. There is
 * deliberately no "turn on MFA for someone else" and no "reset someone's
 * MFA": an owner who could clear a colleague's second factor could also
 * take their account, which puts the factor back where it started. The way
 * back in for a lost phone is a recovery code the person already holds, and
 * if those are gone too the answer is a deliberate, logged intervention
 * rather than a button.
 */

export class MfaError extends Error {}

export const RECOVERY_CODE_COUNT = 10;

/**
 * Codes people read off a screen and type into a phone, so no characters
 * that look like each other. Ten of them, at 32^10 each — the count is the
 * usability decision and the length is the security one.
 */
const RECOVERY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const RECOVERY_LENGTH = 10;

function generateRecoveryCode(): string {
  const bytes = randomBytes(RECOVERY_LENGTH);
  let out = "";
  for (let i = 0; i < RECOVERY_LENGTH; i += 1) {
    out += RECOVERY_ALPHABET[bytes[i]! % RECOVERY_ALPHABET.length];
  }
  return out;
}

/** Normalised before hashing, so spacing and case cannot cause a false refusal. */
export function normaliseRecoveryCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normaliseRecoveryCode(code)).digest("hex");
}

export type EnrolmentOffer = {
  /** Base32, for an app to scan or a person to type. Not yet in effect. */
  secret: string;
  otpauthUrl: string;
};

/**
 * Step one: mint a secret and hand it back.
 *
 * The secret is stored immediately but `totpConfirmedAt` stays null, so
 * nothing about signing in changes yet. Storing it before it is confirmed is
 * what lets the confirm step work at all without holding a secret in a
 * session or a form field, and an unconfirmed secret is inert — every check
 * that matters reads totpConfirmedAt, not the secret's presence.
 */
export async function beginEnrolment(actor: Actor, issuer: string): Promise<EnrolmentOffer> {
  const user = await prisma.user.findUnique({
    where: { id: actor.user.id },
    select: { email: true, totpConfirmedAt: true },
  });
  if (!user) {
    throw new MfaError("That account no longer exists.");
  }
  if (user.totpConfirmedAt) {
    throw new MfaError("Two-factor authentication is already on for this account.");
  }

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: actor.user.id },
    data: { totpSecretEncrypted: encryptSecret(secret), totpLastStep: null },
  });

  return { secret, otpauthUrl: otpauthUrl(secret, user.email, issuer) };
}

/**
 * Step two: prove the app works, and get the recovery codes.
 *
 * Confirmation requires a code from the app. Enrolment that trusted the
 * generation step would lock out anybody whose scan silently failed, which
 * is the most common way a second factor goes wrong and the least
 * recoverable.
 */
export async function confirmEnrolment(
  actor: Actor,
  code: string,
  now: Date = new Date(),
): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: actor.user.id },
    select: { totpSecretEncrypted: true, totpConfirmedAt: true },
  });
  if (!user?.totpSecretEncrypted) {
    throw new MfaError("Start again — there's no pending setup for this account.");
  }
  if (user.totpConfirmedAt) {
    throw new MfaError("Two-factor authentication is already on for this account.");
  }

  const verified = verifyTotp(decryptSecret(user.totpSecretEncrypted), code, now);
  if (!verified.ok) {
    throw new MfaError("That code didn't match. Check your phone's clock and try the next one.");
  }

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.user.id },
      data: { totpConfirmedAt: now, totpLastStep: verified.step },
    });
    // Any codes from an abandoned earlier attempt go, so the set on screen
    // is the whole set that works.
    await tx.staffRecoveryCode.deleteMany({ where: { userId: actor.user.id } });
    await tx.staffRecoveryCode.createMany({
      data: codes.map((c) => ({ userId: actor.user.id, codeHash: hashRecoveryCode(c) })),
    });
  });

  await record(prisma, actor.user, { action: "user.mfa_enabled", targetId: actor.user.id });

  return codes;
}

/**
 * Turning it off, which requires the current password.
 *
 * Without that, an unattended open console is enough to strip the factor
 * off the account and walk away with a password-only login — the same
 * reasoning that makes changeOwnPassword ask for the current one.
 */
export async function disableMfa(actor: Actor, password: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: actor.user.id },
    select: { passwordHash: true, totpConfirmedAt: true },
  });
  if (!user?.totpConfirmedAt) {
    throw new MfaError("Two-factor authentication isn't on for this account.");
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new MfaError("That password isn't right.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.user.id },
      data: { totpSecretEncrypted: null, totpConfirmedAt: null, totpLastStep: null },
    });
    await tx.staffRecoveryCode.deleteMany({ where: { userId: actor.user.id } });
  });

  await record(prisma, actor.user, { action: "user.mfa_disabled", targetId: actor.user.id });
}

/** Fresh codes, invalidating every old one. Shown once, like the first set. */
export async function regenerateRecoveryCodes(actor: Actor, password: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: actor.user.id },
    select: { passwordHash: true, totpConfirmedAt: true },
  });
  if (!user?.totpConfirmedAt) {
    throw new MfaError("Two-factor authentication isn't on for this account.");
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new MfaError("That password isn't right.");
  }

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  await prisma.$transaction(async (tx) => {
    await tx.staffRecoveryCode.deleteMany({ where: { userId: actor.user.id } });
    await tx.staffRecoveryCode.createMany({
      data: codes.map((c) => ({ userId: actor.user.id, codeHash: hashRecoveryCode(c) })),
    });
  });

  await record(prisma, actor.user, { action: "user.recovery_codes_regenerated", targetId: actor.user.id });
  return codes;
}

export type SecondFactorState = {
  enabled: boolean;
  /** How many recovery codes are still unused — the number worth acting on. */
  recoveryCodesLeft: number;
};

export async function getSecondFactorState(userId: string): Promise<SecondFactorState> {
  const [user, left] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { totpConfirmedAt: true } }),
    prisma.staffRecoveryCode.count({ where: { userId, usedAt: null } }),
  ]);
  return { enabled: Boolean(user?.totpConfirmedAt), recoveryCodesLeft: left };
}

/**
 * The check the login path makes, once a password has already matched.
 *
 * Accepts a TOTP code or a recovery code, and consumes whichever it was:
 * a TOTP by recording its step so it cannot be replayed inside its own
 * window, a recovery code by marking it used. Both are compare-and-swap
 * against the row, so two requests racing with the same code cannot both
 * win.
 */
export async function consumeSecondFactor(
  userId: string,
  code: string,
  now: Date = new Date(),
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecretEncrypted: true, totpConfirmedAt: true, totpLastStep: true },
  });
  if (!user?.totpConfirmedAt || !user.totpSecretEncrypted) {
    // Nothing to check. The caller decides whether that is a pass or a
    // programming error; here it is simply not a second factor.
    return false;
  }

  const totp = verifyTotp(decryptSecret(user.totpSecretEncrypted), code, now);
  if (totp.ok) {
    if (user.totpLastStep !== null && totp.step <= user.totpLastStep) {
      // Already used. A code lives across a three-step window, so without
      // this it stays usable for up to ninety seconds after somebody reads
      // it over a shoulder.
      return false;
    }
    const claimed = await prisma.user.updateMany({
      where: {
        id: userId,
        // Compare-and-swap: whichever request writes first wins, and the
        // second sees a step that no longer matches and gets nothing.
        OR: [{ totpLastStep: null }, { totpLastStep: { lt: totp.step } }],
      },
      data: { totpLastStep: totp.step },
    });
    return claimed.count === 1;
  }

  const normalised = normaliseRecoveryCode(code);
  if (normalised.length !== RECOVERY_LENGTH) {
    return false;
  }

  const claimed = await prisma.staffRecoveryCode.updateMany({
    where: { userId, codeHash: hashRecoveryCode(normalised), usedAt: null },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) {
    return false;
  }

  // Using one is worth knowing about: it means somebody has lost their
  // phone, or somebody else has their codes.
  await revokeAllStaffSessions(userId, "PASSWORD_CHANGED");
  return true;
}

/** Whether an account will be asked for a second factor at all. */
export async function requiresSecondFactor(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpConfirmedAt: true },
  });
  return Boolean(user?.totpConfirmedAt);
}
