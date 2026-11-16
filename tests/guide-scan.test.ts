import { describe, expect, it } from "vitest";
import { percentOfSpend } from "@/lib/ledger/accrue";
import {
  ACTIONS,
  PACK_CENTS,
  SLIP_BASIS_POINTS,
  SLIP_BASKET_CENTS,
  SLIP_EDITED_CENTS,
  scanOutcome,
  type ScanCode,
} from "@/lib/guide/scan";

/**
 * The scan demonstration on the How it works page.
 *
 * Each outcome restates a rule the engine enforces, and these tests are what
 * stops the page saying something the engine does not do.
 */

describe("a poster code", () => {
  it("never earns, scanned or photographed, and never gets used up", () => {
    for (const action of ["scan", "photo"] as const) {
      for (const earned of [false, true]) {
        expect(scanOutcome("poster", action, earned).tone).toBe("none");
      }
    }
  });
});

describe("a pack code", () => {
  it("earns its fixed amount the first time", () => {
    const first = scanOutcome("pack", "scan", false);
    expect(first.tone).toBe("earned");
    expect(first.line).toBe("Earned R5.");
    expect(PACK_CENTS).toBe(500);
  });

  it("adds nothing the second time, because each one works once, ever", () => {
    expect(scanOutcome("pack", "scan", true).tone).toBe("used");
  });
});

describe("a till slip code", () => {
  it("earns a share of the basket rounded down exactly as the ledger rounds it", () => {
    const first = scanOutcome("slip", "scan", false);
    const paid = percentOfSpend(SLIP_BASKET_CENTS, SLIP_BASIS_POINTS);
    expect(paid).toBe(922); // 5% of 18,450 cents is 922.5
    expect(first.tone).toBe("earned");
    expect(first.line).toBe("Earned R9.22.");
    // The explanation says what was dropped, not just what was paid.
    expect(first.detail).toContain("R9.225");
    expect(first.detail).toContain("rounds down");
  });

  it("is used after it has paid, like every other code", () => {
    expect(scanOutcome("slip", "scan", true).tone).toBe("used");
  });

  it("refuses an edited total, whether or not the slip has paid", () => {
    for (const earned of [false, true]) {
      const r = scanOutcome("slip", "edit", earned);
      expect(r.tone).toBe("refused");
      expect(r.line).toContain("R1,845");
    }
    expect(SLIP_EDITED_CENTS).toBeGreaterThan(SLIP_BASKET_CENTS);
  });
});

describe("what each code lets the reader try", () => {
  it("offers only actions that code has an answer for", () => {
    const codes: ScanCode[] = ["poster", "pack", "slip"];
    for (const code of codes) {
      expect(ACTIONS[code].length).toBeGreaterThan(0);
      for (const { action } of ACTIONS[code]) {
        // Every offered action must produce a defined outcome.
        expect(scanOutcome(code, action, false).line.length).toBeGreaterThan(0);
      }
    }
    // Editing a total only means something on a slip.
    expect(ACTIONS.poster.some((a) => a.action === "edit")).toBe(false);
    expect(ACTIONS.pack.some((a) => a.action === "edit")).toBe(false);
    expect(ACTIONS.slip.some((a) => a.action === "edit")).toBe(true);
  });
});
