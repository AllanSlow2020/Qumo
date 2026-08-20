import { describe, expect, it } from "vitest";
import { formatSaPhoneForDisplay, normaliseSaPhone, InvalidPhoneNumberError } from "@/lib/consumer/phone";

describe("lib/consumer/phone", () => {
  it("normalises every form a South African actually types to one E.164 value", () => {
    // The whole point of this function: all of these are one person, and
    // must hash to one Qumo account.
    const expected = "+27821234567";
    for (const input of [
      "0821234567",
      "082 123 4567",
      "082-123-4567",
      "(082) 123 4567",
      "+27821234567",
      "+27 82 123 4567",
      "27821234567",
      "  0821234567  ",
    ]) {
      expect(normaliseSaPhone(input), `input: ${input}`).toBe(expected);
    }
  });

  it("rejects input that isn't a South African number", () => {
    for (const input of [
      "",
      "   ",
      "abc",
      "12345",
      "082123456", // one digit short
      "08212345678", // one digit long
      "+447911123456", // UK
      "+27021234567", // subscriber part starts with 0
    ]) {
      expect(() => normaliseSaPhone(input), `input: ${input}`).toThrow(InvalidPhoneNumberError);
    }
  });

  it("does not treat a leading-plus number as a local one", () => {
    // "+0821234567" is not a valid E.164 value and must not be silently
    // read as the local 0821234567 — that would accept a typo as if it
    // were deliberate.
    expect(() => normaliseSaPhone("+0821234567")).toThrow(InvalidPhoneNumberError);
  });

  it("formats back to the local form people recognise", () => {
    expect(formatSaPhoneForDisplay("+27821234567")).toBe("082 123 4567");
  });

  it("returns anything it can't format unchanged rather than mangling it", () => {
    expect(formatSaPhoneForDisplay("+447911123456")).toBe("+447911123456");
  });
});
