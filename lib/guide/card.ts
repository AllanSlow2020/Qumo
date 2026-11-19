/**
 * The stamp card playground on the How it works page: how long a card takes,
 * and what a card looks like as purchases arrive.
 *
 * Pure, so the arithmetic and the wording can be tested without a browser.
 * Nothing here reads a promotion. The reader picks a card length and how often
 * a regular customer visits, and the page shows what follows.
 *
 * ── What is the engine's and what is a rule of thumb ─────────────────────
 *
 * Two different kinds of claim live in this file and the page says which is
 * which.
 *
 * `stampsAfter` is the engine's. It restates the completion rule in
 * lib/ledger/accrue.ts: a stamp lands on the balance, and when the balance
 * reaches the card's length the card's worth is deducted and a reward is
 * issued, at most one card per scan. tests/guide-card.test.ts checks it
 * against the arithmetic the ledger does.
 *
 * `cardVerdict` is not. The console does not enforce a limit on how long a
 * card may take, and nothing in the engine knows what "too long" is. The
 * thresholds are advice, drawn from the guide's own example (ten stamps for
 * someone who passes daily is about two weeks; for someone who comes monthly
 * it is most of a year) and the page labels them as a rule of thumb. They sit
 * here as named constants so the advice is one thing in one place.
 */

/** Card lengths offered. The console accepts 1 to 1,000; these are the ones people print. */
export const CARD_LENGTHS = [6, 8, 10, 12] as const;

export type VisitRate = "days" | "weekly" | "fortnight" | "monthly";

/** How often a regular customer buys, as purchases a week. */
export const VISITS: { id: VisitRate; label: string; perWeek: number }[] = [
  { id: "days", label: "Most days", perWeek: 5 },
  { id: "weekly", label: "Weekly", perWeek: 1 },
  { id: "fortnight", label: "Fortnightly", perWeek: 0.5 },
  // Twelve visits in fifty-two weeks, so a twelve-stamp card is a year.
  { id: "monthly", label: "Monthly", perWeek: 12 / 52 },
];

export const DEFAULT_LENGTH = 10;
export const DEFAULT_VISITS: VisitRate = "days";

/** Up to this many weeks, regulars see the finish line. */
export const WEEKS_COMPLETES = 6;
/** Up to this many, a card is slow. Past it, most people will not finish. */
export const WEEKS_SLOW = 20;
/** The width of the bar on the page, in weeks. */
export const BAR_WEEKS = 52;

const WEEKS_PER_MONTH = 4.345;

export function weeksToComplete(length: number, visit: VisitRate): number {
  const rate = VISITS.find((v) => v.id === visit)?.perWeek ?? 1;
  return length / rate;
}

export function formatDuration(weeks: number): string {
  if (weeks <= 1.5) return "about a week";
  if (weeks <= 10) return `about ${Math.round(weeks)} weeks`;
  const months = weeks / WEEKS_PER_MONTH;
  if (months >= 11) return "about a year";
  return `about ${Math.round(months)} months`;
}

export type Verdict = { tone: "ok" | "warn" | "bad"; label: string; line: string };

export function cardVerdict(weeks: number): Verdict {
  if (weeks <= WEEKS_COMPLETES) {
    return {
      tone: "ok",
      label: "Completes",
      line: "Regulars will see the finish line. This is the range where a card earns its keep.",
    };
  }
  if (weeks <= WEEKS_SLOW) {
    return {
      tone: "warn",
      label: "Slow",
      line: "Fewer customers will finish. Try fewer stamps, or expect cards to complete mostly for your most frequent visitors.",
    };
  }
  return {
    tone: "bad",
    label: "Too long",
    // Says the time it actually is. A fixed "most of a year" was wrong for a
    // twelve-stamp card a fortnightly regular finishes in about six months.
    line: `Somebody who visits this often would take ${formatDuration(weeks)} to finish one card, and will probably forget it exists.`,
  };
}

/** Where the marker sits on the bar, as a percentage. */
export function markerPercent(weeks: number): number {
  return Math.min(100, Math.max(0, (weeks / BAR_WEEKS) * 100));
}

/**
 * The state of a card after some purchases, each worth one stamp.
 *
 * Written as the ledger does it rather than as a division, so that what is
 * tested is the rule: a stamp lands, and when the balance reaches the card's
 * length the card's worth is taken off and a reward issued. Taken off, not
 * reset, which is why `onCard` is what is left on the balance and not zero.
 */
export function stampsAfter(purchases: number, length: number): { completed: number; onCard: number } {
  let balance = 0;
  let completed = 0;
  for (let i = 0; i < purchases; i++) {
    balance += 1;
    if (balance >= length) {
      balance -= length;
      completed += 1;
    }
  }
  return { completed, onCard: balance };
}

/** The most purchases the playground takes: two whole cards. */
export function maxPurchases(length: number): number {
  return length * 2;
}

/** What the two cards on screen show: how many stamps each carries. */
export function cardFills(purchases: number, length: number): [number, number] {
  const p = Math.min(Math.max(0, purchases), maxPurchases(length));
  return [Math.min(p, length), Math.max(0, Math.min(p - length, length))];
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The sentence under the cards, for the purchases so far. */
export function cardLine(purchases: number, length: number): string {
  const p = Math.min(Math.max(0, purchases), maxPurchases(length));
  if (p === 0) return "Nothing yet. Add a purchase to put the first stamp on card 1.";
  if (p < length) {
    return `${plural(length - p, "more purchase", "more purchases")} to complete card 1.`;
  }
  if (p === length) {
    return `Card 1 is complete and a reward is issued. The ${length} stamps are taken off, and the next purchase starts card 2.`;
  }
  if (p < maxPurchases(length)) {
    return `Card 1 is complete and its reward issued. ${plural(p - length, "stamp is", "stamps are")} on card 2.`;
  }
  return "Both cards are complete, and each issued its own reward.";
}
