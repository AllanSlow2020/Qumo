import { randomUUID } from "node:crypto";
import type { Brand, User } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { hashPassword } from "@/lib/staff/password";
import { signInStaff } from "@/lib/staff/login";
import { changeOwnPassword, inviteUserForSession, resetSecondFactorForSession } from "@/lib/staff/users";
import { secondFactorOutstanding } from "@/lib/staff/current";
import { beginEnrolment, confirmEnrolment, getSecondFactorState } from "@/lib/staff/mfa";
import { totpCode } from "@/lib/staff/totp";
import { decryptSecret } from "@/lib/security/crypto";
import type { StaffIdentity } from "@/lib/staff/session";

/**
 * Standing up a second owner, start to finish.
 *
 * Every piece of this is covered somewhere else. What is not covered
 * anywhere else is the sequence, and the sequence is the thing somebody
 * actually performs - on production, once, against the account that can
 * lock everybody out.
 *
 * It matters because a brand with one owner has no recovery route. The
 * reset path refuses your own account, deliberately, so the second owner is
 * what turns "another owner can reset you" from a sentence into something
 * that is true. This file is the claim that the route exists and that
 * walking it does not require anything the console cannot do.
 */

const run = randomUUID().slice(0, 8);
const FIRST_PASSWORD = "the-first-owners-password";
const CHOSEN_PASSWORD = "a-sentence-the-second-owner-picked";

let brand: Brand;
let first: User;

const as = (user: { id: string; brandId: string; role: string; name: string; email: string }) => ({ user });

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** Enrolment, through the same functions the screen calls. */
async function enrol(user: { id: string; brandId: string; role: string; name: string; email: string }) {
  await beginEnrolment(as(user), "Qumo");
  const row = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { totpSecretEncrypted: true },
  });
  const secret = decryptSecret(row.totpSecretEncrypted!);
  await confirmEnrolment(as(user), totpCode(secret, new Date()));
  return secret;
}

/** Just enough of an identity for secondFactorOutstanding. */
const identity = (user: { id: string; brandId: string; role: string; name: string; email: string }) =>
  ({
    sessionId: `session-${user.id}`,
    userId: user.id,
    brandId: user.brandId,
    role: user.role,
    name: user.name,
    email: user.email,
  }) as StaffIdentity;

beforeAll(async () => {
  brand = await prisma.brand.create({ data: { name: `Second owner ${run}`, slug: `second-owner-${run}` } });
  first = await prisma.user.create({
    data: {
      brandId: brand.id,
      email: `first-${run}@x.invalid`,
      name: "Thandi",
      role: "OWNER",
      passwordHash: await hashPassword(FIRST_PASSWORD),
    },
  });
});

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { brandId: brand.id } });
  await prisma.staffRecoveryCode.deleteMany({ where: { user: { brandId: brand.id } } });
  await prisma.staffSession.deleteMany({ where: { user: { brandId: brand.id } } });
  await prisma.user.deleteMany({ where: { brandId: brand.id } });
  await prisma.brand.delete({ where: { id: brand.id } });
});

describe("standing up a second owner", () => {
  it("walks the whole sequence, and ends with a recovery route that works", async () => {
    const firstActor = {
      id: first.id,
      brandId: first.brandId,
      role: first.role,
      name: first.name,
      email: first.email,
    };

    // ── 1. The first owner invites a second, as an owner ─────────────────
    //
    // Owner-only, which the first owner is. The role matters: an admin
    // cannot reset anybody, so inviting one would not create a recovery
    // route at all.
    const invited = await inviteUserForSession(
      as(firstActor),
      form({ email: `second-${run}@x.invalid`, name: "Sipho", role: "OWNER" }),
    );

    expect(invited.temporaryPassword.length).toBeGreaterThan(10);

    // ── 2. The temporary password signs them in, once ────────────────────
    const firstSignIn = await signInStaff(invited.email, invited.temporaryPassword);
    expect(firstSignIn.ok).toBe(true);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: invited.id } });
    expect(fresh.mustChangePassword).toBe(true);

    const secondActor = {
      id: fresh.id,
      brandId: fresh.brandId,
      role: fresh.role,
      name: fresh.name,
      email: fresh.email,
    };

    // ── 3. They choose their own password ────────────────────────────────
    await changeOwnPassword(fresh.id, invited.temporaryPassword, CHOSEN_PASSWORD);

    const afterPassword = await prisma.user.findUniqueOrThrow({ where: { id: fresh.id } });
    expect(afterPassword.mustChangePassword).toBe(false);

    // ── 4. And are then held for a second factor, because OWNER ──────────
    //
    // The order matters and is asserted rather than assumed: a second
    // factor on an account whose password is still the one that was handed
    // out protects the wrong thing, so the password comes first.
    expect(await secondFactorOutstanding(identity(secondActor))).toBe(true);

    await enrol(secondActor);
    expect(await secondFactorOutstanding(identity(secondActor))).toBe(false);

    // ── 5. The route out now exists ──────────────────────────────────────
    //
    // The whole reason for doing any of this. The first owner loses their
    // phone and their recovery codes; the second clears their factor, and
    // they enrol again on a new device.
    await enrol(firstActor);
    expect((await getSecondFactorState(first.id)).enabled).toBe(true);

    await resetSecondFactorForSession(as(secondActor), first.id, CHOSEN_PASSWORD);

    expect((await getSecondFactorState(first.id)).enabled).toBe(false);

    // And it is a reset rather than a way in: the first owner still needs
    // their own password, and must enrol again before the console opens.
    expect((await signInStaff(first.email, FIRST_PASSWORD)).ok).toBe(true);
    expect(await secondFactorOutstanding(identity(firstActor))).toBe(true);
  });

  it("still refuses the second owner their own account", async () => {
    // The rule does not weaken just because there are two of them. Each can
    // reset the other and neither can reset themselves, which is what keeps
    // this a recovery route rather than an opt-out.
    const second = await prisma.user.findFirstOrThrow({
      where: { brandId: brand.id, email: { startsWith: `second-${run}` } },
    });

    await expect(
      resetSecondFactorForSession(
        as({
          id: second.id,
          brandId: second.brandId,
          role: second.role,
          name: second.name,
          email: second.email,
        }),
        second.id,
        CHOSEN_PASSWORD,
      ),
    ).rejects.toThrow(/your own/i);
  });
});
