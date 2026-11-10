import type { Role } from "@prisma/client";

/**
 * Which roles may not sign in on a password alone.
 *
 * ── Why these two ────────────────────────────────────────────────────────
 *
 * OWNER and ADMIN are the roles that can change what the system is, rather
 * than operate it. Between them they can add and remove staff, change
 * somebody else's role, rotate the signing secret that decides whether a
 * till slip is trustworthy at all, and alter the brand a shopper sees. A
 * stolen password on one of those is not a data breach, it is control of
 * the programme.
 *
 * MARKETING and QUALITY are deliberately out, and it is a close call rather
 * than an obvious one: MARKETING can redeem a coupon, which is money. The
 * line is drawn at who can change the rules versus who can act within them,
 * because a redemption is bounded, visible in the ledger and attributable,
 * while a role change is none of those. Worth revisiting the first time a
 * brand runs enough volume that a marketing account is worth stealing - it
 * is one entry in the list below.
 *
 * ── Why a list and not a boolean on the row ──────────────────────────────
 *
 * Because it is policy, not state. A per-user flag would have to be set
 * correctly at every invite and every role change, and the day somebody is
 * promoted to ADMIN without it being set is the day the rule quietly does
 * not apply to the account that most needs it. Deriving it from the role
 * means a promotion carries the requirement with it, on the next request,
 * with nothing to remember.
 */
export const ROLES_REQUIRING_SECOND_FACTOR: readonly Role[] = ["OWNER", "ADMIN"];

/** Whether this role has to hold a second factor to use the console. */
export function secondFactorRequired(role: Role): boolean {
  return ROLES_REQUIRING_SECOND_FACTOR.includes(role);
}
