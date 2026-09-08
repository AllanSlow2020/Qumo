import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Person, User } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { isConsoleHost, brandSlugFromHost } from "@/lib/brand/host";
import { createSession as createShopperSession, verifySessionToken } from "@/lib/consumer/session";
import { encryptPhone, hashPhone } from "@/lib/security/crypto";
import { requireRole, ForbiddenError } from "@/lib/auth/rbac";
import { hashPassword, verifyPassword } from "@/lib/staff/password";
import { signInStaff, LOGIN_FAILED } from "@/lib/staff/login";
import {
  createStaffSession,
  resolveStaffToken,
  revokeAllStaffSessions,
  revokeStaffSessionByToken,
} from "@/lib/staff/session";

describe("staff passwords", () => {
  it("verifies the right password and refuses the wrong one", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(await verifyPassword("Correct horse battery staple", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("never produces the same hash twice", async () => {
    // A per-password salt, which is what stops one rainbow table answering
    // for every account that chose the same password.
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });

  it("records its own parameters, so they can be raised later", async () => {
    const stored = await hashPassword("x");
    expect(stored.split("$").slice(0, 4)).toEqual(["scrypt", "32768", "8", "1"]);
  });

  it("returns false rather than throwing on a malformed stored value", async () => {
    // Handed a corrupt row or a hash from some other scheme, the answer to
    // "is this the right password" is no. Throwing would turn a bad row into
    // a 500 that distinguishes it from a wrong password.
    for (const bad of ["", "not-a-hash", "scrypt$1$2$3", "bcrypt$2b$10$abc", "scrypt$0$8$1$aa$bb"]) {
      expect(await verifyPassword("anything", bad)).toBe(false);
    }
  });

  it("refuses absurd cost parameters read out of the database", async () => {
    // This function's job is to be handed untrusted-shaped input. An N of
    // 2^40 out of a corrupted row is a memory exhaustion, not a login.
    const stored = `scrypt$${2 ** 30}$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA`;
    expect(await verifyPassword("anything", stored)).toBe(false);
  });
});

describe("the console and the shopper surface are different doors", () => {
  const suffix = Date.now();

  let brandA: Brand;
  let brandB: Brand;
  let staffA: User;
  let staffB: User;
  let shopper: Person;

  const PASSWORD = "a-good-enough-dev-password";

  beforeAll(async () => {
    brandA = await prisma.brand.create({ data: { name: "Licken", slug: `staff-a-${suffix}` } });
    brandB = await prisma.brand.create({ data: { name: "Campari", slug: `staff-b-${suffix}` } });

    const passwordHash = await hashPassword(PASSWORD);
    staffA = await prisma.user.create({
      data: { brandId: brandA.id, email: `a-${suffix}@example.invalid`, name: "Thandi", role: "OWNER", passwordHash },
    });
    staffB = await prisma.user.create({
      data: { brandId: brandB.id, email: `b-${suffix}@example.invalid`, name: "Sipho", role: "MARKETING", passwordHash },
    });

    const phone = `+2783${String(suffix).slice(-7)}`;
    shopper = await prisma.person.create({
      data: { phoneHash: hashPhone(phone), phoneEncrypted: encryptPhone(phone), firstName: "Allan" },
    });
  });

  afterAll(async () => {
    await prisma.staffSession.deleteMany({ where: { userId: { in: [staffA.id, staffB.id] } } });
    await prisma.shopperSession.deleteMany({ where: { personId: shopper.id } });
    await prisma.user.deleteMany({ where: { id: { in: [staffA.id, staffB.id] } } });
    await prisma.person.delete({ where: { id: shopper.id } });
    await prisma.brand.deleteMany({ where: { id: { in: [brandA.id, brandB.id] } } });
  });

  it("does not let a shopper's token authenticate staff", async () => {
    // The failure this whole two-table design exists to make unwriteable.
    // With one sessions table and a nullable userId, a single missing
    // condition here is a customer holding an administrator's session.
    const shopperToken = await createShopperSession(shopper.id);
    expect(await verifySessionToken(shopperToken)).toBe(shopper.id);
    expect(await resolveStaffToken(shopperToken)).toBeNull();
  });

  it("does not let a staff token authenticate a shopper", async () => {
    const staffToken = await createStaffSession(staffA.id);
    expect(await resolveStaffToken(staffToken)).not.toBeNull();
    expect(await verifySessionToken(staffToken)).toBeNull();
  });

  it("carries the brand from the user row, not from anywhere a request can reach", async () => {
    const token = await createStaffSession(staffB.id);
    const identity = await resolveStaffToken(token);
    expect(identity?.brandId).toBe(brandB.id);
    expect(identity?.role).toBe("MARKETING");
    // Nothing in the resolved identity comes from a host, a header or a
    // form. That is the reason a console host never names a brand.
    expect(identity?.brandId).not.toBe(brandA.id);
  });

  it("signs in with the right password and refuses everything else identically", async () => {
    const ok = await signInStaff(staffA.email, PASSWORD);
    expect(ok.ok).toBe(true);

    const wrongPassword = await signInStaff(staffA.email, "not-it");
    const unknownEmail = await signInStaff(`nobody-${suffix}@example.invalid`, PASSWORD);
    // Identical messages: telling somebody the address exists hands them
    // half the credential.
    expect(wrongPassword).toEqual({ ok: false, error: LOGIN_FAILED });
    expect(unknownEmail).toEqual({ ok: false, error: LOGIN_FAILED });
  });

  it("refuses a deactivated account, and kills the session it already held", async () => {
    const token = await createStaffSession(staffB.id);
    expect(await resolveStaffToken(token)).not.toBeNull();

    await prisma.user.update({ where: { id: staffB.id }, data: { isActive: false } });

    // Both halves matter. The login door closes, and - because resolution
    // joins onto the user rather than trusting the session row alone - the
    // session they are already holding stops working on the very next
    // request. "I've removed their access" has to be true when it is said,
    // not twelve hours later.
    expect(await signInStaff(staffB.email, PASSWORD)).toEqual({ ok: false, error: LOGIN_FAILED });
    expect(await resolveStaffToken(token)).toBeNull();

    await prisma.user.update({ where: { id: staffB.id }, data: { isActive: true } });
  });

  it("revokes one session without touching the others", async () => {
    const desk = await createStaffSession(staffA.id);
    const laptop = await createStaffSession(staffA.id);

    expect(await revokeStaffSessionByToken(desk, "SIGNED_OUT")).toBe(true);
    expect(await resolveStaffToken(desk)).toBeNull();
    expect(await resolveStaffToken(laptop)).not.toBeNull();

    // A second sign-out must not overwrite the reason the first recorded.
    expect(await revokeStaffSessionByToken(desk, "PASSWORD_CHANGED")).toBe(false);
    const row = await prisma.staffSession.findFirst({ where: { userId: staffA.id, revokedReason: "SIGNED_OUT" } });
    expect(row).not.toBeNull();
  });

  it("ends every session at once when it has to", async () => {
    const one = await createStaffSession(staffA.id);
    const two = await createStaffSession(staffA.id);

    expect(await revokeAllStaffSessions(staffA.id, "PASSWORD_CHANGED")).toBeGreaterThanOrEqual(2);
    expect(await resolveStaffToken(one)).toBeNull();
    expect(await resolveStaffToken(two)).toBeNull();
  });

  it("refuses an expired session", async () => {
    const token = await createStaffSession(staffA.id);
    const thirteenHoursOn = new Date(Date.now() + 13 * 60 * 60 * 1000);
    expect(await resolveStaffToken(token, thirteenHoursOn)).toBeNull();
  });

  it("stores no token, only its hash", async () => {
    const token = await createStaffSession(staffA.id);
    const rows = await prisma.staffSession.findMany({ where: { userId: staffA.id }, select: { tokenHash: true } });
    expect(rows.every((r) => r.tokenHash !== token)).toBe(true);
    // A database dump must not be a set of live sessions.
    expect(rows.some((r) => r.tokenHash.length === 64)).toBe(true);
  });
});

describe("which host is which", () => {
  const ROOT = "qumo.co.za";

  it("recognises the console at app, and only at app", () => {
    expect(isConsoleHost("app.qumo.co.za", ROOT)).toBe(true);
    expect(isConsoleHost("APP.Qumo.CO.ZA:443", ROOT)).toBe(true);
    expect(isConsoleHost("chicken-licken.qumo.co.za", ROOT)).toBe(false);
    expect(isConsoleHost("qumo.co.za", ROOT)).toBe(false);
    // The near miss worth being explicit about: somebody else's domain with
    // our shape.
    expect(isConsoleHost("app.notqumo.co.za", ROOT)).toBe(false);
    expect(isConsoleHost("evil.app.qumo.co.za", ROOT)).toBe(false);
  });

  it("never lets a brand claim the console's address", () => {
    // The two rules have to agree, and this is the assertion that they do.
    expect(brandSlugFromHost("app.qumo.co.za", ROOT)).toBeNull();
  });
});

describe("roles", () => {
  it("throws rather than returning false, so a forgotten check fails loudly", () => {
    expect(() => requireRole("OWNER", ["OWNER", "ADMIN"])).not.toThrow();
    expect(() => requireRole("QUALITY", ["OWNER", "ADMIN"])).toThrow(ForbiddenError);
  });
});
