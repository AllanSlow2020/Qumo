import { z } from "zod";
import { generateTempPassword } from "@/lib/staff/password";
import { Prisma, type Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/rbac";
import { forBrand } from "@/lib/db/tenant";
import { prisma } from "@/lib/db/client";
import { record } from "@/lib/audit/record";
import { hashPassword, verifyPassword } from "./password";
import { revokeAllStaffSessions } from "./session";
import type { Actor } from "@/lib/staff/actor";

/**
 * Who can get into a brand's console.
 *
 * Owner-only, per the Role enum's own definition: OWNER is "full access,
 * incl. user management". An ADMIN runs the brand's programme; only an owner
 * decides who else gets to.
 */
export const MANAGE_USER_ROLES: Role[] = ["OWNER"];

export class UserError extends Error {}

export type SessionLike = Actor;

/**
 * Twelve characters, and nothing else prescribed.
 *
 * Length is the property that actually resists guessing; the usual
 * complexity rules push people toward Password1! and a sticky note. NIST
 * dropped them for the same reason. A minimum and a maximum, so a
 * passphrase is welcome and a megabyte of input is not a denial of service
 * against scrypt.
 */
const MIN_PASSWORD = 12;
const MAX_PASSWORD = 200;

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().min(1).max(120),
  role: z.enum(["OWNER", "ADMIN", "MARKETING", "QUALITY"]),
});

export type InvitedUser = { id: string; email: string; temporaryPassword: string };

export async function inviteUserForSession(session: SessionLike, formData: FormData): Promise<InvitedUser> {
  requireRole(session.user.role as Role, MANAGE_USER_ROLES);

  const parsed = inviteSchema.parse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
  });

  const temporaryPassword = generateTempPassword();

  try {
    // Not forBrand(): email is unique across the whole table, so creating
    // through the tenant guard would still collide with another brand's row
    // and the brandId is set explicitly from the session either way.
    const user = await prisma.user.create({
      data: {
        brandId: session.user.brandId,
        email: parsed.email,
        name: parsed.name,
        role: parsed.role,
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: true,
      },
    });
    await record(prisma, session.user, {
      action: "user.invited",
      targetId: user.id,
      targetLabel: user.email,
      detail: { role: parsed.role, name: parsed.name },
    });

    return { id: user.id, email: user.email, temporaryPassword };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Deliberately vague about *where* it exists. An address may belong to
      // another brand entirely, and confirming that to a stranger maps out
      // who works where.
      throw new UserError("That email address is already in use.");
    }
    throw err;
  }
}

/**
 * The rule that stops a brand locking itself out.
 *
 * Every path that could remove the last owner - deactivating one, demoting
 * one - goes through here. Without it a single mis-click leaves a brand with
 * a console nobody can administer and no way back except us reaching into
 * the database, which is not a support process anyone should design on
 * purpose.
 */
async function assertNotLastOwner(brandId: string, userId: string, message: string): Promise<void> {
  const otherOwners = await forBrand(brandId).user.count({
    where: { role: "OWNER", isActive: true, id: { not: userId } },
  });
  if (otherOwners === 0) {
    throw new UserError(message);
  }
}

async function findUser(brandId: string, userId: string) {
  const user = await forBrand(brandId).user.findFirst({ where: { id: userId } });
  if (!user) {
    throw new UserError("That person isn't on your team.");
  }
  return user;
}

export async function setUserRoleForSession(session: SessionLike, userId: string, role: Role): Promise<void> {
  requireRole(session.user.role as Role, MANAGE_USER_ROLES);

  const user = await findUser(session.user.brandId, userId);
  if (user.role === "OWNER" && role !== "OWNER") {
    await assertNotLastOwner(
      session.user.brandId,
      user.id,
      "This is your only owner. Make somebody else an owner first, or nobody will be able to manage the team.",
    );
  }

  await forBrand(session.user.brandId).user.update({ where: { id: user.id }, data: { role } });

  await record(prisma, session.user, {
    action: "user.role_changed",
    targetId: user.id,
    targetLabel: user.email,
    detail: { from: user.role, to: role },
  });
}

/**
 * Turning access on and off.
 *
 * Deactivating revokes every session the account holds, and that is the
 * whole point rather than a tidy-up. Session resolution already refuses a
 * deactivated user on the next request, so this is belt and braces - but the
 * belt is what makes the audit trail say *why* those sessions ended, and an
 * ex-employee's laptop is exactly where that question gets asked.
 */
export async function setUserActiveForSession(
  session: SessionLike,
  userId: string,
  isActive: boolean,
): Promise<void> {
  requireRole(session.user.role as Role, MANAGE_USER_ROLES);

  const user = await findUser(session.user.brandId, userId);
  if (!isActive) {
    if (user.id === session.user.id) {
      throw new UserError("You can't switch off your own access.");
    }
    if (user.role === "OWNER") {
      await assertNotLastOwner(
        session.user.brandId,
        user.id,
        "This is your only owner. Make somebody else an owner first.",
      );
    }
  }

  await forBrand(session.user.brandId).user.update({ where: { id: user.id }, data: { isActive } });
  if (!isActive) {
    await revokeAllStaffSessions(user.id, "DEACTIVATED");
  }

  await record(prisma, session.user, {
    action: isActive ? "user.reactivated" : "user.deactivated",
    targetId: user.id,
    targetLabel: user.email,
  });
}

/**
 * Issues a fresh one-time password for somebody who has lost theirs.
 *
 * Ends their existing sessions too. A password reset that left a live
 * session running would mean an attacker already holding one keeps it, which
 * is the situation a reset most often exists to end.
 */
export async function resetPasswordForSession(session: SessionLike, userId: string): Promise<string> {
  requireRole(session.user.role as Role, MANAGE_USER_ROLES);

  const user = await findUser(session.user.brandId, userId);
  const temporaryPassword = generateTempPassword();

  await forBrand(session.user.brandId).user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true },
  });
  await revokeAllStaffSessions(user.id, "PASSWORD_CHANGED");

  // The fact only. A generated password in a table the whole team can read
  // would defeat the reason for generating one.
  await record(prisma, session.user, {
    action: "user.password_reset",
    targetId: user.id,
    targetLabel: user.email,
  });

  return temporaryPassword;
}

/**
 * Somebody choosing their own password - the forced first one, and every
 * later one.
 *
 * Requires the current password even when the account is under a forced
 * change, so a session left open on an unattended machine cannot be used to
 * take the account over. Ends every *other* session on success, which is the
 * behaviour anybody who changes a password because they think it leaked
 * expects, and which nothing was calling until now.
 */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  /** The session doing the changing, so it is the one left alive. */
  keepSessionId?: string,
): Promise<void> {
  if (newPassword.length < MIN_PASSWORD) {
    throw new UserError(`Use at least ${MIN_PASSWORD} characters. A short sentence works well.`);
  }
  if (newPassword.length > MAX_PASSWORD) {
    throw new UserError("That's longer than we can accept.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, isActive: true },
  });
  if (!user || !user.isActive) {
    throw new UserError("That account isn't active.");
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new UserError("That current password isn't right.");
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    // The forced change exists to retire a credential somebody else has
    // seen. Re-entering it would satisfy the flag and retire nothing.
    throw new UserError("Choose a password you haven't used here before.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
  });
  await revokeAllStaffSessions(userId, "PASSWORD_CHANGED", new Date(), keepSessionId);
}

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
};

export async function listTeam(brandId: string): Promise<TeamMember[]> {
  return forBrand(brandId).user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });
}
