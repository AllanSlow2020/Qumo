import { afterEach, describe, expect, it } from "vitest";
import {
  factsFromRead,
  MIN_READ_CONFIDENCE,
  photoCaptureConfigured,
  READ_FAILURE_MESSAGES,
  slipReader,
  type ReadFailure,
  type SlipRead,
} from "@/lib/slips/read";

const GOOD: SlipRead = {
  storeCode: "CK-SEA-01",
  externalTxnId: "T-99214",
  amountCents: 18500,
  purchasedAt: new Date("2026-10-27T09:14:00Z"),
  confidence: 0.97,
};

const read = (over: Partial<SlipRead> = {}): SlipRead => ({ ...GOOD, ...over });
const refusal = (over: Partial<SlipRead>): ReadFailure | null => {
  const r = factsFromRead(read(over));
  return r.ok ? null : r.reason;
};

describe("turning a read into something worth awarding on", () => {
  it("passes a complete, confident read through", () => {
    const r = factsFromRead(GOOD);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.facts).toEqual({
      storeCode: "CK-SEA-01",
      externalTxnId: "T-99214",
      amountCents: 18500,
      purchasedAt: GOOD.purchasedAt,
    });
  });

  it("refuses a read with no store, because the slip cannot be placed", () => {
    expect(refusal({ storeCode: null })).toBe("NO_STORE");
    expect(refusal({ storeCode: "   " })).toBe("NO_STORE");
  });

  it("refuses a read with no slip number, because that is the whole replay guard", () => {
    // Defence 2 in lib/stores/receipt.ts is the unique constraint on
    // (store, transaction id). Without the number there is nothing to be
    // unique on and the slip could be scanned all afternoon.
    expect(refusal({ externalTxnId: null })).toBe("NO_SLIP_NUMBER");
    expect(refusal({ externalTxnId: "  " })).toBe("NO_SLIP_NUMBER");
  });

  it("refuses a read with no date, because that is the freshness window", () => {
    expect(refusal({ purchasedAt: null })).toBe("NO_DATE");
    expect(refusal({ purchasedAt: new Date("nonsense") })).toBe("NO_DATE");
  });

  it("refuses a total that is missing, zero or negative", () => {
    expect(refusal({ amountCents: null })).toBe("NO_TOTAL");
    expect(refusal({ amountCents: 0 })).toBe("NO_TOTAL");
    expect(refusal({ amountCents: -500 })).toBe("NO_TOTAL");
    expect(refusal({ amountCents: Number.NaN })).toBe("NO_TOTAL");
  });

  it("refuses a read the reader is not sure enough about", () => {
    expect(refusal({ confidence: MIN_READ_CONFIDENCE - 0.01 })).toBe("LOW_CONFIDENCE");
    expect(refusal({ confidence: 0 })).toBe("LOW_CONFIDENCE");
    expect(refusal({ confidence: Number.NaN })).toBe("LOW_CONFIDENCE");
    // The floor itself passes: it is a minimum, not a threshold to clear.
    expect(factsFromRead(read({ confidence: MIN_READ_CONFIDENCE })).ok).toBe(true);
  });

  it("reports the missing field before complaining about the picture", () => {
    // Somebody who photographed the middle of the slip is told what is
    // missing, not that their photo was blurry, which is advice they
    // cannot act on.
    expect(refusal({ storeCode: null, confidence: 0.1 })).toBe("NO_STORE");
    expect(refusal({ externalTxnId: null, confidence: 0.1 })).toBe("NO_SLIP_NUMBER");
  });

  it("rounds a fractional total rather than carrying it into the ledger", () => {
    const r = factsFromRead(read({ amountCents: 18500.4 }));
    expect(r.ok && r.facts.amountCents).toBe(18500);
  });

  it("has a sentence for every way a read can fail", () => {
    const reasons: ReadFailure[] = [
      "NO_READER",
      "NO_STORE",
      "NO_SLIP_NUMBER",
      "NO_DATE",
      "NO_TOTAL",
      "LOW_CONFIDENCE",
    ];
    for (const reason of reasons) {
      expect(READ_FAILURE_MESSAGES[reason]?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("whether photograph capture is switched on", () => {
  afterEach(() => {
    delete process.env.QUMO_SLIP_READER;
  });

  it("is off when nothing is configured, which is how this ships", () => {
    delete process.env.QUMO_SLIP_READER;
    expect(slipReader()).toBeNull();
    expect(photoCaptureConfigured()).toBe(false);
  });

  it("refuses a reader name it does not know rather than falling back to none", () => {
    // A typo in a deploy variable must not quietly turn the feature off
    // while the console carries on offering it to brands.
    process.env.QUMO_SLIP_READER = "tesseroct";
    expect(() => slipReader()).toThrow(/tesseroct/);
    expect(photoCaptureConfigured()).toBe(false);
  });
});
