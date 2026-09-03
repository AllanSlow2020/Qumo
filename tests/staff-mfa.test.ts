import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { hashPassword } from "@/lib/staff/password";
import { signInStaff } from "@/lib/staff/login";
import {
  beginEnrolment,
  confirmEnrolment,
  consumeSecondFactor,
  disableMfa,
  getSecondFactorState,
  MfaError,
  regenerateRecoveryCodes,
  RECOVERY_CODE_COUNT,
} from "@/lib/staff/mfa";
import { decryptSecret } from "@/lib/security/crypto";
import { totpCode } from "@/lib/staff/totp";
import { resolveStaffToken } from "@/lib/staff/session";

const run = randomUUID().slice(0, 8);
const PASSWORD = "a-long-enough-staff-password";

let brand: { id: string };
let user: { id: string; email: string };

const actor = () => ({
  user: { id: user.id, brandId: brand.id, role: "OWNER", name: "Thandi", email: user.email },
});

/** The secret as the app would hold it, read back the way login does. */
async function currentSecret(): Promise<string> {
  const row = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { totpSecretEncrypted: true },
  });
  return decryptSecret(row.totpSecretEncrypted!);
}

async function enrol(now = new Date()): Promise<{ secret: string; recoveryCodes: string[] }> {
  await beginEnrolment(actor(), "Qumo");
  const secret = await currentSecret();
  const recoveryCodes = await confirmEnrolment(actor(), totpCode(secret, now), now);
  return { secret, recoveryCodes };
}

beforeAll(async () => {
  brand = await prisma.brand.create({ data: { name: `MFA ${run}`, slug: `mfa-${run}` } });
  user = await prisma.user.create({
    data: {
      brandId: brand.id,
      email: `owner-${run}@example.invalid`,
      name: "Thandi",
      role: "OWNER",
      passwordHash: await hashPassword(PASSWORD),
    },
    select: { id: true, email: true },
  });
});

beforeEach(async () => {
  // The second-factor attempt counter is keyed on the user and lives in
  // Postgres, so it survives between tests unless it is cleared.
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: `mfa:verify:${user.id}` } } });
  // Every test starts with no second factor, so one enrolling does not
  // silently decide what the next one is testing.
  await prisma.staffRecoveryCode.deleteMany({ where: { userId: user.id } });
  await prisma.staffSession.deleteMany({ where: { userId: user.id } });
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecretEncrypted: null, totpConfirmedAt: null, totpLastStep: null },
  });
});

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { brandId: brand.id } });
  await prisma.staffRecoveryCode.deleteMany({ where: { userId: user.id } });
  await prisma.staffSession.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.brand.delete({ where: { id: brand.id } });
});

describe("enrolment", () => {
  it("does not change sign-in until a code has been proved", async () => {
    await beginEnrolment(actor(), "Qumo");

    // The secret exists but is inert. Anything else would lock out somebody
    // whose app silently failed to scan, which is the most common way a
    // second factor goes wrong and the least recoverable.
    const result = await signInStaff(user.email, PASSWORD);
    expect(result.ok).toBe(true);
    expect((await getSecondFactorState(user.id)).enabled).toBe(false);
  });

  it("refuses to confirm on a wrong code", async () => {
    await beginEnrolment(actor(), "Qumo");
    await expect(confirmEnrolment(actor(), "000000")).rejects.toThrow(MfaError);
    expect((await getSecondFactorState(user.id)).enabled).toBe(false);
  });

  it("turns on and hands back a full set of recovery codes", async () => {
    const { recoveryCodes } = await enrol();
    expect(recoveryCodes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(recoveryCodes).size).toBe(RECOVERY_CODE_COUNT);

    const state = await getSecondFactorState(user.id);
    expect(state.enabled).toBe(true);
    expect(state.recoveryCodesLeft).toBe(RECOVERY_CODE_COUNT);
  });

  it("refuses to enrol twice over an account that already has it on", async () => {
    await enrol();
    await expect(beginEnrolment(actor(), "Qumo")).rejects.toThrow(MfaError);
  });
});

describe("signing in with a second factor", () => {
  it("asks for a code instead of issuing a session", async () => {
    await enrol();

    const result = await signInStaff(user.email, PASSWORD);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.secondFactorRequired).toBe(true);

    // And crucially, no session was minted on the way past.
    expect(await prisma.staffSession.count({ where: { userId: user.id } })).toBe(0);
  });

  it("signs in with the right code", async () => {
    const now = new Date();
    const { secret } = await enrol(new Date(now.getTime() - 60_000));

    const result = await signInStaff(user.email, PASSWORD, totpCode(secret, now), now);
    expect(result.ok).toBe(true);
  });

  it("refuses a wrong code, and still issues nothing", async () => {
    await enrol();
    const result = await signInStaff(user.email, PASSWORD, "000000");
    expect(result.ok).toBe(false);
    expect(await prisma.staffSession.count({ where: { userId: user.id } })).toBe(0);
  });

  /**
   * The reason totpLastStep exists. A code is accepted across a three-step
   * window, so without recording the step it was used at, anyone who reads
   * it over a shoulder can use it again for up to ninety seconds.
   */
  it("refuses the same code twice", async () => {
    const now = new Date();
    const { secret } = await enrol(new Date(now.getTime() - 60_000));
    const code = totpCode(secret, now);

    expect((await signInStaff(user.email, PASSWORD, code, now)).ok).toBe(true);
    expect((await signInStaff(user.email, PASSWORD, code, now)).ok).toBe(false);
  });

  it("refuses a code that has already been overtaken by a later one", async () => {
    const now = new Date();
    const { secret } = await enrol(new Date(now.getTime() - 120_000));

    const earlier = new Date(now.getTime() - 30_000);
    expect(await consumeSecondFactor(user.id, totpCode(secret, now), now)).toBe(true);
    // Still inside the accepted window, but from a step already passed.
    expect(await consumeSecondFactor(user.id, totpCode(secret, earlier), now)).toBe(false);
  });

  it("still refuses a wrong password, code or no code", async () => {
    const now = new Date();
    const { secret } = await enrol(new Date(now.getTime() - 60_000));
    const result = await signInStaff(user.email, "not-the-password", totpCode(secret, now), now);
    expect(result.ok).toBe(false);
    // And says nothing about the second factor, because the password never
    // matched — the prompt must not become an oracle for which accounts have
    // one, or which exist.
    expect(result.ok === false && result.secondFactorRequired).toBeFalsy();
  });

  it("does not ask an account without one", async () => {
    expect((await signInStaff(user.email, PASSWORD)).ok).toBe(true);
  });
});

describe("recovery codes", () => {
  it("signs in once, and only once", async () => {
    const { recoveryCodes } = await enrol();
    const code = recoveryCodes[0]!;

    expect((await signInStaff(user.email, PASSWORD, code)).ok).toBe(true);
    expect((await signInStaff(user.email, PASSWORD, code)).ok).toBe(false);
    expect((await getSecondFactorState(user.id)).recoveryCodesLeft).toBe(RECOVERY_CODE_COUNT - 1);
  });

  it("is accepted however it was typed", async () => {
    const { recoveryCodes } = await enrol();
    const messy = ` ${recoveryCodes[0]!.toLowerCase().replace(/(.{4})/, "$1-")} `;
    expect((await signInStaff(user.email, PASSWORD, messy)).ok).toBe(true);
  });

  /**
   * Using one means a phone was lost — or somebody else has the codes.
   * Either way every other session should end.
   */
  it("ends every other session", async () => {
    const now = new Date();
    const { secret, recoveryCodes } = await enrol(new Date(now.getTime() - 120_000));

    const first = await signInStaff(user.email, PASSWORD, totpCode(secret, now), now);
    expect(first.ok).toBe(true);
    const token = first.ok ? first.token : "";

    await signInStaff(user.email, PASSWORD, recoveryCodes[0]!, now);

    // The earlier session no longer resolves.
    const { createHash } = await import("node:crypto");
    const revoked = await prisma.staffSession.findFirst({
      where: { tokenHash: createHash("sha256").update(token).digest("hex") },
      select: { revokedAt: true },
    });
    expect(revoked?.revokedAt).not.toBeNull();
  });

  it("replaces the whole set when regenerated", async () => {
    const { recoveryCodes } = await enrol();
    const fresh = await regenerateRecoveryCodes(actor(), PASSWORD);

    expect(fresh).toHaveLength(RECOVERY_CODE_COUNT);
    // An old code is dead the moment a new set exists, or "regenerate"
    // would mean "add more".
    expect((await signInStaff(user.email, PASSWORD, recoveryCodes[0]!)).ok).toBe(false);
    expect((await signInStaff(user.email, PASSWORD, fresh[0]!)).ok).toBe(true);
  });

  it("needs the current password to regenerate", async () => {
    await enrol();
    await expect(regenerateRecoveryCodes(actor(), "wrong")).rejects.toThrow(MfaError);
  });
});

describe("turning it off", () => {
  it("needs the current password", async () => {
    await enrol();
    await expect(disableMfa(actor(), "wrong")).rejects.toThrow(MfaError);
    expect((await getSecondFactorState(user.id)).enabled).toBe(true);
  });

  it("removes the secret and every recovery code", async () => {
    await enrol();
    await disableMfa(actor(), PASSWORD);

    const state = await getSecondFactorState(user.id);
    expect(state.enabled).toBe(false);
    expect(state.recoveryCodesLeft).toBe(0);

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { totpSecretEncrypted: true },
    });
    expect(row.totpSecretEncrypted).toBeNull();
    expect((await signInStaff(user.email, PASSWORD)).ok).toBe(true);
  });
});

describe("what the log says", () => {
  it("records turning it on and off, and never the secret", async () => {
    const { secret } = await enrol();
    await disableMfa(actor(), PASSWORD);

    const events = await prisma.auditEvent.findMany({
      where: { brandId: brand.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const actions = events.map((e) => e.action);
    expect(actions).toContain("user.mfa_enabled");
    expect(actions).toContain("user.mfa_disabled");
    expect(JSON.stringify(events)).not.toContain(secret);
  });
});

describe("a session is still a session", () => {
  it("resolves normally once the code has been accepted", async () => {
    const now = new Date();
    const { secret } = await enrol(new Date(now.getTime() - 60_000));
    const result = await signInStaff(user.email, PASSWORD, totpCode(secret, now), now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const identity = await resolveStaffToken(result.token);
    expect(identity?.userId).toBe(user.id);
  });
});

/**
 * Found by reviewing the finished feature, and it is the hole that would
 * have made the rest of it decorative.
 *
 * The only limit on guessing a code was the per-client login cap, which is
 * keyed on the caller's address precisely so it catches one machine working
 * through many accounts. It does nothing about many machines working on one
 * account — which is the shape of an attack on a second factor, because
 * whoever is guessing already has the password.
 *
 * The arithmetic is why it mattered: a six-digit code across a three-step
 * window is roughly a 3-in-a-million guess, so an attacker with the password
 * and rotating addresses expects to be through within a day at ten requests
 * a second.
 */
describe("guessing the second factor", () => {
  it("stops accepting guesses long before the keyspace does", async () => {
    const now = new Date();
    const { secret } = await enrol(new Date(now.getTime() - 120_000));

    // Ten wrong guesses, which is the cap.
    for (let i = 0; i < 10; i += 1) {
      expect(await consumeSecondFactor(user.id, String(100000 + i), now)).toBe(false);
    }

    // The eleventh is refused before any comparison happens — and the proof
    // is that the *correct* code is refused too. Without the cap this would
    // pass, and so would the ten thousandth guess.
    expect(await consumeSecondFactor(user.id, totpCode(secret, now), now)).toBe(false);
  });

  it("counts per account, so rotating addresses buys nothing", async () => {
    const now = new Date();
    await enrol(new Date(now.getTime() - 120_000));

    // consumeSecondFactor never sees an address. That is the point: the
    // counter is keyed on the user, so there is no address to rotate.
    for (let i = 0; i < 11; i += 1) {
      await consumeSecondFactor(user.id, "000000", now);
    }
    const { rateLimit } = await import("@/lib/security/rate-limit");
    const state = await rateLimit(`mfa:verify:${user.id}`, 10, 15 * 60 * 1000, now);
    expect(state.allowed).toBe(false);
  });

  it("lets a real person back in once the window has passed", async () => {
    const now = new Date();
    const { secret } = await enrol(new Date(now.getTime() - 120_000));

    for (let i = 0; i < 11; i += 1) {
      await consumeSecondFactor(user.id, "000000", now);
    }
    expect(await consumeSecondFactor(user.id, totpCode(secret, now), now)).toBe(false);

    // Somebody who fat-fingered their code ten times is not locked out
    // permanently — the window closes and they try again.
    const later = new Date(now.getTime() + 15 * 60 * 1000 + 1_000);
    expect(await consumeSecondFactor(user.id, totpCode(secret, later), later)).toBe(true);
  });
});
