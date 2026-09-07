/**
 * Whether a shopper is offered the option to spend a balance at a till.
 *
 * Off, and it is a correction rather than a caution.
 *
 * The redemption flow is half a flow. A shopper could generate a spend code
 * and there is no screen anywhere that confirms one - `confirmWalletSpend`
 * in lib/wallet/spend.ts has a full engine implementation, a test suite,
 * and no caller in `app/`. So the shopper half was live, reachable, and led
 * to a code nobody could redeem: worse than an unbuilt feature, because an
 * unbuilt feature does not make a promise.
 *
 * Turning it off is one line and honest. The design decision behind the
 * parking has not changed: the two-phase flow assumes every till has a
 * staffed Qumo login, which is a large operational ask of a franchise, and
 * the right people to settle it are the brand whose counters would run it.
 *
 * ── What this becomes ────────────────────────────────────────────────────
 *
 * A constant now, a column on Brand later. Some brands will have tills that
 * can run a confirmation screen and some will not, so this is per-brand in
 * the end. It is a constant today because a schema change to express "not
 * yet, for anybody" would be ceremony around a boolean.
 *
 * Turn it on when a cashier screen exists, and not before.
 */
export const REDEMPTION_AVAILABLE = false;
