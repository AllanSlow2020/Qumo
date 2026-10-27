import { describe, expect, it } from "vitest";
import {
  meetsProofTier,
  PROOF_TIERS,
  TIER_COPY,
  tierRefusal,
  weakestTier,
  type ProofTier,
} from "@/lib/proof/tier";

describe("how much a scan proved", () => {
  it("accepts a tier that is exactly what was asked for", () => {
    for (const tier of PROOF_TIERS) {
      expect(meetsProofTier(tier, tier)).toBe(true);
    }
  });

  it("accepts stronger proof than was asked for", () => {
    expect(meetsProofTier("SIGNED", "UNSIGNED")).toBe(true);
    expect(meetsProofTier("SIGNED", "PHOTO")).toBe(true);
    expect(meetsProofTier("UNSIGNED", "PHOTO")).toBe(true);
  });

  it("refuses weaker proof than was asked for", () => {
    expect(meetsProofTier("UNSIGNED", "SIGNED")).toBe(false);
    expect(meetsProofTier("PHOTO", "SIGNED")).toBe(false);
    expect(meetsProofTier("PHOTO", "UNSIGNED")).toBe(false);
  });

  it("orders the scale strongest first, which is the order a form offers it in", () => {
    expect(PROOF_TIERS).toEqual(["SIGNED", "UNSIGNED", "PHOTO"]);
    // And the ordering is total: every pair compares one way or the other.
    for (const a of PROOF_TIERS) {
      for (const b of PROOF_TIERS) {
        if (a === b) continue;
        expect(meetsProofTier(a, b)).not.toBe(meetsProofTier(b, a));
      }
    }
  });

  it("picks the weaker of two tiers", () => {
    expect(weakestTier("SIGNED", "PHOTO")).toBe("PHOTO");
    expect(weakestTier("PHOTO", "SIGNED")).toBe("PHOTO");
    expect(weakestTier("UNSIGNED", "UNSIGNED")).toBe("UNSIGNED");
  });

  it("says what every tier gives and costs, with nothing left blank", () => {
    for (const tier of PROOF_TIERS) {
      const copy = TIER_COPY[tier as ProofTier];
      expect(copy.label.trim().length).toBeGreaterThan(0);
      expect(copy.gives.trim().length).toBeGreaterThan(0);
      expect(copy.costs.trim().length).toBeGreaterThan(0);
    }
  });

  it("names the ceilings in the weakest tier's cost, since they are what stands behind it", () => {
    expect(TIER_COPY.PHOTO.costs).toMatch(/budget/i);
    expect(TIER_COPY.PHOTO.costs).toMatch(/ceiling/i);
  });

  it("tells a refused shopper what the promotion takes, not that they failed", () => {
    for (const floor of ["SIGNED", "UNSIGNED"] as ProofTier[]) {
      const said = tierRefusal(floor);
      expect(said).toMatch(/This promotion/);
      // No blaming the person holding the phone.
      expect(said).not.toMatch(/\byou (failed|cannot|are not)\b/i);
    }
  });
});
