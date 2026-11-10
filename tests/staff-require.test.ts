import { randomUUID } from "node:crypto";
import type { Role } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { hashPassword } from "@/lib/staff/password";
import type { StaffIdentity } from "@/lib/staff/session";

/**
 * The enforcement point for the second-factor requirement.
 *
 * Worth testing here rather than only through the gated layout, because the
 * layout is not what holds. Layouts do not run for server actions, so an
 * attacker with a stolen password could sign in - enrolment has to be
 * reachable, so signing in must work - and then post the console's actions
 * directly, skipping every redirect. Every action starts with
 * requireStaff(), so this is the check that actually refuses them.
 *
 * `vi.resetModules()` before each case because currentStaff() is a
 * zero-argument React cache: one entry for the module's lifetime, so
 * without a reset the first test's identity would answer all of them.
 */

const run = randomUUID().slice(0, 8);
let brand: { id: string };

/** A redirect, as the real one behaves: it aborts by throwing. */
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));

const getStaffSession = vi.fn<() => Promise<StaffIdentity | null>>();
vi.mock("@/lib/staff/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/staff/session")>()),
  getStaffSession: () => getStaffSession(),
}));

async function makeUser(role: Role, enrolled: boolean): Promise<StaffIdentity> {
  const user = await prisma.user.create({
    data: {
      brandId: brand.id,
      email: `${role.toLowerCase()}-${enrolled ? "on" : "off"}-${randomUUID().slice(0, 6)}@example.invalid`,
      name: "Test",
      role,
      passwordHash: await hashPassword("a-long-enough-staff-password"),
      // The column the check reads. Set directly: this file is about the
      // gate, and going through enrolment would make it about that instead.
      totpConfirmedAt: enrolled ? new Date() : null,
    },
    select: { id: true, email: true, name: true, role: true, brandId: true },
  });

  return {
    sessionId: `session-${user.id}`,
    userId: user.id,
    brandId: user.brandId,
    role: user.role,
    name: user.name,
    email: user.email,
  };
}

/** A fresh module instance, so the request-scoped caches start empty. */
async function freshRequireStaff() {
  vi.resetModules();
  return (await import("@/lib/staff/current")).requireStaff;
}

beforeAll(async () => {
  brand = await prisma.brand.create({ data: { name: `Require ${run}`, slug: `require-${run}` } });
});

beforeEach(() => {
  getStaffSession.mockReset();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { brandId: brand.id } });
  await prisma.brand.delete({ where: { id: brand.id } });
});

describe("requireStaff", () => {
  it("sends an owner with no second factor to the enrolment screen", async () => {
    getStaffSession.mockResolvedValue(await makeUser("OWNER", false));
    const requireStaff = await freshRequireStaff();

    await expect(requireStaff()).rejects.toThrow(Redirected);
    await expect(requireStaff()).rejects.toMatchObject({ to: "/security" });
  });

  it("sends an admin with no second factor there too", async () => {
    getStaffSession.mockResolvedValue(await makeUser("ADMIN", false));
    const requireStaff = await freshRequireStaff();

    await expect(requireStaff()).rejects.toMatchObject({ to: "/security" });
  });

  it("lets an owner through once enrolled", async () => {
    const staff = await makeUser("OWNER", true);
    getStaffSession.mockResolvedValue(staff);
    const requireStaff = await freshRequireStaff();

    await expect(requireStaff()).resolves.toMatchObject({ userId: staff.userId });
  });

  it("lets a role that does not need one through without it", async () => {
    // The other half of the policy. If this ever starts redirecting, every
    // till operator is locked out of a console they were never asked to
    // enrol in.
    for (const role of ["MARKETING", "QUALITY"] as const) {
      getStaffSession.mockResolvedValue(await makeUser(role, false));
      const requireStaff = await freshRequireStaff();
      await expect(requireStaff()).resolves.toMatchObject({ role });
    }
  });

  it("lets the enrolment screens through with the opt-out", async () => {
    // Without this, /security redirects to /security and the account can
    // never satisfy the requirement it is being held to.
    const staff = await makeUser("OWNER", false);
    getStaffSession.mockResolvedValue(staff);
    const requireStaff = await freshRequireStaff();

    await expect(requireStaff({ allowPendingSecondFactor: true })).resolves.toMatchObject({
      userId: staff.userId,
    });
  });

  it("still throws rather than redirects when there is no session at all", async () => {
    // A different failure with a different meaning: reaching here with no
    // session means the layout's check was bypassed, which is a bug to
    // surface rather than a person to send somewhere.
    getStaffSession.mockResolvedValue(null);
    const requireStaff = await freshRequireStaff();

    await expect(requireStaff()).rejects.toThrow(/without a staff session/i);
  });
});

describe("secondFactorOutstanding", () => {
  it("is true only for a required role that has not enrolled", async () => {
    vi.resetModules();
    const { secondFactorOutstanding } = await import("@/lib/staff/current");

    expect(await secondFactorOutstanding(await makeUser("OWNER", false))).toBe(true);
    expect(await secondFactorOutstanding(await makeUser("OWNER", true))).toBe(false);
    expect(await secondFactorOutstanding(await makeUser("MARKETING", false))).toBe(false);
  });
});
