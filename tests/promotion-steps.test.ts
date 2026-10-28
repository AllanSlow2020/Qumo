import { describe, expect, it } from "vitest";
import type { ConsoleCampaign } from "@/lib/campaigns/manage";
import {
  firstUnfinishedStep,
  promotionSteps,
  stepReachable,
  STEP_ORDER,
  type StepId,
  type StepState,
} from "@/lib/console/promotion-steps";

type Rule = NonNullable<ConsoleCampaign["rule"]>;

const RULE: Rule = {
  type: "FLAT_PER_SCAN",
  unit: "STAMPS",
  amount: 1,
  basisPoints: null,
  minSpendCents: null,
  completesAt: null,
  minProofTier: "UNSIGNED",
  maxPerPersonPerDay: null,
  maxScansPerPersonPerDay: null,
  maxTotalAmount: null,
};

/**
 * The same row with a different unit, which is a different promotion.
 *
 * RULE is a stamp card: flat, in stamps. FIXED is a flat award in rands.
 * One row type, and the card step treats them differently on purpose,
 * because a stamp card with no threshold is unfinished and a cash-back
 * promotion with no threshold is simply a promotion that adds up.
 */
const FIXED: Rule = { ...RULE, unit: "CENTS", amount: 500 };

/** The combination the console no longer offers: a share of spend, in stamps. */
const BROKEN: Rule = { ...RULE, type: "PERCENT_OF_SPEND", unit: "STAMPS", basisPoints: 500, amount: 0 };

const campaign = (over: Partial<ConsoleCampaign> = {}): ConsoleCampaign => ({
  id: "c1",
  name: "Rounds card",
  description: null,
  status: "DRAFT",
  rule: null,
  reward: null,
  issued: 0,
  ...over,
});

const stateOf = (c: ConsoleCampaign | null, id: StepId): StepState =>
  promotionSteps(c).find((s) => s.id === id)!.state;

const blurbOf = (c: ConsoleCampaign | null, id: StepId): string =>
  promotionSteps(c).find((s) => s.id === id)!.blurb;

describe("the five steps of setting one promotion up", () => {
  it("always returns every step, in the order the decision is made", () => {
    for (const c of [null, campaign(), campaign({ rule: RULE })]) {
      expect(promotionSteps(c).map((s) => s.id)).toEqual(STEP_ORDER);
    }
  });

  it("offers only the first step before a promotion exists", () => {
    const steps = promotionSteps(null);
    expect(stateOf(null, "name")).toBe("todo");
    expect(steps.slice(1).every((s) => s.state === "locked")).toBe(true);
    expect(firstUnfinishedStep(steps)).toBe("name");
  });

  it("marks naming done the moment the promotion exists, and opens on what it awards", () => {
    const steps = promotionSteps(campaign());
    expect(stateOf(campaign(), "name")).toBe("done");
    expect(stateOf(campaign(), "award")).toBe("todo");
    expect(firstUnfinishedStep(steps)).toBe("award");
  });

  it("locks everything downstream of the rule until there is a rule", () => {
    const bare = campaign();
    for (const id of ["card", "cost", "live"] as StepId[]) {
      expect(stateOf(bare, id)).toBe("locked");
      expect(stepReachable(promotionSteps(bare), id)).toBe(false);
    }
  });
});

describe("the card step, which has four different answers", () => {
  it("counts no threshold as a finished decision rather than an omission", () => {
    const c = campaign({ rule: FIXED });
    expect(stateOf(c, "card")).toBe("skipped");
    // The distinction that matters: skipped does not hold the sequence up.
    expect(firstUnfinishedStep(promotionSteps(c))).not.toBe("card");
  });

  it("holds a stamp card up until it says how many stamps fill it", () => {
    // Same row shape as the test above and the opposite answer, because a
    // stamp card that never completes is not a promotion that adds up: it
    // is a card nobody can finish. Calling this skipped is what let the
    // sequence walk a coffee shop straight past the number of coffees.
    const c = campaign({ rule: RULE });
    expect(stateOf(c, "card")).toBe("todo");
    expect(firstUnfinishedStep(promotionSteps(c))).toBe("card");
  });

  it("flags a threshold with no reward, because the card would hand over nothing", () => {
    const c = campaign({ rule: { ...RULE, completesAt: 10 } });
    expect(stateOf(c, "card")).toBe("attention");
    expect(blurbOf(c, "card")).toContain("10");
    expect(blurbOf(c, "card")).toMatch(/given nothing/);
  });

  it("is done once the reward is named", () => {
    const c = campaign({
      rule: { ...RULE, completesAt: 10 },
      reward: { rewardName: "a free coffee", maxCoupons: null },
    });
    expect(stateOf(c, "card")).toBe("done");
    expect(blurbOf(c, "card")).toContain("a free coffee");
  });

  it("is marked optional for every kind but a stamp card", () => {
    for (const c of [campaign(), campaign({ rule: FIXED }), campaign({ rule: { ...FIXED, completesAt: 3 } })]) {
      expect(promotionSteps(c).find((s) => s.id === "card")!.optional).toBe(true);
    }
    // And nothing else is.
    expect(promotionSteps(campaign({ rule: FIXED })).filter((s) => s.optional).map((s) => s.id)).toEqual(["card"]);
  });

  it("is not optional on a stamp card, where the card is the promotion", () => {
    for (const c of [
      campaign({ rule: RULE }),
      campaign({ rule: { ...RULE, completesAt: 10 } }),
      campaign({ rule: { ...RULE, completesAt: 10 }, reward: { rewardName: "a free coffee", maxCoupons: null } }),
    ]) {
      expect(promotionSteps(c).find((s) => s.id === "card")!.optional).toBe(false);
    }
  });
});

describe("a rule that is none of the three kinds", () => {
  it("flags the award step rather than calling it done", () => {
    // A share of the basket paid in stamps multiplies the award by what
    // was spent. The rail saying "done" would be arguing with the error
    // the panel prints three inches below it.
    const c = campaign({ rule: BROKEN });
    expect(stateOf(c, "award")).toBe("attention");
    expect(blurbOf(c, "award")).toMatch(/no longer offers/);
    expect(firstUnfinishedStep(promotionSteps(c))).toBe("award");
  });

  it("does not treat it as a stamp card, whatever the unit says", () => {
    expect(promotionSteps(campaign({ rule: BROKEN })).find((s) => s.id === "card")!.optional).toBe(true);
  });
});

describe("the budget step, which is only alarming once the promotion is live", () => {
  it("is merely to do while the promotion is off", () => {
    expect(stateOf(campaign({ rule: RULE }), "cost")).toBe("todo");
  });

  it("is flagged once a promotion is live with nothing bounding it", () => {
    const c = campaign({ rule: RULE, status: "ACTIVE" });
    expect(stateOf(c, "cost")).toBe("attention");
    expect(blurbOf(c, "cost")).toMatch(/nothing bounds/);
  });

  it("is done once a total is set", () => {
    const c = campaign({ rule: { ...RULE, maxTotalAmount: 500000 }, status: "ACTIVE" });
    expect(stateOf(c, "cost")).toBe("done");
  });
});

describe("switching on", () => {
  it("cannot be reached while the promotion awards nothing", () => {
    expect(stateOf(campaign(), "live")).toBe("locked");
  });

  it("is the last thing to do once there is a rule", () => {
    const c = campaign({ rule: { ...FIXED, maxTotalAmount: 1000 } });
    expect(stateOf(c, "live")).toBe("todo");
    expect(firstUnfinishedStep(promotionSteps(c))).toBe("live");
  });

  it("is done when live", () => {
    expect(stateOf(campaign({ rule: RULE, status: "ACTIVE" }), "live")).toBe("done");
  });
});

describe("which step the page opens on", () => {
  it("opens on a flagged step rather than skipping past it to the next job", () => {
    // Live, bounded, but the card promises a reward nobody named. The
    // sequence must not report this promotion as finished.
    const c = campaign({
      rule: { ...RULE, completesAt: 8, maxTotalAmount: 999 },
      status: "ACTIVE",
    });
    expect(firstUnfinishedStep(promotionSteps(c))).toBe("card");
  });

  it("is null only when every step is genuinely settled", () => {
    const done = campaign({
      rule: { ...RULE, completesAt: 8, maxTotalAmount: 999 },
      reward: { rewardName: "a free coffee", maxCoupons: null },
      status: "ACTIVE",
    });
    expect(firstUnfinishedStep(promotionSteps(done))).toBeNull();

    // And a promotion that skipped the card still counts as settled.
    const noCard = campaign({ rule: { ...FIXED, maxTotalAmount: 999 }, status: "ACTIVE" });
    expect(firstUnfinishedStep(promotionSteps(noCard))).toBeNull();
  });
});
