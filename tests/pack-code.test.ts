import { describe, expect, it } from "vitest";
import { formatPackCode, generatePackCode, looksLikePackCode, normalisePackCode } from "@/lib/packs/code";
import { safeShopperRedirect } from "@/lib/consumer/redirect";

describe("lib/packs/code", () => {
  it("generates codes in canonical form — no separators, upper case", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generatePackCode();
      expect(code).toMatch(/^[A-Z0-9]{12}$/);
      expect(looksLikePackCode(code)).toBe(true);
      // Canonical is what the database stores; storing the display form
      // would mean a code typed without hyphens missed its own row.
      expect(normalisePackCode(code)).toBe(code);
    }
  });

  it("never emits ambiguous characters", () => {
    // 0/O and 1/I/L are the pairs people mistype off a label.
    const codes = Array.from({ length: 300 }, generatePackCode).join("");
    for (const char of ["0", "O", "1", "I", "L"]) {
      expect(codes.includes(char), `found ${char}`).toBe(false);
    }
  });

  it("does not repeat", () => {
    const codes = new Set(Array.from({ length: 2000 }, generatePackCode));
    expect(codes.size).toBe(2000);
  });

  it("normalises every form a code comes back in", () => {
    const canonical = "7XQP928KM3RT";
    for (const input of ["7XQP928KM3RT", "7xqp928km3rt", "7XQP-928K-M3RT", "7xqp 928k m3rt", "  7XQP-928K-M3RT  "]) {
      expect(normalisePackCode(input), `input: ${input}`).toBe(canonical);
    }
  });

  it("formats for a label", () => {
    expect(formatPackCode("7XQP928KM3RT")).toBe("7XQP-928K-M3RT");
  });

  it("rejects malformed codes before they reach the database", () => {
    for (const input of ["", "TOOSHORT", "7XQP928KM3RTEXTRA", "7XQP928KM3R0", "7XQP928KM3RI"]) {
      expect(looksLikePackCode(normalisePackCode(input)), `input: ${input}`).toBe(false);
    }
  });
});

describe("lib/consumer/redirect", () => {
  it("keeps a scan destination so the code isn't lost through login", () => {
    expect(safeShopperRedirect("/s/7XQP928KM3RT")).toBe("/s/7XQP928KM3RT");
    expect(safeShopperRedirect("/wallet")).toBe("/wallet");
  });

  it("refuses to send a shopper off-site", () => {
    // The attack: a shopper about to type a passcode is exactly who won't
    // notice the domain changed.
    for (const hostile of [
      "https://not-us.example/login",
      "//not-us.example",
      "/\\not-us.example",
      "http://not-us.example",
      "javascript:alert(1)",
    ]) {
      expect(safeShopperRedirect(hostile), `input: ${hostile}`).toBe("/wallet");
    }
  });

  it("rejects whitespace and control characters", () => {
    expect(safeShopperRedirect("/wallet\nSet-Cookie: x=1")).toBe("/wallet");
    expect(safeShopperRedirect("/wallet with space")).toBe("/wallet");
  });

  it("falls back when nothing is supplied", () => {
    expect(safeShopperRedirect(undefined)).toBe("/wallet");
    expect(safeShopperRedirect(null)).toBe("/wallet");
    expect(safeShopperRedirect("")).toBe("/wallet");
  });
});
