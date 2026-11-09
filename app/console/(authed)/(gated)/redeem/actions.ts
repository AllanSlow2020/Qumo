"use server";

import { ForbiddenError } from "@/lib/auth/rbac";
import { requireStaff } from "@/lib/staff/current";
import { redeemCouponForSession, type RedeemRefusal } from "@/lib/coupons/manage";
import type { RedeemScreenState } from "./state";

/**
 * The counter's write path. One action, because the screen does one thing.
 *
 * The engine returns a result rather than throwing for the four ways a
 * coupon can be refused, so almost all of the work here is turning that
 * result into the two sentences somebody reads out loud with a shopper
 * watching: what happened, and what to do about it.
 */

/**
 * When a coupon was taken, said the way the counter needs to hear it.
 *
 * The case that matters is the one that looks like a bug: the same shopper,
 * the same minute, somebody pressing the button twice. "Taken 09 Nov 2026
 * at 06:25" reads like a redemption from some other day, which is exactly
 * the wrong impression when the answer is "you just did that". Inside the
 * hour it says so in minutes, and past that the date is what is useful.
 */
function whenTaken(at: Date | null | undefined, now: Date): string {
  if (!at) return "earlier";
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60000);
  if (minutes < 1) return "a moment ago";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const date = at.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  const time = at.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  return `on ${date} at ${time}`;
}

/** An expiry is a date. The minute it fell on is noise. */
function whenExpired(at: Date | null | undefined): string {
  if (!at) return "earlier";
  return at.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

const HEADLINES: Record<RedeemRefusal, string> = {
  NOT_FOUND: "Not a code of yours",
  ALREADY_REDEEMED: "Already taken",
  ALREADY_CANCELLED: "Cancelled",
  EXPIRED: "Out of date",
};

export async function redeemCoupon(
  _prev: RedeemScreenState,
  formData: FormData,
): Promise<RedeemScreenState> {
  const raw = String(formData.get("code") ?? "").trim();
  if (!raw) {
    return { status: "error", message: "Type the code off the shopper's phone." };
  }

  try {
    const staff = await requireStaff();
    const session = {
      user: { id: staff.userId, brandId: staff.brandId, role: staff.role, name: staff.name, email: staff.email },
    };
    const result = await redeemCouponForSession(session, raw);

    if (result.ok) {
      return {
        status: "taken",
        code: result.code,
        rewardName: result.rewardName,
        couponName: result.couponName,
      };
    }

    // Each of these is read out to somebody standing at a till, so each one
    // says what is true and what happens next, rather than naming a state.
    const now = new Date();
    const line =
      result.reason === "ALREADY_REDEEMED"
        ? `Taken ${whenTaken(result.changedAt, now)}${result.changedBy ? ` by ${result.changedBy}` : ""}. Don't hand anything over.`
        : result.reason === "EXPIRED"
          ? `This reward ran out on ${whenExpired(result.expiredAt)}. Nothing to hand over.`
          : result.reason === "ALREADY_CANCELLED"
            ? `Cancelled ${whenTaken(result.changedAt, now)}. Nothing to hand over.`
            : "Check the code and try again. If it keeps failing, the shopper earned it from another brand.";

    return { status: "refused", code: result.code, reason: result.reason, headline: HEADLINES[result.reason], line };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { status: "error", message: "Your role can't redeem rewards. Ask an owner or admin." };
    }
    console.error("[console/redeem]", err);
    return { status: "error", message: "Something went wrong. Try again." };
  }
}
