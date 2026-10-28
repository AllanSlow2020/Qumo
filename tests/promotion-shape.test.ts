import { describe, expect, it } from "vitest";
import {
  PROMOTION_SHAPES,
  SHAPE_COPY,
  SHAPE_DEFAULTS,
  shapeFixesAmount,
  shapeNeedsCard,
  shapeOfRule,
  shapeUsesMinimumBasket,
  shapeUsesProof,
  type PromotionShape,
} from "@/lib/console/promotion-shape";

/**
 * The console asks one question with three answers and stores two columns.
 * Everything here is about those two translations staying inverses of each
 * other, because the failure mode is silent: a shape that does not round
 * trip means a brand picks one promotion, saves, and the page redraws a
 * different one.
 */
describe("promotion shapes", () => {
  it("round trips every shape through the row it stores", () => {
    for (const shape of PROMOTION_SHAPES) {
      expect(shapeOfRule(SHAPE_DEFAULTS[shape])).toBe(shape);
    }
  });

  it("names a flat rule by its unit, not its type", () => {
    // The conflation the old form made a brand untangle: one row type, two
    // promotions that have nothing to do with each other.
    expect(shapeOfRule({ type: "FLAT_PER_SCAN", unit: "STAMPS" })).toBe("STAMP_CARD");
    expect(shapeOfRule({ type: "FLAT_PER_SCAN", unit: "CENTS" })).toBe("FIXED_PER_SCAN");
    expect(shapeOfRule({ type: "FLAT_PER_SCAN", unit: "POINTS" })).toBe("FIXED_PER_SCAN");
  });

  it("refuses to name a share of spend that is not money", () => {
    // Share-in-stamps is the combination that multiplies stamps by rands.
    // Returning null is what lets the console say so rather than redraw it
    // as a stamp card and rewrite it on the next save.
    expect(shapeOfRule({ type: "PERCENT_OF_SPEND", unit: "STAMPS" })).toBeNull();
    expect(shapeOfRule({ type: "PERCENT_OF_SPEND", unit: "POINTS" })).toBeNull();
    expect(shapeOfRule({ type: "PERCENT_OF_SPEND", unit: "CENTS" })).toBe("SHARE_OF_SPEND");
  });

  it("has no shape for a promotion that does not exist yet", () => {
    expect(shapeOfRule(null)).toBeNull();
    expect(shapeOfRule(undefined)).toBeNull();
  });

  it("settles a stamp card's award from the shape alone", () => {
    expect(shapeFixesAmount("STAMP_CARD")).toBe(true);
    expect(SHAPE_DEFAULTS.STAMP_CARD.amount).toBe(1);
    for (const shape of PROMOTION_SHAPES.filter((s) => s !== "STAMP_CARD")) {
      expect(shapeFixesAmount(shape)).toBe(false);
    }
  });

  it("makes the card step required for a stamp card and optional otherwise", () => {
    expect(shapeNeedsCard("STAMP_CARD")).toBe(true);
    expect(shapeNeedsCard("SHARE_OF_SPEND")).toBe(false);
    expect(shapeNeedsCard("FIXED_PER_SCAN")).toBe(false);
    expect(shapeNeedsCard(null)).toBe(false);
  });

  it("offers proof and a minimum basket only where the engine reads them", () => {
    // setEarnRuleForSession parses {campaignId, unit, amount} and writes
    // minSpendCents: null. Offering either on a flat rule is offering a
    // control that is discarded on save.
    for (const shape of PROMOTION_SHAPES) {
      const slipOnly = shape === "SHARE_OF_SPEND";
      expect(shapeUsesProof(shape)).toBe(slipOnly);
      expect(shapeUsesMinimumBasket(shape)).toBe(slipOnly);
    }
  });

  it("says which door every shape earns through", () => {
    // The thing the old form never said anywhere, and the reason somebody
    // reached for share-in-stamps to get stamps out of a till slip.
    for (const shape of PROMOTION_SHAPES) {
      expect(SHAPE_COPY[shape].door.trim().length).toBeGreaterThan(0);
    }
    expect(SHAPE_COPY.STAMP_CARD.door).toMatch(/till slip cannot award a stamp/i);
  });

  it("covers every shape in the copy and the defaults", () => {
    const shapes: PromotionShape[] = ["STAMP_CARD", "SHARE_OF_SPEND", "FIXED_PER_SCAN"];
    expect(new Set(PROMOTION_SHAPES)).toEqual(new Set(shapes));
    for (const shape of shapes) {
      expect(SHAPE_COPY[shape]).toBeTruthy();
      expect(SHAPE_DEFAULTS[shape]).toBeTruthy();
    }
  });
});
