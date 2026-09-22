import { describe, expect, it } from "vitest";
import { smallestTagFor, TAG_CAPACITY, tagBytes } from "@/lib/packs/nfc";

/**
 * Whether a pack code URL fits on a tag.
 *
 * The answer is comfortably yes and always will be, which is exactly why
 * this is asserted rather than assumed: the screen tells a brand a number,
 * and a number on a screen that nothing checks is a number that drifts the
 * first time the URL shape changes.
 */
describe("what a pack code costs on an NFC tag", () => {
  const url = "https://copper-kettle.qumo.co.za/s/7XQP928KM3RT";

  it("charges one byte for https:// rather than eight", () => {
    // The saving is the one non-obvious thing about NDEF sizing, and it is
    // the difference between a long slug fitting and not.
    // The same URL under a scheme of the same length that NDEF has no
    // shorthand for, so the only difference measured is the abbreviation.
    const withPrefix = tagBytes(url);
    const withoutPrefix = tagBytes(url.replace("https://", "wwwww://"));
    expect(withoutPrefix - withPrefix).toBe(8);
  });

  it("fits a real code on the cheapest tag, with room to spare", () => {
    const tag = smallestTagFor(url);
    expect(tag?.name).toBe("NTAG213");
    expect(tagBytes(url)).toBeLessThan(TAG_CAPACITY[0].bytes / 2);
  });

  it("still fits with a slug at the longest a brand can have", () => {
    // Slugs are bounded, so the worst case is computable rather than
    // hypothetical. If this ever fails, the pack mechanic has outgrown the
    // cheap tags and somebody needs to know before the order is placed.
    const long = `https://${"a".repeat(63)}.qumo.co.za/s/7XQP928KM3RT`;
    expect(smallestTagFor(long)?.name).toBe("NTAG213");
  });

  it("says so rather than lying when nothing fits", () => {
    expect(smallestTagFor(`https://x.co.za/${"a".repeat(2000)}`)).toBeNull();
  });
});
