import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  formatSecretForDisplay,
  generateTotpSecret,
  otpauthUrl,
  totpCode,
  totpCodeForStep,
  totpStep,
  verifyTotp,
} from "@/lib/staff/totp";

/**
 * RFC 6238 Appendix B.
 *
 * These are the reason writing the algorithm out rather than installing it
 * is defensible: the implementation is checked against the values in the
 * specification, not against a second reading of the same misunderstanding.
 * The published vectors are eight digits, which is why totpCodeForStep
 * takes a digit count.
 */
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));
const RFC_VECTORS: [seconds: number, code: string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("RFC 6238 test vectors", () => {
  it.each(RFC_VECTORS)("matches the published code at T=%i", (seconds, expected) => {
    const step = Math.floor(seconds / 30);
    expect(totpCodeForStep(RFC_SECRET, step, 8)).toBe(expected);
  });

  it("still matches past 2^32 steps, where naive counter arithmetic breaks", () => {
    // T=20000000000 is the vector that catches a 32-bit counter. It is in
    // the list above and worth naming: writeBigUInt64BE is not decoration.
    expect(totpCodeForStep(RFC_SECRET, Math.floor(20000000000 / 30), 8)).toBe("65353130");
  });
});

describe("base32", () => {
  it("round-trips", () => {
    const original = Buffer.from("a secret worth keeping", "utf8");
    expect(base32Decode(base32Encode(original)).equals(original)).toBe(true);
  });

  it("accepts a secret retyped with the spacing we printed", () => {
    const secret = generateTotpSecret();
    expect(base32Decode(formatSecretForDisplay(secret)).equals(base32Decode(secret))).toBe(true);
  });

  it("refuses something that is not base32", () => {
    expect(() => base32Decode("not-valid-1889")).toThrow();
  });
});

describe("generateTotpSecret", () => {
  it("is 160 bits, as the RFC assumes", () => {
    expect(base32Decode(generateTotpSecret())).toHaveLength(20);
  });

  it("is never the same twice", () => {
    expect(new Set(Array.from({ length: 200 }, generateTotpSecret)).size).toBe(200);
  });
});

describe("verifyTotp", () => {
  const secret = generateTotpSecret();
  const now = new Date("2026-09-03T12:00:00Z");

  it("accepts the current code", () => {
    const result = verifyTotp(secret, totpCode(secret, now), now);
    expect(result.ok).toBe(true);
  });

  it("says which step the code belonged to, so a replay can be refused", () => {
    const result = verifyTotp(secret, totpCode(secret, now), now);
    expect(result.ok && result.step).toBe(totpStep(now));
  });

  it("accepts one step either side, for a phone whose clock has drifted", () => {
    const before = new Date(now.getTime() - 30_000);
    const after = new Date(now.getTime() + 30_000);
    expect(verifyTotp(secret, totpCode(secret, before), now).ok).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, after), now).ok).toBe(true);
  });

  it("refuses two steps away, so the window is a window and not a door", () => {
    const tooEarly = new Date(now.getTime() - 90_000);
    expect(verifyTotp(secret, totpCode(secret, tooEarly), now).ok).toBe(false);
  });

  it("refuses another secret's code", () => {
    expect(verifyTotp(secret, totpCode(generateTotpSecret(), now), now).ok).toBe(false);
  });

  it("refuses anything that is not six digits, without throwing", () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34 56", "<script>"]) {
      expect(verifyTotp(secret, bad, now).ok).toBe(false);
    }
  });

  it("tolerates a code pasted with spaces", () => {
    const code = totpCode(secret, now);
    expect(verifyTotp(secret, ` ${code} `, now).ok).toBe(true);
  });
});

describe("otpauthUrl", () => {
  it("carries the issuer in both places the apps read it", () => {
    const url = otpauthUrl("ABCDEFGH", "thandi@example.com", "Qumo");
    expect(url).toContain("otpauth://totp/Qumo%3Athandi%40example.com");
    expect(url).toContain("issuer=Qumo");
    expect(url).toContain("secret=ABCDEFGH");
  });
});
