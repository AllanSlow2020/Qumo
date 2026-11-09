import type { EarnRuleType } from "@prisma/client";
import { percentOfSpend } from "@/lib/ledger/accrue";

/**
 * Which promotions a till slip can earn from, and what one is worth.
 *
 * ── Why this is its own module ───────────────────────────────────────────
 *
 * Two places have to agree on the answer and they are not near each other.
 * `lib/stores/receipt.ts` resolves a scanned slip to a promotion, and
 * `lib/campaigns/manage.ts` refuses to switch on a second promotion that
 * the same slip could also satisfy. If those two drift, a brand is allowed
 * to create an ambiguity the engine then resolves by whichever row is
 * older, which is the kind of silence that shows up as "why did that slip
 * only give a stamp".
 *
 * ── What changed, and why it was wrong before ────────────────────────────
 *
 * The slip path used to resolve campaigns through a single filter,
 * `type: "PERCENT_OF_SPEND"`. So the only way to get stamps out of a till
 * slip was a share-of-spend rule awarded in stamps, which multiplies
 * stamps by rands: at the award form's own default of 500 basis points, a
 * R100 basket awarded 500 stamps. A coffee shop with a till and no printed
 * pack codes - which is most coffee shops - could not run "buy ten, get
 * one free" at all, except by configuring the one combination that is
 * actively broken.
 *
 * A flat rule has nothing to multiply. It awards what it says.
 */

/** Just enough of an EarnRule to decide a slip's fate. */
export type SlipRule = {
  type: EarnRuleType;
  amount: number;
  basisPoints: number | null;
};

/**
 * Whether a slip could earn from this rule at all, as configured.
 *
 * A share of spend with no percentage, and a flat rule awarding nothing,
 * are both half-configured promotions. Awarding nothing is the right
 * answer until somebody finishes them, and saying so at resolution time
 * means the slip comes back as "no promotion running" rather than as a
 * scan that silently consumed a receipt for zero.
 */
export function isSlipEarnable(rule: SlipRule | null | undefined): boolean {
  if (!rule) return false;
  if (rule.type === "PERCENT_OF_SPEND") return rule.basisPoints != null;
  return rule.amount > 0;
}

/**
 * What this basket earns under this rule.
 *
 * Callers check `isSlipEarnable` first; a rule that fails it returns 0,
 * which every caller already treats as nothing to award.
 */
export function slipAward(rule: SlipRule, amountCents: number): number {
  if (rule.type === "PERCENT_OF_SPEND") {
    return rule.basisPoints == null ? 0 : percentOfSpend(amountCents, rule.basisPoints);
  }
  return rule.amount > 0 ? rule.amount : 0;
}
