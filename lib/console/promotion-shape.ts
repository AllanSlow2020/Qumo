import type { EarnRuleType, LedgerUnit } from "@prisma/client";

/**
 * The three promotions a brand can actually describe, named the way they
 * would say them out loud.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * The console used to ask two independent questions, "Kind" and "Awarded
 * in", which is the shape of the database row rather than the shape of the
 * decision. Six combinations came out of it. Two are the same promotion
 * said twice, one is meaningless, and one is actively dangerous: a share
 * of spend awarded in stamps multiplies stamps by rands, so at the form's
 * own default of 500 basis points a R100 basket awarded 500 stamps. The
 * demo data contains exactly that, and whoever set it up was not being
 * careless: it is the only lever that produces stamps from a till slip.
 *
 * So the fix is not a better label on the old question. It is asking one
 * question with three answers and deriving the row from it.
 *
 * ── Why a shape can be null ──────────────────────────────────────────────
 *
 * `shapeOfRule` returns null for a stored rule none of the three describe,
 * which today means the share-in-stamps combination and share-in-points.
 * Those rows exist and still run, so the console has to be able to draw
 * one. Returning null rather than guessing is what lets it say "this does
 * not match any of the kinds below" instead of redrawing it as something
 * it is not and quietly rewriting it on the next save.
 */
export type PromotionShape = "STAMP_CARD" | "SHARE_OF_SPEND" | "FIXED_PER_SCAN";

/** The order they are offered in, commonest first. */
export const PROMOTION_SHAPES: PromotionShape[] = ["STAMP_CARD", "SHARE_OF_SPEND", "FIXED_PER_SCAN"];

export type ShapeCopy = {
  /** The sentence in the chooser. */
  label: string;
  /** What it does, in the brand's terms. */
  blurb: string;
  /** Where the proof comes from. The thing the old form never said. */
  door: string;
};

export const SHAPE_COPY: Record<PromotionShape, ShapeCopy> = {
  STAMP_CARD: {
    label: "A stamp card. Buy ten, get one free",
    blurb:
      "Every purchase earns one stamp. When the card is full the shopper is given whatever you name on the next step.",
    door: "Stamps come from a code under a pack or on a sticker. A till slip cannot award a stamp yet.",
  },
  SHARE_OF_SPEND: {
    label: "A share of what they spend",
    blurb: "A percentage of the basket, so a bigger shop earns more. The only kind that knows what was spent.",
    door: "Needs a till slip from one of your stores, because only a slip says what was spent.",
  },
  FIXED_PER_SCAN: {
    label: "The same amount every scan",
    blurb: "Every valid scan earns the same, whatever was bought. The simplest promotion to run and to explain.",
    door: "Works on anything unique: a code under a pack, a sticker on a bottle.",
  },
};

/**
 * What a rule looks like once a shape has been chosen and nothing else has.
 *
 * A stamp card is one stamp a purchase, and that is not a default anybody
 * should be asked to type: the number a brand cares about is how many fill
 * a card, which is the next step. The other two carry a figure the brand
 * is expected to change, so the defaults are deliberately round rather than
 * tempting: R5 and 5%.
 */
export const SHAPE_DEFAULTS: Record<
  PromotionShape,
  { type: EarnRuleType; unit: LedgerUnit; amount: number; basisPoints: number | null }
> = {
  STAMP_CARD: { type: "FLAT_PER_SCAN", unit: "STAMPS", amount: 1, basisPoints: null },
  SHARE_OF_SPEND: { type: "PERCENT_OF_SPEND", unit: "CENTS", amount: 0, basisPoints: 500 },
  FIXED_PER_SCAN: { type: "FLAT_PER_SCAN", unit: "CENTS", amount: 500, basisPoints: null },
};

/** Just enough of an EarnRule to name its shape. */
export type ShapeableRule = { type: EarnRuleType; unit: LedgerUnit };

/**
 * Which of the three a stored rule is, or null if it is none of them.
 *
 * Deliberately not a lookup on `type` alone. A flat rule in stamps and a
 * flat rule in rands are the same row type and two different promotions to
 * the brand running them, and that conflation is what the old form made a
 * brand untangle for themselves.
 */
export function shapeOfRule(rule: ShapeableRule | null | undefined): PromotionShape | null {
  if (!rule) return null;
  if (rule.type === "PERCENT_OF_SPEND") {
    // A share of the basket is an amount of money. In stamps it multiplies
    // stamps by rands; in points it is a points rule nobody can reason
    // about. Neither is offered, and neither is silently rewritten.
    return rule.unit === "CENTS" ? "SHARE_OF_SPEND" : null;
  }
  return rule.unit === "STAMPS" ? "STAMP_CARD" : "FIXED_PER_SCAN";
}

/**
 * Whether this shape's award is settled by the shape itself.
 *
 * True only for a stamp card, where "one stamp a purchase" is the whole
 * rule. The step still has something to show, but nothing to ask.
 */
export function shapeFixesAmount(shape: PromotionShape): boolean {
  return shape === "STAMP_CARD";
}

/**
 * Whether a brand choosing this shape is choosing a stamp card, and so has
 * to finish the card step before anything can be switched on.
 *
 * The card step is optional for every other shape, and calling it optional
 * on a stamp card was the console telling a coffee shop that the number of
 * coffees was a detail it could skip.
 */
export function shapeNeedsCard(shape: PromotionShape | null): boolean {
  return shape === "STAMP_CARD";
}

/**
 * Whether the proof-of-purchase floor means anything for this shape.
 *
 * Only for a share of spend, and this is a correction rather than a
 * preference. `setEarnRuleForSession` does not read `minProofTier` at all,
 * so on a flat rule the old form rendered a control, let a brand choose a
 * stricter floor, and threw the answer away on save.
 */
export function shapeUsesProof(shape: PromotionShape | null): boolean {
  return shape === "SHARE_OF_SPEND";
}

/**
 * Whether a minimum basket means anything for this shape.
 *
 * Same correction. `setEarnRuleForSession` writes `minSpendCents: null` on
 * every flat rule, so the field was discarded on save there too. It is
 * also the honest answer: a pack code has no basket to measure.
 */
export function shapeUsesMinimumBasket(shape: PromotionShape | null): boolean {
  return shape === "SHARE_OF_SPEND";
}
