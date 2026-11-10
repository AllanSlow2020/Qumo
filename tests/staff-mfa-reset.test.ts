import { randomUUID } from "node:crypto";
import type { Brand, User } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { ForbiddenError } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/staff/password";
import { getSecondFactorState } from "@/lib/staff/mfa";
import { resolveStaffToken, createStaffSession } from "@/lib/staff/session";
import { UserError, resetSecondFactorForSession } from "@/lib/staff/users";

/**
 * An owner clearing a colleague's second factor.
 *
 * This exists because requiring a second factor of owners and admins
 * created a way to be permanently locked out, and it is the kind of fix
 * that can quietly reintroduce what it was protecting. So most of what is
 * tested here is refusal.
 */

const run = randomUUID().slice(0, 8);
const PASSWORD = "the-acting-owner-password";

let brand: Brand;
let otherBrand: Brand;
let owner: User;
let secondOwner: User;
let colleague: User;
let marketer: User;
let outsider: User;

const as = (user: User) => ({
  user: { id: user.id, brandId: user.brandId, role: user.role, name: user.name, email: user.email },
});

/** Enrolled, written directly: this file is about the reset, not enrolment. */
async function give(user: User): Promise<void> {
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecretEncrypted: "ciphertext", totpConfirmedAt: new Date(), totpLastStep: 1 },
  });
  await prisma.staffRecoveryCode.createMany({
    data: Array.from({ length: 3 }, () => ({ userId: user.id, codeHash: randomUUID() })),
  });
}

beforeAll(async () => {
  brand = await prisma.brand.create({ data: { name: `Reset ${run}`, slug: `reset-${run}` } });
  otherBrand = await prisma.brand.create({ data: { name: `Other ${run}`, slug: `reset-other-${run}` } });
  const passwordHash = await hashPassword(PASSWORD);

  const make = (brandId: string, role: User["role"], who: string) =>
    prisma.user.create({
      data: { brandId, email: `${who}-${run}@x.invalid`, name: who, role, passwordHash },
    });

  owner = await make(brand.id, "OWNER", "owner");
  secondOwner = await make(brand.id, "OWNER", "second-owner");
  colleague = await make(brand.id, "ADMIN", "colleague");
  marketer = await make(brand.id, "MARKETING", "marketer");
  outsider = await make(otherBrand.id, "ADMIN", "outsider");
});

beforeEach(async () => {
  await prisma.staffRecoveryCode.deleteMany({ where: { user: { brandId: { in: [brand.id, otherBrand.id] } } } });
  await prisma.user.updateMany({
    where: { brandId: { in: [brand.id, otherBrand.id] } },
    data: { totpSecretEncrypted: null, totpConfirmedAt: null, totpLastStep: null },
  });
});

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { brandId: { in: [brand.id, otherBrand.id] } } });
  await prisma.staffRecoveryCode.deleteMany({ where: { user: { brandId: { in: [brand.id, otherBrand.id] } } } });
  await prisma.staffSession.deleteMany({ where: { user: { brandId: { in: [brand.id, otherBrand.id] } } } });
  await prisma.user.deleteMany({ where: { brandId: { in: [brand.id, otherBrand.id] } } });
  await prisma.brand.deleteMany({ where: { id: { in: [brand.id, otherBrand.id] } } });
});

describe("an owner resetting a colleague's second factor", () => {
  it("clears the secret and every recovery code", async () => {
    await give(colleague);

    await resetSecondFactorForSession(as(owner), colleague.id, PASSWORD);

    const state = await getSecondFactorState(colleague.id);
    expect(state.enabled).toBe(false);

    // The codes specifically. A reset that clears the secret and leaves the
    // recovery codes behind leaves ten working credentials on an account
    // everybody now believes has none.
    expect(state.recoveryCodesLeft).toBe(0);
  });

  it("ends the colleague's sessions", async () => {
    await give(colleague);
    const token = await createStaffSession(colleague.id);
    expect(await resolveStaffToken(token)).not.toBeNull();

    await resetSecondFactorForSession(as(owner), colleague.id, PASSWORD);

    // If the phone was stolen rather than lost, a live session on it is
    // exactly what the reset was meant to take away.
    expect(await resolveStaffToken(token)).toBeNull();
  });

  it("writes an audit entry naming who was reset", async () => {
    await give(colleague);
    await resetSecondFactorForSession(as(owner), colleague.id, PASSWORD);

    const event = await prisma.auditEvent.findFirst({
      where: { brandId: brand.id, action: "user.mfa_reset" },
      orderBy: { createdAt: "desc" },
    });
    expect(event?.targetId).toBe(colleague.id);
    expect(event?.targetLabel).toBe(colleague.email);
  });
});

describe("what it refuses", () => {
  it("refuses your own account, which is the whole point", async () => {
    await give(owner);

    // Without this the second-factor requirement unravels: an owner resets
    // themselves, enrols on a new device, and has done precisely what
    // disableMfa refuses to let them do. Every other rule here is ordinary
    // care; this one is the reason the others are not enough.
    await expect(resetSecondFactorForSession(as(owner), owner.id, PASSWORD)).rejects.toThrow(UserError);

    expect((await getSecondFactorState(owner.id)).enabled).toBe(true);
  });

  it("refuses an admin, because user management is owner-only", async () => {
    await give(colleague);

    await expect(resetSecondFactorForSession(as(colleague), owner.id, PASSWORD)).rejects.toThrow(ForbiddenError);
  });

  it("refuses a marketing account too", async () => {
    await give(colleague);

    await expect(resetSecondFactorForSession(as(marketer), colleague.id, PASSWORD)).rejects.toThrow(ForbiddenError);
  });

  it("refuses the wrong password, and changes nothing", async () => {
    await give(colleague);

    await expect(
      resetSecondFactorForSession(as(owner), colleague.id, "not-the-password"),
    ).rejects.toThrow(UserError);

    expect((await getSecondFactorState(colleague.id)).enabled).toBe(true);
  });

  it("checks the acting owner's password, not the target's", async () => {
    await give(colleague);
    // A distinct password on the target, so passing the owner's own proves
    // which account was verified. Verifying the target's would be worse
    // than useless: an owner resetting a lost phone does not know it.
    await prisma.user.update({
      where: { id: colleague.id },
      data: { passwordHash: await hashPassword("the-colleagues-own-password") },
    });

    await resetSecondFactorForSession(as(owner), colleague.id, PASSWORD);
    expect((await getSecondFactorState(colleague.id)).enabled).toBe(false);
  });

  it("refuses somebody in another brand", async () => {
    await give(outsider);

    // Tenant scoping, through findUser. An owner's reach stops at their own
    // team, and the message says "isn't on your team" rather than
    // confirming the account exists at all.
    await expect(resetSecondFactorForSession(as(owner), outsider.id, PASSWORD)).rejects.toThrow(UserError);

    expect((await getSecondFactorState(outsider.id)).enabled).toBe(true);
  });

  it("lets a second owner reset the first, which is the recovery route", async () => {
    await give(owner);

    // The answer to "I lost my phone" on a brand with two owners, and the
    // reason refusing your own account is not a dead end.
    await resetSecondFactorForSession(as(secondOwner), owner.id, PASSWORD);

    expect((await getSecondFactorState(owner.id)).enabled).toBe(false);
  });
});

describe("what a reset leaves behind", () => {
  it("leaves an account that must enrol again rather than one that is exempt", async () => {
    await give(colleague);

    // Read it now rather than trusting the fixture: an earlier case in this
    // file changes this account's password, so the object created in
    // beforeAll holds a hash that is no longer the one in the row.
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: colleague.id },
      select: { passwordHash: true },
    });

    await resetSecondFactorForSession(as(owner), colleague.id, PASSWORD);

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: colleague.id },
      select: { role: true, totpConfirmedAt: true, passwordHash: true },
    });

    // ADMIN still requires one, and now has none, so the gate in
    // requireStaff() holds them at /security. A reset hands back a way in,
    // not an exemption.
    expect(row.role).toBe("ADMIN");
    expect(row.totpConfirmedAt).toBeNull();

    // And their password is untouched: this is not a password reset, and
    // conflating the two would hand an owner a way to take the account.
    expect(row.passwordHash).toBe(before.passwordHash);
  });
});
