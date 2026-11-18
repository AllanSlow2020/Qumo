import { describe, expect, it } from "vitest";

// Built from its code point so this file is not itself an offender; see no-em-dashes.test.ts.
const EM_DASH = String.fromCharCode(0x2014);
import { percentOfSpend } from "@/lib/ledger/percent";
import { calculateCost } from "@/lib/guide/cost";
import { buildExamples, slipMoney, sum, TEA_DAILY_CENTS, TEA_FLAT_CENTS } from "@/lib/guide/examples";

/**
 * The worked examples on the How it works page.
 *
 * What is held here is that every figure an example states is one the engine
 * would produce, and that the made-up till slips add up.
 */

const examples = buildExamples(false);
const byId = (id: string) => examples.find((e) => e.id === id)!;

describe("the till slips", () => {
  it("add up to the total printed on them", () => {
    for (const e of examples.filter((x) => x.receipt)) {
      expect(sum(e.receipt!.lines)).toBe(e.receipt!.totalCents);
    }
  });

  it("are the totals the examples talk about", () => {
    expect(slipMoney(byId("coffee").receipt!.totalCents)).toBe("R46.00");
    expect(slipMoney(byId("bottle").receipt!.totalCents)).toBe("R184.50");
  });

  it("print money as a receipt does, always to the cent", () => {
    expect(slipMoney(500)).toBe("R5.00");
    expect(slipMoney(18_450)).toBe("R184.50");
    expect(slipMoney(5)).toBe("R0.05");
  });
});

describe("the bottle store", () => {
  const e = byId("bottle");

  it("pays what the ledger pays, and says what was dropped", () => {
    expect(percentOfSpend(e.receipt!.totalCents, 500)).toBe(922);
    const customer = e.facts.find((f) => f.k === "The customer")!.v;
    expect(customer).toContain("5% of R184.50");
    expect(customer).toContain("R9.225");
    expect(customer).toContain("R9.22,");
  });

  it("states the ceilings it sets", () => {
    const bounds = e.facts.find((f) => f.k === "What bounds it")!.v;
    expect(bounds).toContain("R50,000");
    expect(bounds).toContain("R100");
  });

  it("names a basis-point value that is the percentage it claims", () => {
    expect(e.facts.find((f) => f.k === "You set")!.v).toContain("500 basis points, which is 5%");
  });
});

describe("the tea", () => {
  const e = byId("tea");

  it("buys as many scans as the engine's own sum says", () => {
    const r = calculateCost({
      shape: "FLAT",
      flatCents: TEA_FLAT_CENTS,
      basisPoints: 0,
      basketCents: 0,
      totalCents: 2_000_000,
      perPersonPerDayCents: TEA_DAILY_CENTS,
      scansPerDay: null,
    });
    expect(r.scansToBudget).toBe(4_000);
    expect(e.facts.find((f) => f.k === "You set")!.v).toContain("4,000 scans");
  });

  it("is a pack code, which has a label and no receipt", () => {
    expect(e.code).toBe("A pack code");
    expect(e.receipt).toBeUndefined();
    expect(e.label_).toBeDefined();
  });
});

describe("the coffee shop", () => {
  it("gives the durations the page's own prose gives", () => {
    const choose = byId("coffee").facts.find((f) => f.k === "Choose carefully")!.v;
    expect(choose).toContain("about 2 weeks");
    expect(choose).toContain("about 10 months");
  });
});

describe("what is true today about spending", () => {
  it("says a balance only accumulates while spending is not open", () => {
    expect(buildExamples(false).find((e) => e.id === "bottle")!.stands).toContain("not built yet");
  });

  it("stops saying it once spending is open", () => {
    expect(buildExamples(true).find((e) => e.id === "bottle")!.stands).not.toContain("not built yet");
  });
});

describe("the voice", () => {
  it("has no em dashes or exclamation marks anywhere", () => {
    const text = JSON.stringify(buildExamples(false));
    expect(text).not.toContain(EM_DASH);
    expect(text).not.toContain("!");
  });

  it("uses only invented brands", () => {
    expect(examples.map((e) => e.brand)).toEqual(["Copper Kettle", "Amber Oak", "Wild Sage Tea"]);
  });
});
