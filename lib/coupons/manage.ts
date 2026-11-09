import type { CouponFraudReason, Role } from "@prisma/client";
import { forBrand } from "@/lib/db/tenant";
import { prisma } from "@/lib/db/client";
import { record } from "@/lib/audit/record";
import { requireRole } from "@/lib/auth/rbac";
import type { Actor } from "@/lib/staff/actor";

/**
 * Handing a reward over, which is the half of the loop that did not exist.
 *
 * A completed stamp card has always issued a real coupon. Nothing anywhere
 * moved one out of ISSUED: `REDEEMED` sat in schema.prisma and in no
 * TypeScript file, and `CouponFraudEvent.ALREADY_REDEEMED` could never fire
 * because nothing ever set the status it would be checking. The practical
 * effect was that the same screenshot worked at every counter, for ever,
 * and a brand honouring coupons by eye had no defence. This file is what
 * the schema has been describing all along.
 *
 * ── Why this returns a result instead of throwing ────────────────────────
 *
 * "Already redeemed" is not an exceptional condition. It is the answer the
 * person at the counter needs, and it needs to arrive with when and by whom
 * attached, because the next thing that happens is a conversation with a
 * shopper who says they have not used it. An exception carrying a string
 * would make that conversation harder. The only thing thrown here is the
 * role check, which is a bug in the caller rather than an outcome.
 */

/**
 * QUALITY is packaging and product intelligence only, so it is out.
 * Everyone else who can sign in to the console can hand a reward over.
 *
 * Worth naming rather than quietly deciding: the right answer eventually is
 * a per-store staff role, because a barista does not want an account that
 * can also change the earn rate. That is a decision for the first brand
 * whose counters actually run this, not a guess made now. Until then a
 * single-site brand runs it from the console logins it already has.
 */
export const REDEEM_COUPON_ROLES: Role[] = ["OWNER", "ADMIN", "MARKETING"];

export type RedeemRefusal = Extract<
  CouponFraudReason,
  "NOT_FOUND" | "ALREADY_REDEEMED" | "ALREADY_CANCELLED" | "EXPIRED"
>;

export type RedeemResult =
  | {
      ok: true;
      code: string;
      /** What the shopper was promised, for the person reading it back to them. */
      rewardName: string;
      /** The brand's own label for the coupon, where one is set. */
      couponName: string | null;
      redeemedAt: Date;
    }
  | {
      ok: false;
      code: string;
      reason: RedeemRefusal;
      /** Set for ALREADY_REDEEMED and ALREADY_CANCELLED: when it happened. */
      changedAt?: Date | null;
      /** Set for ALREADY_REDEEMED: the staff member who took it. */
      changedBy?: string | null;
      /** Set for EXPIRED: the date it ran out. */
      expiredAt?: Date | null;
    };

/**
 * Upper-cases and strips whitespace, and does nothing cleverer than that.
 *
 * The generated alphabet already leaves out 0, 1, I, L and O precisely so a
 * code read off a phone screen at a till is not mistyped, which means there
 * is no ambiguous character left to map. Hyphens are part of the code and
 * are kept: a brand's prefix is a hyphenated segment, so throwing them away
 * would make "FC-7XQP-928K" and "FC7XQP928K" two different questions to ask
 * the database rather than one.
 */
export function normaliseCouponCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

async function refuse(
  session: Actor,
  code: string,
  reason: RedeemRefusal,
  couponId: string | null,
): Promise<void> {
  // Every refusal is written down, a mistyped code included. That is noisy
  // by design: this table is the only record that anybody tried, and the
  // pattern worth catching - somebody working through codes at a counter -
  // looks exactly like a run of typos until you can see them together.
  await forBrand(session.user.brandId).couponFraudEvent.create({
    data: {
      brandId: session.user.brandId,
      couponCode: code,
      couponId,
      reason,
      attemptedByUserId: session.user.id,
    },
  });
}

/**
 * Takes a coupon at the counter.
 *
 * `now` is injectable so the expiry branch can be tested without waiting a
 * day; every real caller omits it.
 */
export async function redeemCouponForSession(
  session: Actor,
  rawCode: string,
  now: Date = new Date(),
): Promise<RedeemResult> {
  requireRole(session.user.role as Role, REDEEM_COUPON_ROLES);

  const code = normaliseCouponCode(rawCode);
  const db = forBrand(session.user.brandId);

  // findFirst rather than findUnique: the code is unique across the table,
  // but the lookup has to be scoped to this brand, and a brand asking about
  // another brand's coupon must get "not a code of yours" rather than a
  // record it has no business seeing.
  const coupon = await db.coupon.findFirst({
    where: { code },
    include: { reward: true, statusChangedByUser: { select: { name: true } } },
  });

  if (!coupon) {
    await refuse(session, code, "NOT_FOUND", null);
    return { ok: false, code, reason: "NOT_FOUND" };
  }

  if (coupon.status === "REDEEMED") {
    await refuse(session, code, "ALREADY_REDEEMED", coupon.id);
    return {
      ok: false,
      code,
      reason: "ALREADY_REDEEMED",
      changedAt: coupon.statusChangedAt,
      changedBy: coupon.statusChangedByUser?.name ?? null,
    };
  }

  if (coupon.status === "CANCELLED") {
    await refuse(session, code, "ALREADY_CANCELLED", coupon.id);
    return { ok: false, code, reason: "ALREADY_CANCELLED", changedAt: coupon.statusChangedAt };
  }

  if (coupon.status === "EXPIRED" || (coupon.expiresAt && coupon.expiresAt <= now)) {
    // An expiry that has passed is recorded on the row the first time
    // anybody notices, rather than left as a date the reader has to compare
    // against the clock themselves. Nothing sweeps for these, so "noticed"
    // is the only moment there is.
    if (coupon.status !== "EXPIRED") {
      await db.coupon.updateMany({
        where: { id: coupon.id, status: "ISSUED" },
        data: { status: "EXPIRED", statusChangedAt: now, statusChangedByUserId: session.user.id },
      });
    }
    await refuse(session, code, "EXPIRED", coupon.id);
    return { ok: false, code, reason: "EXPIRED", expiredAt: coupon.expiresAt };
  }

  // The guard against two tills taking the same coupon in the same second.
  // The read above cannot carry that weight: between it and this write,
  // another counter can finish. `status: "ISSUED"` in the where clause means
  // the database decides, and a count of zero means somebody else won.
  const taken = await db.coupon.updateMany({
    where: { id: coupon.id, status: "ISSUED" },
    data: { status: "REDEEMED", statusChangedAt: now, statusChangedByUserId: session.user.id },
  });

  if (taken.count === 0) {
    const winner = await db.coupon.findFirst({
      where: { id: coupon.id },
      include: { statusChangedByUser: { select: { name: true } } },
    });
    await refuse(session, code, "ALREADY_REDEEMED", coupon.id);
    return {
      ok: false,
      code,
      reason: "ALREADY_REDEEMED",
      changedAt: winner?.statusChangedAt ?? null,
      changedBy: winner?.statusChangedByUser?.name ?? null,
    };
  }

  await record(prisma, session.user, {
    action: "coupon.redeemed",
    targetId: coupon.id,
    targetLabel: code,
  });

  return {
    ok: true,
    code,
    rewardName: coupon.reward.rewardName,
    couponName: coupon.reward.couponName,
    redeemedAt: now,
  };
}

export type RecentRedemption = {
  code: string;
  rewardName: string;
  at: Date;
  by: string | null;
};

/**
 * The last few coupons taken, for the counter to check itself against.
 *
 * Worth the query on a screen whose whole job is a single irreversible
 * action: the question right after "did that go through" is "what did I
 * just do", and the alternative to answering it here is a shopper standing
 * at the till while somebody opens the activity log.
 */
export async function listRecentRedemptions(brandId: string, limit = 8): Promise<RecentRedemption[]> {
  const rows = await forBrand(brandId).coupon.findMany({
    where: { status: "REDEEMED" },
    orderBy: { statusChangedAt: "desc" },
    take: limit,
    include: { reward: { select: { rewardName: true } }, statusChangedByUser: { select: { name: true } } },
  });

  return rows.map((row) => ({
    code: row.code,
    rewardName: row.reward.rewardName,
    at: row.statusChangedAt ?? row.issuedAt,
    by: row.statusChangedByUser?.name ?? null,
  }));
}
