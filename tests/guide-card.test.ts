import { describe, expect, it } from "vitest";
import {
  BAR_WEEKS,
  CARD_LENGTHS,
  DEFAULT_LENGTH,
  DEFAULT_VISITS,
  VISITS,
  WEEKS_COMPLETES,
  WEEKS_SLOW,
  cardFills,
  cardLine,
  cardVerdict,
  formatDuration,
  markerPercent,
  maxPurchases,
  stampsAfter,
  weeksToComplete,
} from "@/lib/guide/card";

/**
 * The stamp card playground on the How it works page.
 *
 * Two things are held here. The completion rule is the engine's and is checked
 * against the arithmetic the ledger does. The verdict is advice, so what is
 * checked is that it agrees with the examples the guide's own prose gives.
 */

describe("the completion rule", () => {
  it("takes a card's worth off when the balance reaches it, and keeps the rest", () => {
    expect(stampsAfter(0, 10)).toEqual({ completed: 0, onCard: 0 });
    expect(stampsAfter(9, 10)).toEqual({ completed: 0, onCard: 9 });
    expect(stampsAfter(10, 10)).toEqual({ completed: 1, onCard: 0 });
    expect(stampsAfter(11, 10)).toEqual({ completed: 1, onCard: 1 });
    expect(stampsAfter(20, 10)).toEqual({ completed: 2, onCard: 0 });
  });

  it("agrees with plain division for every length offered", () => {
    for (const length of CARD_LENGTHS) {
      for (let p = 0; p <= maxPurchases(length); p++) {
        expect(stampsAfter(p, length)).toEqual({ completed: Math.floor(p / length), onCard: p % length });
      }
    }
  });

  it("never loses a stamp: what is on the card plus what was taken off is what was earned", () => {
    for (const length of CARD_LENGTHS) {
      for (let p = 0; p <= maxPurchases(length); p++) {
        const { completed, onCard } = stampsAfter(p, length);
        expect(completed * length + onCard).toBe(p);
      }
    }
  });
});

describe("what the two cards on screen show", () => {
  it("fills card 1 first, then card 2, and agrees with the rule", () => {
    for (const length of CARD_LENGTHS) {
      for (let p = 0; p <= maxPurchases(length); p++) {
        const [one, two] = cardFills(p, length);
        expect(one + two).toBe(p);
        expect(one).toBeLessThanOrEqual(length);
        expect(two).toBeLessThanOrEqual(length);
        // Card 2 only starts once card 1 is full.
        if (two > 0) expect(one).toBe(length);
      }
    }
  });

  it("clamps purchases outside the range rather than drawing a broken card", () => {
    expect(cardFills(-3, 10)).toEqual([0, 0]);
    expect(cardFills(500, 10)).toEqual([10, 10]);
  });

  it("describes each stage, and pluralises", () => {
    expect(cardLine(0, 10)).toContain("Nothing yet");
    expect(cardLine(9, 10)).toBe("1 more purchase to complete card 1.");
    expect(cardLine(8, 10)).toBe("2 more purchases to complete card 1.");
    expect(cardLine(10, 10)).toContain("Card 1 is complete");
    expect(cardLine(10, 10)).toContain("next purchase starts card 2");
    expect(cardLine(11, 10)).toContain("1 stamp is on card 2");
    expect(cardLine(13, 10)).toContain("3 stamps are on card 2");
    expect(cardLine(20, 10)).toContain("Both cards are complete");
  });
});

describe("how long a card takes", () => {
  it("matches the examples the guide's own prose gives", () => {
    // "A ten-stamp card at a coffee shop somebody passes daily is two weeks".
    expect(formatDuration(weeksToComplete(10, "days"))).toBe("about 2 weeks");
    // "the same card somewhere people come monthly is most of a year".
    expect(formatDuration(weeksToComplete(10, "monthly"))).toBe("about 10 months");
    expect(cardVerdict(weeksToComplete(10, "days")).tone).toBe("ok");
    expect(cardVerdict(weeksToComplete(10, "monthly")).tone).toBe("bad");
  });

  it("says a week for the shortest, and a year for twelve monthly visits", () => {
    expect(formatDuration(weeksToComplete(6, "days"))).toBe("about a week");
    expect(formatDuration(weeksToComplete(12, "monthly"))).toBe("about a year");
  });

  it("moves into months once weeks stop being a useful unit", () => {
    expect(formatDuration(10)).toBe("about 10 weeks");
    expect(formatDuration(10.5)).toMatch(/months$/);
    expect(formatDuration(weeksToComplete(12, "weekly"))).toBe("about 3 months");
  });

  it("is longer for a longer card and shorter for a more frequent customer", () => {
    for (const v of VISITS) {
      for (let i = 1; i < CARD_LENGTHS.length; i++) {
        expect(weeksToComplete(CARD_LENGTHS[i]!, v.id)).toBeGreaterThan(weeksToComplete(CARD_LENGTHS[i - 1]!, v.id));
      }
    }
    for (const length of CARD_LENGTHS) {
      for (let i = 1; i < VISITS.length; i++) {
        expect(weeksToComplete(length, VISITS[i]!.id)).toBeGreaterThan(weeksToComplete(length, VISITS[i - 1]!.id));
      }
    }
  });
});

describe("the verdict", () => {
  it("changes tone exactly at the named thresholds", () => {
    expect(cardVerdict(WEEKS_COMPLETES).tone).toBe("ok");
    expect(cardVerdict(WEEKS_COMPLETES + 0.01).tone).toBe("warn");
    expect(cardVerdict(WEEKS_SLOW).tone).toBe("warn");
    expect(cardVerdict(WEEKS_SLOW + 0.01).tone).toBe("bad");
  });

  it("names the real time when a card is too long, not a fixed one", () => {
    expect(cardVerdict(weeksToComplete(10, "monthly")).line).toContain("about 10 months");
    expect(cardVerdict(weeksToComplete(12, "fortnight")).line).toContain("about 6 months");
  });

  it("always says something a reader can act on", () => {
    for (const length of CARD_LENGTHS) {
      for (const v of VISITS) {
        const r = cardVerdict(weeksToComplete(length, v.id));
        expect(r.label.length).toBeGreaterThan(0);
        expect(r.line.length).toBeGreaterThan(20);
      }
    }
  });
});

describe("the marker on the bar", () => {
  it("stays on the bar however long the card is", () => {
    expect(markerPercent(0)).toBe(0);
    expect(markerPercent(BAR_WEEKS)).toBe(100);
    expect(markerPercent(BAR_WEEKS * 5)).toBe(100);
    expect(markerPercent(-4)).toBe(0);
  });

  it("puts the thresholds where the bar's colours change", () => {
    expect(markerPercent(WEEKS_COMPLETES)).toBeCloseTo((WEEKS_COMPLETES / BAR_WEEKS) * 100, 5);
    expect(markerPercent(WEEKS_SLOW)).toBeCloseTo((WEEKS_SLOW / BAR_WEEKS) * 100, 5);
  });
});

describe("the defaults", () => {
  it("open on a card that completes, so the page starts calm", () => {
    expect(CARD_LENGTHS).toContain(DEFAULT_LENGTH);
    expect(cardVerdict(weeksToComplete(DEFAULT_LENGTH, DEFAULT_VISITS)).tone).toBe("ok");
  });
});
