import { describe, expect, it } from "vitest";
import { observations, type ObservationFacts } from "@/lib/console/observations";

const NOW = new Date("2026-10-27T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

const facts = (over: Partial<ObservationFacts> = {}): ObservationFacts => ({
  cards: [],
  budgets: [],
  batches: [],
  live: [],
  now: NOW,
  ...over,
});

const ids = (f: ObservationFacts) => observations(f).map((o) => o.id);

describe("what is worth looking at", () => {
  it("says nothing when there is nothing to say", () => {
    // The whole value of the panel. One that always has something in it
    // teaches people to stop reading it.
    expect(observations(facts())).toEqual([]);
  });

  describe("a budget running out", () => {
    const budget = (issued: number) =>
      facts({ budgets: [{ campaignId: "c1", name: "5% back", unit: "CENTS", issued, cap: 10_000 }] });

    it("stays quiet well inside the ceiling", () => {
      expect(ids(budget(7_000))).toEqual([]);
    });

    it("speaks up near it, with both numbers", () => {
      const [o] = observations(budget(8_600));
      expect(o?.id).toBe("budget-c1");
      expect(o?.tone).toBe("warn");
      expect(o?.title).toBe("5% back has issued 86% of its budget");
      expect(o?.detail).toContain("R86.00 of R100.00");
    });

    it("says what actually happens at the ceiling", () => {
      // The part a brand cannot guess: it does not announce itself, and the
      // shopper is told the promotion is not running rather than that it
      // ran out.
      expect(observations(budget(10_000))[0]?.detail).toContain("stops awarding");
    });
  });

  describe("a batch running out", () => {
    const batch = (scanned: number, total = 500) =>
      facts({ batches: [{ batchId: "b1", label: "First run", total, scanned }] });

    it("stays quiet while there are plenty left", () => {
      expect(ids(batch(200))).toEqual([]);
    });

    it("speaks up near the end", () => {
      const [o] = observations(batch(430));
      expect(o?.title).toBe("First run is 86% scanned");
      expect(o?.detail).toContain("each one works once");
    });

    it("does not divide by a batch of nothing", () => {
      expect(ids(batch(0, 0))).toEqual([]);
    });
  });

  describe("a promotion gone quiet", () => {
    it("is judged against the others, not against the calendar", () => {
      /*
       * The comparison is the entire point. A fortnight of silence across
       * the whole programme is a quiet fortnight and the brand knows; one
       * promotion silent while the others earn is a code that never made it
       * out of its box.
       */
      const allQuiet = facts({
        live: [
          { campaignId: "a", name: "A", lastAwardAt: ago(30) },
          { campaignId: "b", name: "B", lastAwardAt: ago(40) },
        ],
      });
      expect(ids(allQuiet)).toEqual([]);

      const oneQuiet = facts({
        live: [
          { campaignId: "a", name: "A", lastAwardAt: ago(2) },
          { campaignId: "b", name: "Meal deal sleeve", lastAwardAt: ago(40) },
        ],
      });
      expect(ids(oneQuiet)).toEqual(["quiet-b"]);
      expect(observations(oneQuiet)[0]?.title).toBe("Meal deal sleeve has awarded nothing in 14 days");
    });

    it("tells a promotion that never awarded from one that stopped", () => {
      const never = facts({
        live: [
          { campaignId: "a", name: "A", lastAwardAt: ago(1) },
          { campaignId: "b", name: "B", lastAwardAt: null },
        ],
      });
      expect(observations(never)[0]?.detail).toContain("never awarded anything");

      const stopped = facts({
        live: [
          { campaignId: "a", name: "A", lastAwardAt: ago(1) },
          { campaignId: "b", name: "B", lastAwardAt: ago(40) },
        ],
      });
      expect(observations(stopped)[0]?.detail).toContain("never made it out");
    });

    it("leaves a promotion that earned yesterday alone", () => {
      expect(ids(facts({ live: [{ campaignId: "a", name: "A", lastAwardAt: ago(1) }] }))).toEqual([]);
    });
  });

  describe("a card nobody finishes", () => {
    const card = (issued: number, coupons = 0) =>
      facts({ cards: [{ campaignId: "c1", name: "Rounds card", completesAt: 10, unit: "STAMPS", issued, coupons }] });

    it("waits until enough stamps are out to mean anything", () => {
      // Nine stamps against a threshold of ten has not failed, it has
      // barely started - and saying so on day one is noise.
      expect(ids(card(9))).toEqual([]);
      expect(ids(card(29))).toEqual([]);
      expect(ids(card(30))).toEqual(["card-c1"]);
    });

    it("stays quiet the moment one card has completed", () => {
      expect(ids(card(400, 1))).toEqual([]);
    });

    it("reads the number the right way round", () => {
      // Stamps spread thin across many people, not people who gave up.
      const [o] = observations(card(286));
      expect(o?.detail).toContain("286 stamps");
      expect(o?.detail).toContain("spread thinner");
    });
  });

  it("puts what stops working soonest first", () => {
    const all = facts({
      cards: [{ campaignId: "c", name: "Card", completesAt: 10, unit: "STAMPS", issued: 300, coupons: 0 }],
      budgets: [{ campaignId: "b", name: "Budget", unit: "CENTS", issued: 9_500, cap: 10_000 }],
      batches: [{ batchId: "k", label: "Run", total: 100, scanned: 95 }],
      live: [
        { campaignId: "x", name: "X", lastAwardAt: ago(1) },
        { campaignId: "q", name: "Q", lastAwardAt: ago(40) },
      ],
    });
    // A budget and a batch both end with the programme silently ceasing to
    // award. A card doing badly is still awarding.
    expect(ids(all)).toEqual(["budget-b", "batch-k", "quiet-q", "card-c"]);
    expect(observations(all).filter((o) => o.tone === "warn").map((o) => o.id)).toEqual(["budget-b", "batch-k"]);
  });

  it("gives every observation somewhere to go", () => {
    const all = facts({
      budgets: [{ campaignId: "b", name: "B", unit: "CENTS", issued: 9_500, cap: 10_000 }],
      batches: [{ batchId: "k", label: "Run", total: 100, scanned: 95 }],
    });
    for (const o of observations(all)) {
      expect(o.href.startsWith("/")).toBe(true);
      expect(o.cta.length).toBeGreaterThan(0);
      expect(o.detail.length).toBeGreaterThan(20);
    }
  });
});
