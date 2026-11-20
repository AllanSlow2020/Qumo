import { describe, expect, it } from "vitest";
import { percentOfSpend } from "@/lib/ledger/accrue";
import { percentOfSpend as pure } from "@/lib/ledger/percent";
import {
  COST_DEFAULTS,
  MONTH_DAYS,
  calculateCost,
  formatCount,
  formatPercent,
  formatRand,
  type CostInput,
} from "@/lib/guide/cost";

/**
 * The cost calculator on the How it works page.
 *
 * It teaches, and nothing it shows is a prediction, so the tests are about
 * the one thing it can get wrong that matters: disagreeing with the engine.
 * The rounding has to be the ledger's own, and the three ceilings have to
 * combine the way the ledger applies them.
 */

const base: CostInput = { ...COST_DEFAULTS };
const flat = (over: Partial<CostInput> = {}): CostInput => ({ ...base, shape: "FLAT", ...over });
const share = (over: Partial<CostInput> = {}): CostInput => ({ ...base, shape: "PERCENT", ...over });

describe("the maths is the ledger's", () => {
  it("is the same function the ledger exports, not a copy of it", () => {
    // accrue.ts re-exports lib/ledger/percent.ts. If somebody gives it its
    // own implementation again, the guide and the ledger can drift apart
    // and this is the test that says so.
    expect(percentOfSpend).toBe(pure);
  });

  it("pays a share of spend rounded down, exactly as percentOfSpend does", () => {
    // R119.99 at 5% is 5.9995 rand. The ledger pays 599 cents, not 600.
    const r = calculateCost(share({ basketCents: 11_999, basisPoints: 500 }));
    expect(r.awardCents).toBe(599);
    expect(r.awardCents).toBe(percentOfSpend(11_999, 500));
    expect(r.exactAwardCents).toBeCloseTo(599.95, 5);
  });

  it("shows no exact figure for a flat amount, because there is nothing to round", () => {
    expect(calculateCost(flat()).exactAwardCents).toBeNull();
  });

  it("pays nothing on a basket too small to round up to a cent", () => {
    const r = calculateCost(share({ basketCents: 19, basisPoints: 500 }));
    expect(r.awardCents).toBe(0);
    expect(r.scansToBudget).toBeNull();
    expect(r.personDailyMaxCents).toBe(0);
    expect(r.personDaysToBudget).toBeNull();
    expect(r.bindingLimit).toBe("none");
  });
});

describe("the three ceilings", () => {
  it("counts the scans a total budget pays for", () => {
    // R20,000 at R5 a scan is 4,000 scans.
    expect(calculateCost(flat({ totalCents: 2_000_000, flatCents: 500 })).scansToBudget).toBe(4_000);
  });

  it("stops at the scan limit when that is the lower of the two per-person limits", () => {
    // Two scans at R5 is R10 a day, under a R20 value limit.
    const r = calculateCost(flat({ flatCents: 500, perPersonPerDayCents: 2_000, scansPerDay: 2 }));
    expect(r.personDailyMaxCents).toBe(1_000);
    expect(r.bindingLimit).toBe("scans");
  });

  it("stops at the value limit when that is the lower", () => {
    // Five scans at R5 would be R25, but the value limit is R20.
    const r = calculateCost(flat({ flatCents: 500, perPersonPerDayCents: 2_000, scansPerDay: 5 }));
    expect(r.personDailyMaxCents).toBe(2_000);
    expect(r.bindingLimit).toBe("value");
  });

  it("is bounded by the value limit alone when there is no scan limit", () => {
    const r = calculateCost(flat({ perPersonPerDayCents: 3_000, scansPerDay: null }));
    expect(r.personDailyMaxCents).toBe(3_000);
    expect(r.bindingLimit).toBe("value");
  });

  it("calls a tie the value limit, so the reader is pointed at a number they set", () => {
    // Four scans at R5 is exactly R20, level with the value limit.
    const r = calculateCost(flat({ flatCents: 500, perPersonPerDayCents: 2_000, scansPerDay: 4 }));
    expect(r.personDailyMaxCents).toBe(2_000);
    expect(r.bindingLimit).toBe("value");
  });
});

describe("one determined person", () => {
  it("takes a month of their daily maximum, and no more than the total", () => {
    const small = calculateCost(flat({ totalCents: 500_000, perPersonPerDayCents: 10_000, scansPerDay: null, flatCents: 1_000 }));
    // R100 a day for 30 days is R3,000, inside a R5,000 budget.
    expect(small.personMonthCents).toBe(100 * 100 * MONTH_DAYS);
    const capped = calculateCost(flat({ totalCents: 200_000, perPersonPerDayCents: 10_000, scansPerDay: null, flatCents: 1_000 }));
    // The same person would take R3,000 but the budget is R2,000.
    expect(capped.personMonthCents).toBe(200_000);
    expect(capped.personMonthReach).toBe(1);
  });

  it("reads the same figure as days for one person and people in one day", () => {
    // R20,000 at R10 a day is 2,000 person-days.
    const r = calculateCost(flat({ totalCents: 2_000_000, perPersonPerDayCents: 1_000, scansPerDay: null }));
    expect(r.personDaysToBudget).toBe(2_000);
  });

  it("rounds a part day up, because a budget is not spent until it is spent", () => {
    // R100 budget at R30 a day is 3.33 days, which is 4.
    const r = calculateCost(flat({ totalCents: 10_000, perPersonPerDayCents: 3_000, scansPerDay: null, flatCents: 1_000 }));
    expect(r.personDaysToBudget).toBe(4);
  });

  it("is low, high or all by how much of the budget one person's month reaches", () => {
    const at = (monthCents: number) =>
      calculateCost(flat({ totalCents: 1_000_000, perPersonPerDayCents: monthCents / MONTH_DAYS, scansPerDay: null, flatCents: 100 })).exposure;
    expect(at(100_000)).toBe("low"); // 10%
    expect(at(400_000)).toBe("high"); // 40% is where it starts
    expect(at(1_000_000)).toBe("all"); // the whole budget
  });

  it("starts the reader on a promotion that is fine", () => {
    expect(calculateCost(COST_DEFAULTS).exposure).toBe("low");
  });
});

describe("how amounts are written", () => {
  it("writes whole rand without cents and fractional rand with both digits", () => {
    expect(formatRand(500)).toBe("R5");
    expect(formatRand(599)).toBe("R5.99");
    expect(formatRand(590)).toBe("R5.90");
    expect(formatRand(5)).toBe("R0.05");
    expect(formatRand(0)).toBe("R0");
  });

  it("groups thousands with a comma, the same on the server and in the browser", () => {
    expect(formatRand(2_000_000)).toBe("R20,000");
    expect(formatRand(10_000_000)).toBe("R100,000");
    expect(formatRand(123_456_789)).toBe("R1,234,567.89");
    expect(formatCount(4_000)).toBe("4,000");
    expect(formatCount(999)).toBe("999");
  });

  it("writes basis points as the percentage they are", () => {
    expect(formatPercent(500)).toBe("5%");
    expect(formatPercent(250)).toBe("2.5%");
    expect(formatPercent(1_000)).toBe("10%");
  });
});
