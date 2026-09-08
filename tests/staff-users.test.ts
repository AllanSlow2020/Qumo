import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, User } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ForbiddenError } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/staff/password";
import { signInStaff } from "@/lib/staff/login";
import { createStaffSession, resolveStaffToken } from "@/lib/staff/session";
import {
  UserError,
  changeOwnPassword,
  inviteUserForSession,
  listTeam,
  resetPasswordForSession,
  setUserActiveForSession,
  setUserRoleForSession,
} from "@/lib/staff/users";

describe("who can get into a brand's console", () => {
  const suffix = Date.now();

  let brand: Brand;
  let otherBrand: Brand;
  let owner: User;
  let admin: User;
  let outsider: User;

  const as = (user: User) => ({ user: { id: user.id, brandId: user.brandId, role: user.role, name: user.name } });

  function form(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Licken", slug: `team-a-${suffix}` } });
    otherBrand = await prisma.brand.create({ data: { name: "Campari", slug: `team-b-${suffix}` } });

    const passwordHash = await hashPassword("the-original-owner-password");
    owner = await prisma.user.create({
      data: { brandId: brand.id, email: `owner-${suffix}@x.invalid`, name: "Thandi", role: "OWNER", passwordHash },
    });
    admin = await prisma.user.create({
      data: { brandId: brand.id, email: `admin-${suffix}@x.invalid`, name: "Sipho", role: "ADMIN", passwordHash },
    });
    outsider = await prisma.user.create({
      data: {
        brandId: otherBrand.id,
        email: `other-${suffix}@x.invalid`,
        name: "Nobody",
        role: "OWNER",
        passwordHash,
      },
    });
  });

  afterAll(async () => {
    await prisma.staffSession.deleteMany({ where: { user: { brandId: { in: [brand.id, otherBrand.id] } } } });
    await prisma.user.deleteMany({ where: { brandId: { in: [brand.id, otherBrand.id] } } });
    await prisma.brand.deleteMany({ where: { id: { in: [brand.id, otherBrand.id] } } });
  });

  it("invites somebody with a one-time password that actually signs them in", async () => {
    const invited = await inviteUserForSession(
      as(owner),
      form({ email: `new-${suffix}@x.invalid`, name: "Lerato", role: "MARKETING" }),
    );
    expect(invited.temporaryPassword.length).toBeGreaterThan(10);

    const result = await signInStaff(invited.email, invited.temporaryPassword);
    expect(result.ok).toBe(true);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: invited.id } });
    // The flag is what stops that shared credential being a permanent one.
    expect(row.mustChangePassword).toBe(true);
    expect(row.brandId).toBe(brand.id);
  });

  it("refuses an email that already exists, without saying where", async () => {
    // The address may belong to another brand entirely; confirming that maps
    // out who works where.
    await expect(
      inviteUserForSession(as(owner), form({ email: outsider.email, name: "X", role: "ADMIN" })),
    ).rejects.toThrow(UserError);
  });

  it("won't let an admin manage the team", async () => {
    await expect(
      inviteUserForSession(as(admin), form({ email: `nope-${suffix}@x.invalid`, name: "N", role: "ADMIN" })),
    ).rejects.toThrow(ForbiddenError);
  });

  it("won't touch somebody at another brand", async () => {
    await expect(setUserActiveForSession(as(owner), outsider.id, false)).rejects.toThrow(UserError);
    const still = await prisma.user.findUniqueOrThrow({ where: { id: outsider.id } });
    expect(still.isActive).toBe(true);
  });

  it("refuses to remove the last owner, either way round", async () => {
    // The lockout guard. Without it one mis-click leaves a brand with a
    // console nobody can administer and no way back except reaching into
    // the database by hand.
    await expect(setUserActiveForSession(as(owner), owner.id, false)).rejects.toThrow(UserError);
    await expect(setUserRoleForSession(as(owner), owner.id, "MARKETING")).rejects.toThrow(UserError);

    const still = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(still.role).toBe("OWNER");
    expect(still.isActive).toBe(true);
  });

  it("allows it once there is a second owner", async () => {
    await setUserRoleForSession(as(owner), admin.id, "OWNER");
    await setUserRoleForSession(as(owner), owner.id, "MARKETING");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).role).toBe("MARKETING");

    // Put it back - later tests need this session to be an owner.
    const secondOwner = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    await setUserRoleForSession(as(secondOwner), owner.id, "OWNER");
    await setUserRoleForSession(as(secondOwner), admin.id, "ADMIN");
    owner = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
  });

  it("ends every session when access is switched off", async () => {
    // "I've removed their access" has to be true when it is said. Session
    // resolution already refuses a deactivated user, so this is belt and
    // braces - but it is what makes the audit trail say why.
    const token = await createStaffSession(admin.id);
    expect(await resolveStaffToken(token)).not.toBeNull();

    await setUserActiveForSession(as(owner), admin.id, false);

    expect(await resolveStaffToken(token)).toBeNull();
    const row = await prisma.staffSession.findFirstOrThrow({
      where: { userId: admin.id, revokedReason: "DEACTIVATED" },
    });
    expect(row.revokedAt).not.toBeNull();
    expect((await signInStaff(admin.email, "the-original-owner-password")).ok).toBe(false);

    await setUserActiveForSession(as(owner), admin.id, true);
  });

  it("won't let an owner switch off their own access", async () => {
    // Not a lockout - there may be other owners - but there is no version of
    // this that is what somebody meant to do.
    await expect(setUserActiveForSession(as(owner), owner.id, false)).rejects.toThrow(UserError);
  });

  it("resets a password and ends the sessions that password was holding", async () => {
    const token = await createStaffSession(admin.id);
    const temp = await resetPasswordForSession(as(owner), admin.id);

    // The situation a reset usually exists to end is somebody else already
    // being signed in. Leaving their session alive would leave them in.
    expect(await resolveStaffToken(token)).toBeNull();
    expect((await signInStaff(admin.email, "the-original-owner-password")).ok).toBe(false);
    expect((await signInStaff(admin.email, temp)).ok).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).mustChangePassword).toBe(true);
  });

  describe("choosing your own password", () => {
    let temp: string;

    beforeAll(async () => {
      temp = await resetPasswordForSession(as(owner), admin.id);
    });

    it("needs the current one, so an open laptop can't take the account", async () => {
      await expect(changeOwnPassword(admin.id, "not-the-temp", "a-perfectly-fine-new-password")).rejects.toThrow(
        UserError,
      );
    });

    it("refuses something too short to be worth typing", async () => {
      await expect(changeOwnPassword(admin.id, temp, "short")).rejects.toThrow(UserError);
    });

    it("refuses re-entering the password being retired", async () => {
      // The forced change exists to retire a credential somebody else has
      // seen. Re-entering it would satisfy the flag and retire nothing.
      await expect(changeOwnPassword(admin.id, temp, temp)).rejects.toThrow(UserError);
    });

    it("clears the flag and signs out the other devices, but not this one", async () => {
      const thisDevice = await createStaffSession(admin.id);
      const otherDevice = await createStaffSession(admin.id);
      const identity = await resolveStaffToken(thisDevice);

      await changeOwnPassword(admin.id, temp, "a-long-enough-chosen-password", identity!.sessionId);

      expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).mustChangePassword).toBe(false);
      // The browser they just typed it into stays signed in; everything else
      // does not.
      expect(await resolveStaffToken(thisDevice)).not.toBeNull();
      expect(await resolveStaffToken(otherDevice)).toBeNull();

      expect((await signInStaff(admin.email, "a-long-enough-chosen-password")).ok).toBe(true);
      expect((await signInStaff(admin.email, temp)).ok).toBe(false);
    });
  });

  it("lists the team, and only this team", async () => {
    const team = await listTeam(brand.id);
    expect(team.some((m) => m.email === outsider.email)).toBe(false);
    expect(team.some((m) => m.id === owner.id)).toBe(true);
    expect(await listTeam(otherBrand.id)).toHaveLength(1);
  });
});
