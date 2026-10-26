/**
 * The age step: what it asks, what it decides, and what it is worth.
 *
 * ── What this is honestly worth ──────────────────────────────────────────
 *
 * A shopper types a date. Nothing checks it against anything. Somebody who
 * is refused can type a different year thirty seconds later and get in, and
 * no arrangement of this code changes that - the phone in their hand proves
 * they control a number, not when they were born.
 *
 * So this is not proof of age and the code does not call it verification.
 * What it is worth is the thing the law actually asks of a brand running an
 * on-pack promotion: that the programme asked, that it recorded having
 * asked, and that it refused when told no. That is the standard liquor
 * promotions in this market run on, and it is a real control against the
 * ordinary case - a child who answers honestly - rather than against a
 * determined adversary.
 *
 * Real proof means an identity document checked against a register, at a
 * cost per check and a minute of somebody's time. On a mechanic whose whole
 * premise is tapping a bottle and being done, that is not a stricter
 * version of this feature, it is a different product. If a brand ever needs
 * it, it goes here beside this, and the column that records the outcome
 * already distinguishes what was established.
 *
 * ── What is stored ───────────────────────────────────────────────────────
 *
 * On a pass: when, and the minimum that was met. Not the date of birth.
 * On a fail: the date of the refusal, and nothing else whatsoever - see
 * Person.ageRefusedAt in the schema for why keeping a child's birth date
 * would be the wrong instinct dressed up as diligence.
 */

/** What the console's tick box writes. South Africa's drinking age. */
export const DEFAULT_MINIMUM_AGE = 18;

/**
 * How long a refusal lasts.
 *
 * Long enough that retrying is a decision rather than a reflex, short
 * enough that somebody who fat-fingered their year of birth is not locked
 * out of a promotion they are entitled to. It is a speed bump and is meant
 * to read as one.
 */
export const AGE_REFUSAL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type AgeState = {
  ageConfirmedAt: Date | null;
  ageConfirmedMinimum: number | null;
  ageRefusedAt: Date | null;
};

/**
 * Whole years between two dates, by calendar rather than by arithmetic on
 * milliseconds.
 *
 * Dividing by 365.25 days is wrong for exactly the people it matters for:
 * somebody whose birthday is today or tomorrow. Comparing month and day
 * gets leap years and month lengths right for free, because the calendar
 * has already dealt with them.
 */
export function ageOn(born: { year: number; month: number; day: number }, at: Date): number {
  let age = at.getUTCFullYear() - born.year;
  const month = at.getUTCMonth() + 1;
  const day = at.getUTCDate();
  if (month < born.month || (month === born.month && day < born.day)) {
    age -= 1;
  }
  return age;
}

export type ParsedBirthDate = { year: number; month: number; day: number };

export type BirthDateResult =
  | { ok: true; born: ParsedBirthDate }
  | { ok: false; error: string };

/**
 * The oldest anybody is. A year before this is a typo, not a
 * supercentenarian, and letting it through means an age check that passes
 * on a mis-keyed 1089.
 */
const OLDEST_PLAUSIBLE_YEARS = 120;

/**
 * Reads three fields into a date, refusing anything that is not one.
 *
 * Strict about the day existing in that month, because 31 February is how
 * somebody discovers that a form which accepts it is not really reading
 * what they typed. Date's own rollover would silently turn it into 3 March
 * and pass.
 */
export function parseBirthDate(
  input: { day: string; month: string; year: string },
  now: Date,
): BirthDateResult {
  const day = Number(input.day.trim());
  const month = Number(input.month.trim());
  const year = Number(input.year.trim());

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return { ok: false, error: "Fill in the day, month and year." };
  }
  if (month < 1 || month > 12) {
    return { ok: false, error: "That month doesn't look right." };
  }
  if (day < 1 || day > 31) {
    return { ok: false, error: "That day doesn't look right." };
  }

  // Built in UTC and read back. A day that rolled over is a day that never
  // existed in that month.
  const built = new Date(Date.UTC(year, month - 1, day));
  if (
    built.getUTCFullYear() !== year ||
    built.getUTCMonth() + 1 !== month ||
    built.getUTCDate() !== day
  ) {
    return { ok: false, error: "That date doesn't exist. Check the day and month." };
  }

  if (built.getTime() > now.getTime()) {
    return { ok: false, error: "That date is in the future." };
  }
  if (now.getUTCFullYear() - year > OLDEST_PLAUSIBLE_YEARS) {
    return { ok: false, error: "Check the year." };
  }

  return { ok: true, born: { year, month, day } };
}

/** Whether this person still satisfies a brand asking for `minimum`. */
export function meetsMinimum(state: AgeState, minimum: number): boolean {
  if (!state.ageConfirmedAt || state.ageConfirmedMinimum === null) {
    return false;
  }
  // A stricter brand is a question this person has not answered. An answer
  // to "are you 18" is not an answer to "are you 21".
  return state.ageConfirmedMinimum >= minimum;
}

/** Whether a refusal is still in force, and so the form should not be offered. */
export function inCooldown(state: AgeState, now: Date): boolean {
  if (!state.ageRefusedAt) return false;
  return now.getTime() - state.ageRefusedAt.getTime() < AGE_REFUSAL_COOLDOWN_MS;
}
