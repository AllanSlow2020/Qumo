import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import type { EmailClient } from "@/lib/email/client";
import { completeReset, requestReset, sweepExpiredResets } from "@/lib/staff/reset";
import { hashPassword, verifyPassword } from "@/lib/staff/password";
import { createStaffSession, resolveStaffToken } from "@/lib/staff/session";

/**
 * The way back in for a staff member who has forgotten their password, and
 * in particular for the only owner of a brand, who had nobody to ask.
 *
 * Most of what follows is about what this refuses to say. A reset endpoint
 * is the classic account-enumeration oracle: answer differently for an
 * address that exists and you have turned the console login into a way to
 * ask which people work for which brand. The shopper side already refuses
 * that question, and this has to refuse it the same way.
 */
describe("staff password reset", () => {
  const suffix = Date.now();
  const EMAIL = `owner-${suffix}@example.invalid`;
  const OTHER = `other-${suffix}@example.invalid`;
  const OLD_PASSWORD = "the-old-password-1";
  const NEW_PASSWORD = "a-brand-new-password";

  /** Captures what would have been sent, and hands back the link inside it. */
  class Outbox implements EmailClient {
    sent: { to: string; subject: string; text: string }[] = [];
    async send(message: { to: string; subject: string; text: string }) {
      this.sent.push(message);
    }
    get lastToken(): string {
      const link = /token=([a-f0-9]+)/.exec(this.sent.at(-1)?.text ?? "");
      return link?.[1] ?? "";
    }
  }

  let brandId: string;
  let userId: string;
  let otherUserId: string;

  beforeEach(async () => {
    await prisma.staffPasswordReset.deleteMany({ where: { user: { email: { in: [EMAIL, OTHER] } } } });
    await prisma.staffSession.deleteMany({ where: { user: { email: { in: [EMAIL, OTHER] } } } });
    await prisma.user.deleteMany({ where: { email: { in: [EMAIL, OTHER] } } });
    await prisma.brand.deleteMany({ where: { slug: `reset-${suffix}` } });

    const brand = await prisma.brand.create({ data: { name: "Reset Co", slug: `reset-${suffix}` } });
    brandId = brand.id;

    const hash = await hashPassword(OLD_PASSWORD);
    const user = await prisma.user.create({
      data: { brandId, email: EMAIL, name: "Sam Nkosi", role: "OWNER", passwordHash: hash },
    });
    userId = user.id;

    const other = await prisma.user.create({
      data: { brandId, email: OTHER, name: "Thandi Mokoena", role: "ADMIN", passwordHash: hash },
    });
    otherUserId = other.id;
  });

  afterAll(async () => {
    await prisma.staffPasswordReset.deleteMany({ where: { user: { email: { in: [EMAIL, OTHER] } } } });
    await prisma.staffSession.deleteMany({ where: { user: { email: { in: [EMAIL, OTHER] } } } });
    await prisma.user.deleteMany({ where: { email: { in: [EMAIL, OTHER] } } });
    await prisma.brand.deleteMany({ where: { slug: `reset-${suffix}` } });
  });

  describe("what a stranger can learn", () => {
    it("answers the same for an address with an account and one without", async () => {
      const real = new Outbox();
      const fake = new Outbox();

      // Neither call returns anything, which is the point: there is no value
      // for a caller in a hurry to render.
      await expect(requestReset(EMAIL, new Date(), real)).resolves.toBeUndefined();
      await expect(requestReset(`nobody-${suffix}@example.invalid`, new Date(), fake)).resolves.toBeUndefined();

      // The only difference is invisible from outside.
      expect(real.sent).toHaveLength(1);
      expect(fake.sent).toHaveLength(0);
    });

    it("sends nothing to a deactivated account", async () => {
      await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
      const outbox = new Outbox();

      await requestReset(EMAIL, new Date(), outbox);

      // Otherwise deactivation is advisory: anybody an owner switched off
      // could reset their way back in.
      expect(outbox.sent).toHaveLength(0);
      expect(await prisma.staffPasswordReset.count({ where: { userId } })).toBe(0);
    });

    it("stores a hash, not the token in the link", async () => {
      const outbox = new Outbox();
      await requestReset(EMAIL, new Date(), outbox);

      const row = await prisma.staffPasswordReset.findFirst({ where: { userId } });
      expect(outbox.lastToken).toHaveLength(64);
      // A database dump must not be a list of live account takeovers.
      expect(row?.tokenHash).not.toBe(outbox.lastToken);
    });
  });

  describe("using the link", () => {
    it("sets the password and lets them in with it", async () => {
      const outbox = new Outbox();
      await requestReset(EMAIL, new Date(), outbox);

      expect(await completeReset(outbox.lastToken, NEW_PASSWORD)).toEqual({ ok: true });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(await verifyPassword(NEW_PASSWORD, user!.passwordHash)).toBe(true);
      expect(await verifyPassword(OLD_PASSWORD, user!.passwordHash)).toBe(false);
    });

    it("does not then ask them to change it again", async () => {
      await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: true } });
      const outbox = new Outbox();
      await requestReset(EMAIL, new Date(), outbox);

      await completeReset(outbox.lastToken, NEW_PASSWORD);

      // They just chose one. Leaving the gate set sends somebody who has
      // set a password straight to a screen asking them to set a password.
      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.mustChangePassword).toBe(false);
    });

    it("signs them out everywhere, including wherever locked them out", async () => {
      const token = await createStaffSession(userId);
      expect(await resolveStaffToken(token)).not.toBeNull();

      const outbox = new Outbox();
      await requestReset(EMAIL, new Date(), outbox);
      await completeReset(outbox.lastToken, NEW_PASSWORD);

      // A reset that left old sessions alive would be a password change
      // that did not end the thing it was changed because of.
      expect(await resolveStaffToken(token)).toBeNull();
    });

    it("works once", async () => {
      const outbox = new Outbox();
      await requestReset(EMAIL, new Date(), outbox);
      const token = outbox.lastToken;

      expect(await completeReset(token, NEW_PASSWORD)).toEqual({ ok: true });
      expect(await completeReset(token, "another-password-entirely")).toEqual({ ok: false, reason: "INVALID" });
    });

    it("expires", async () => {
      const issued = new Date("2026-03-01T09:00:00Z");
      const outbox = new Outbox();
      await requestReset(EMAIL, issued, outbox);

      const tooLate = new Date(issued.getTime() + 61 * 60 * 1000);
      expect(await completeReset(outbox.lastToken, NEW_PASSWORD, tooLate)).toEqual({ ok: false, reason: "INVALID" });
    });

    it("kills the older link when a newer one is asked for", async () => {
      const outbox = new Outbox();
      await requestReset(EMAIL, new Date(), outbox);
      const first = outbox.lastToken;
      await requestReset(EMAIL, new Date(), outbox);
      const second = outbox.lastToken;

      // Somebody asking again is usually trying to escape a link they think
      // somebody else has seen.
      expect(first).not.toBe(second);
      expect(await completeReset(first, NEW_PASSWORD)).toEqual({ ok: false, reason: "INVALID" });
      expect(await completeReset(second, NEW_PASSWORD)).toEqual({ ok: true });
    });

    it("tells unknown, spent and expired apart from a weak password, and nothing else apart", async () => {
      // One answer for every way a token can be no good, because a caller
      // cannot act on the difference and the difference is what somebody
      // probing old links wants.
      expect(await completeReset("not-a-token", NEW_PASSWORD)).toEqual({ ok: false, reason: "INVALID" });

      const outbox = new Outbox();
      await requestReset(EMAIL, new Date(), outbox);
      // Checked before the token is even looked up, so being told the
      // password is short says nothing about the link.
      expect(await completeReset("not-a-token", "short")).toEqual({ ok: false, reason: "WEAK" });
    });

    it("cannot be pointed at somebody else's account", async () => {
      const outbox = new Outbox();
      await requestReset(EMAIL, new Date(), outbox);
      await completeReset(outbox.lastToken, NEW_PASSWORD);

      const other = await prisma.user.findUnique({ where: { id: otherUserId } });
      expect(await verifyPassword(OLD_PASSWORD, other!.passwordHash)).toBe(true);
    });
  });

  describe("housekeeping", () => {
    it("sweeps rows well past their expiry", async () => {
      const longAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await requestReset(EMAIL, longAgo, new Outbox());

      expect(await sweepExpiredResets()).toBeGreaterThanOrEqual(1);
      // Keeping them is keeping a record of who forgot their password and
      // when, for no operational benefit.
      expect(await prisma.staffPasswordReset.count({ where: { userId } })).toBe(0);
    });
  });
});
