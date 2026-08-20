import { describe, expect, it } from "vitest";
import {
  buildReceiptUrl,
  parseReceiptPayload,
  signReceipt,
  signingMessage,
  verifySignature,
} from "@/lib/stores/payload";
import { percentOfSpend } from "@/lib/ledger/accrue";

const SECRET = "0123456789abcdef0123456789abcdef";

function query(fields: Record<string, string>): URLSearchParams {
  return new URLSearchParams(fields);
}

describe("lib/stores/payload", () => {
  it("parses a well-formed slip", () => {
    const parsed = parseReceiptPayload(query({ s: "CL-04", t: "884231", c: "8500", d: "1755512582" }));
    expect(typeof parsed).not.toBe("string");
    if (typeof parsed === "string") return;

    expect(parsed.storeCode).toBe("CL-04");
    expect(parsed.externalTxnId).toBe("884231");
    expect(parsed.amountCents).toBe(8500);
    expect(parsed.purchasedAt.getTime()).toBe(1755512582 * 1000);
    expect(parsed.signature).toBeNull();
  });

  it("upper-cases the store code so a template's casing doesn't matter", () => {
    const parsed = parseReceiptPayload(query({ s: "cl-04", t: "1", c: "100", d: "1755512582" }));
    if (typeof parsed === "string") throw new Error(parsed);
    expect(parsed.storeCode).toBe("CL-04");
  });

  it("rejects an amount that isn't purely digits", () => {
    // parseInt would read "85abc" as 85 — a basket total that quietly loses
    // its tail is the bug that pays out wrong amounts forever.
    for (const c of ["85abc", "85.00", "-100", "0"]) {
      expect(parseReceiptPayload(query({ s: "A", t: "1", c, d: "1755512582" })), `c=${c}`).toBe("BAD_AMOUNT");
    }
    expect(parseReceiptPayload(query({ s: "A", t: "1", c: "", d: "1755512582" }))).toBe("MISSING_FIELDS");
  });

  it("tolerates whitespace a receipt template might emit", () => {
    // Padding around a substituted field is common in template languages
    // and is not the shopper's problem.
    const parsed = parseReceiptPayload(query({ s: " CL-04 ", t: " 884231 ", c: " 8500 ", d: " 1755512582 " }));
    if (typeof parsed === "string") throw new Error(parsed);
    expect(parsed.storeCode).toBe("CL-04");
    expect(parsed.externalTxnId).toBe("884231");
    expect(parsed.amountCents).toBe(8500);
  });

  it("rejects missing fields", () => {
    expect(parseReceiptPayload(query({ t: "1", c: "100", d: "1" }))).toBe("MISSING_FIELDS");
    expect(parseReceiptPayload(query({ s: "A", c: "100", d: "1" }))).toBe("MISSING_FIELDS");
    expect(parseReceiptPayload(query({ s: "A", t: "1", d: "1" }))).toBe("MISSING_FIELDS");
    expect(parseReceiptPayload(query({ s: "A", t: "1", c: "100" }))).toBe("MISSING_FIELDS");
  });

  it("rejects oversized fields", () => {
    expect(parseReceiptPayload(query({ s: "A".repeat(41), t: "1", c: "100", d: "1" }))).toBe("BAD_FORMAT");
    expect(parseReceiptPayload(query({ s: "A", t: "1".repeat(81), c: "100", d: "1" }))).toBe("BAD_FORMAT");
  });

  it("rejects a non-hex signature", () => {
    expect(parseReceiptPayload(query({ s: "A", t: "1", c: "100", d: "1", g: "not-hex!" }))).toBe("BAD_FORMAT");
  });

  it("signs a stable, documented message", () => {
    // A POS vendor implements this from the written spec, not from this
    // code — so the exact string has to be pinned by a test.
    expect(
      signingMessage({ storeCode: "CL-SANDTON-04", externalTxnId: "884231", amountCents: 8500, purchasedAtUnix: 1755512582 }),
    ).toBe("CL-SANDTON-04|884231|8500|1755512582");
  });

  it("produces a 20-character hex signature", () => {
    const sig = signReceipt(SECRET, "CL-04|1|100|1755512582");
    expect(sig).toMatch(/^[0-9a-f]{20}$/);
  });

  it("verifies a correct signature and rejects a wrong one", () => {
    const message = "CL-04|1|100|1755512582";
    const sig = signReceipt(SECRET, message);

    expect(verifySignature(SECRET, message, sig)).toBe(true);
    expect(verifySignature(SECRET, message, sig.toUpperCase())).toBe(true);
    expect(verifySignature("a-different-secret", message, sig)).toBe(false);
    // The attack the signature exists for: the amount was edited.
    expect(verifySignature(SECRET, "CL-04|1|10000|1755512582", sig)).toBe(false);
  });

  it("rejects a truncated signature without throwing", () => {
    // timingSafeEqual throws on a length mismatch, so length is checked
    // first — a short signature must be a false, not a 500.
    const sig = signReceipt(SECRET, "m");
    expect(() => verifySignature(SECRET, "m", sig.slice(0, 4))).not.toThrow();
    expect(verifySignature(SECRET, "m", sig.slice(0, 4))).toBe(false);
  });

  it("round-trips through a built URL", () => {
    const purchasedAt = new Date("2026-08-18T11:43:02.000Z");
    const url = buildReceiptUrl(
      "https://qumo.test",
      { storeCode: "CL-04", externalTxnId: "884231", amountCents: 8500, purchasedAt },
      SECRET,
    );

    const parsed = parseReceiptPayload(new URL(url).searchParams);
    if (typeof parsed === "string") throw new Error(parsed);

    expect(parsed.amountCents).toBe(8500);
    const message = signingMessage({
      storeCode: parsed.storeCode,
      externalTxnId: parsed.externalTxnId,
      amountCents: parsed.amountCents,
      purchasedAtUnix: Math.floor(parsed.purchasedAt.getTime() / 1000),
    });
    expect(verifySignature(SECRET, message, parsed.signature!)).toBe(true);
  });

  it("omits the signature when a store has no key", () => {
    const url = buildReceiptUrl(
      "https://qumo.test",
      { storeCode: "CL-04", externalTxnId: "1", amountCents: 100, purchasedAt: new Date() },
      null,
    );
    expect(url).not.toContain("&g=");
  });
});

describe("percentOfSpend", () => {
  it("computes the headline case exactly", () => {
    expect(percentOfSpend(8500, 500)).toBe(425); // 5% of R85.00
  });

  it("rounds down, never up", () => {
    // A cent extra on every transaction is a cost the brand notices; a cent
    // short is one no shopper ever will.
    expect(percentOfSpend(999, 500)).toBe(49); // 49.95 -> 49
    expect(percentOfSpend(1, 500)).toBe(0);
    expect(percentOfSpend(19, 500)).toBe(0);
    expect(percentOfSpend(20, 500)).toBe(1);
  });

  it("handles the boundaries", () => {
    expect(percentOfSpend(10_000, 10_000)).toBe(10_000); // 100%
    expect(percentOfSpend(10_000, 1)).toBe(1); // 0.01%
    expect(percentOfSpend(0, 500)).toBe(0);
  });

  it("stays exact at large baskets", () => {
    // Integer arithmetic throughout — no float drift at scale.
    expect(percentOfSpend(1_234_567, 750)).toBe(92_592);
  });
});
