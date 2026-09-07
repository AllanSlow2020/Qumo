import type { SubscriptionStatus } from "@prisma/client";

/**
 * What a brand's standing means for its shoppers, derived rather than stored.
 *
 * The important property: a cancelled programme closes when its window
 * elapses whether or not anything ran to notice. A nightly job that marks
 * rows CLOSED is an optimisation - if it fails for a week, this still gives
 * the right answer, because the answer is computed from the date rather than
 * looked up from a flag somebody was supposed to have set.
 *
 * Building it the other way round is how a brand stops paying, a cron job
 * silently fails, and the programme keeps awarding for a month.
 */

/**
 * Decided before any of this was built, and stated in the plan: earning
 * freezes at cancellation, redemption is honoured for sixty days.
 *
 * Only ever read when a cancellation is *recorded* - the resulting date is
 * stored on the row. Changing this number does not move a promise already
 * made to somebody.
 */
export const HONOUR_WINDOW_DAYS = 60;
export const HONOUR_WINDOW_MS = HONOUR_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type SubscriptionRow = {
  status: SubscriptionStatus;
  cancelledAt: Date | null;
  honourRedemptionUntil: Date | null;
} | null;

export type ProgrammeState = {
  /** Can a scan add to a balance? */
  canEarn: boolean;
  /** Can a shopper spend what they already have? */
  canRedeem: boolean;
  /** The effective status, with an elapsed window already accounted for. */
  status: SubscriptionStatus | "UNMANAGED";
  /** When redemption stops, if it is going to. */
  honourUntil: Date | null;
};

/**
 * A brand with no subscription row at all.
 *
 * Fails open - earning and redemption both continue - and that is a
 * deliberate choice for right now, not an oversight. No billing provider is
 * integrated, brands are onboarded by hand, and an absent row means "not on
 * the billing system yet" rather than "has stopped paying". Failing closed
 * today would mean a missed row silently kills a live programme.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  This is the direction to reverse the day billing exists. Once every
 *  brand is expected to have a row, an absent one is an anomaly and should
 *  refuse rather than allow. The console already shows "not on a plan" so
 *  the state is visible while it is permissive.
 * ─────────────────────────────────────────────────────────────────────────
 */
const UNMANAGED: ProgrammeState = { canEarn: true, canRedeem: true, status: "UNMANAGED", honourUntil: null };

export function programmeState(row: SubscriptionRow, now: Date = new Date()): ProgrammeState {
  if (!row) return UNMANAGED;

  switch (row.status) {
    case "TRIALING":
    case "ACTIVE":
      return { canEarn: true, canRedeem: true, status: row.status, honourUntil: null };

    case "CANCELLED": {
      // Earning stopped the moment they cancelled. Redemption continues
      // until the window closes - and if it already has, this is CLOSED
      // regardless of what the row still says.
      const until = row.honourRedemptionUntil;
      const stillHonoured = until !== null && until > now;
      return {
        canEarn: false,
        canRedeem: stillHonoured,
        status: stillHonoured ? "CANCELLED" : "CLOSED",
        honourUntil: until,
      };
    }

    case "CLOSED":
    default:
      return { canEarn: false, canRedeem: false, status: "CLOSED", honourUntil: row.honourRedemptionUntil };
  }
}
