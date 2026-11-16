import { percentOfSpend } from "@/lib/ledger/percent";

/**
 * The arithmetic behind the cost calculator on the console's How it works
 * page. Pure, so it can be tested, and so the same file runs on the server
 * for the first paint and in the browser as somebody moves a slider.
 *
 * ── What it is, and what it is not ───────────────────────────────────────
 *
 * A teaching tool. Nothing here reads a promotion, a brand or a ledger, and
 * nothing it shows is a prediction: the inputs are whatever the reader
 * drags to, and the page says so. What it is held to is *agreeing with the
 * engine*. A guide that says a promotion stops at its total while the ledger
 * lets it run on is worse than no guide, which is the rule the rest of that
 * page already follows by importing its constants.
 *
 * So the two places the engine has an opinion are not re-derived here:
 *
 *   - a share of spend is rounded by `percentOfSpend`, the function the
 *     ledger calls, so the "R119.99 pays R5.99" example is the real rounding
 *     and not a description of it;
 *   - the ceilings are the three the engine has (prisma/schema.prisma,
 *     EarnRule): a total, a value per person per day, and a number of scans
 *     per person per day. Three because they stop three different things
 *     and any one alone is walkable.
 *
 * Everything is integer cents until it is formatted, like the ledger.
 */

export type AwardShape = "FLAT" | "PERCENT";

export interface CostInput {
  shape: AwardShape;
  /** "The same amount every scan", in cents. */
  flatCents: number;
  /** "A share of what they spend", in basis points. 500 is 5%. */
  basisPoints: number;
  /** A typical basket, in cents. Only a share of spend looks at it. */
  basketCents: number;
  /** The total budget: the most this promotion may ever issue, in cents. */
  totalCents: number;
  /** The most one person can earn in a day, in cents. */
  perPersonPerDayCents: number;
  /** Scans one person may earn from in a day. Null is no limit. */
  scansPerDay: number | null;
}

/** Which of the two per-person limits is the one that actually stops somebody. */
export type BindingLimit = "value" | "scans" | "none";

export type Exposure = "low" | "high" | "all";

export interface CostResult {
  /** What one scan pays, rounded the way the ledger rounds it. */
  awardCents: number;
  /** The same, before rounding, so the rounding can be shown rather than asserted. Null for a flat amount. */
  exactAwardCents: number | null;
  /** Scans before the total budget is spent. Null when a scan pays nothing. */
  scansToBudget: number | null;
  /** The most one person can take in a day, under whichever limit bites first. */
  personDailyMaxCents: number;
  bindingLimit: BindingLimit;
  /** What that person takes in a month at the daily maximum, never more than the total. */
  personMonthCents: number;
  /** That, as a share of the total budget, 0 to 1. */
  personMonthReach: number;
  /**
   * How many person-days at the daily maximum use up the whole budget. It
   * reads two ways and the page shows both: one person alone for this many
   * days, or this many people in a single day. Null if nobody earns.
   */
  personDaysToBudget: number | null;
  exposure: Exposure;
}

/**
 * A month, for the one-person comparison. Thirty, said plainly on the page
 * as an illustration, because the engine's own window is a rolling day and
 * this is only a way to make a daily figure feel like a quantity.
 */
export const MONTH_DAYS = 30;

/** An exposure is "high" from this share of the total in one person's month. */
const HIGH_REACH = 0.4;

export function calculateCost(input: CostInput): CostResult {
  const exactAwardCents = input.shape === "PERCENT" ? (input.basketCents * input.basisPoints) / 10_000 : null;
  const awardCents =
    input.shape === "PERCENT" ? percentOfSpend(input.basketCents, input.basisPoints) : input.flatCents;

  const scansToBudget = awardCents > 0 ? Math.floor(input.totalCents / awardCents) : null;

  // The scan limit turns into a value by multiplying through the award, so
  // the two per-person limits can be compared in the one unit.
  const scanLimitCents = input.scansPerDay === null ? Number.POSITIVE_INFINITY : input.scansPerDay * awardCents;
  const valueLimitCents = input.perPersonPerDayCents;

  let personDailyMaxCents: number;
  let bindingLimit: BindingLimit;
  if (awardCents <= 0) {
    personDailyMaxCents = 0;
    bindingLimit = "none";
  } else if (scanLimitCents < valueLimitCents) {
    personDailyMaxCents = scanLimitCents;
    bindingLimit = "scans";
  } else {
    personDailyMaxCents = valueLimitCents;
    bindingLimit = "value";
  }

  // A person can take at most what is in the budget. Shown as such, so a
  // reader never sees a figure larger than the thing that bounds it.
  const personMonthCents = Math.min(personDailyMaxCents * MONTH_DAYS, input.totalCents);
  const personMonthReach = input.totalCents > 0 ? personMonthCents / input.totalCents : 0;

  const personDaysToBudget = personDailyMaxCents > 0 ? Math.ceil(input.totalCents / personDailyMaxCents) : null;

  let exposure: Exposure = "low";
  if (personMonthReach >= 1) exposure = "all";
  else if (personMonthReach >= HIGH_REACH) exposure = "high";

  return {
    awardCents,
    exactAwardCents,
    scansToBudget,
    personDailyMaxCents,
    bindingLimit,
    personMonthCents,
    personMonthReach,
    personDaysToBudget,
    exposure,
  };
}

/** 20000 -> "20,000". By hand: toLocaleString differs by locale and by runtime, and this renders on both sides. */
function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Cents as a rand amount: "R5", "R5.99", "R20,000".
 *
 * Whole rands lose their ".00", because a slider that reads "R20,000.00" is
 * noise, and a fractional one keeps both digits, because "R5.9" reads as
 * R5.90. Built by hand rather than with toLocaleString for the reason
 * formatLedgerAmount is: en-ZA groups with a non-breaking space and puts the
 * decimal point on a comma, and an amount assembled on the server one way and
 * in the browser another is a hydration mismatch that settles on the wrong
 * number.
 */
export function formatRand(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const rand = Math.floor(abs / 100);
  const rest = abs % 100;
  return rest === 0 ? `${sign}R${group(rand)}` : `${sign}R${group(rand)}.${String(rest).padStart(2, "0")}`;
}

/** A count with thousands separators, for "4,000 scans". */
export function formatCount(n: number): string {
  return group(Math.round(n));
}

/** Basis points as a percentage, without a trailing zero: 500 -> "5%", 250 -> "2.5%". */
export function formatPercent(basisPoints: number): string {
  return `${Number((basisPoints / 100).toFixed(2))}%`;
}

/** What the controls offer. In cents and basis points, like everything the maths takes. */
export const COST_CONTROLS = {
  flatChoicesCents: [200, 500, 1000],
  basisPointChoices: [250, 500, 1000],
  basket: { minCents: 4_000, maxCents: 40_000, stepCents: 1_000 },
  total: { minCents: 500_000, maxCents: 10_000_000, stepCents: 500_000 },
  perPersonPerDay: { minCents: 500, maxCents: 10_000, stepCents: 500 },
  scansPerDayChoices: [1, 2, 5, null] as const,
} as const;

/** Where the reader starts. Made-up, and chosen so that the first thing on screen is a promotion that is fine. */
export const COST_DEFAULTS: CostInput = {
  shape: "FLAT",
  flatCents: 500,
  basisPoints: 500,
  basketCents: 12_000,
  totalCents: 2_000_000,
  perPersonPerDayCents: 2_000,
  scansPerDay: 2,
};
