import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findFont } from "@/lib/brand/fonts";
import { cardStanding } from "@/lib/consumer/progress";
import { formatLedgerAmount } from "@/lib/consumer/wallet";
import { contrast, TOUR_BRANDS } from "@/lib/guide/customer";
import { stampsAfter } from "@/lib/guide/card";
import { percentOfSpend } from "@/lib/ledger/percent";

/**
 * The customer view on the How it works page.
 *
 * It shows a brand what its customers see, in words that are meant to be the
 * ones on the real screens. A guide that quotes a screen the product no longer
 * has is worse than no guide, so the sentences are held against the shopper
 * surface's own source: change one there and this fails until the page is
 * brought back into line.
 */

const read = (path: string) => readFileSync(path, "utf8").replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const GUIDE = read("app/console/(authed)/(gated)/guide/phone-tour.tsx");

/** [what the guide says, the shopper file it comes from] */
const QUOTES: [string, string][] = [
  ["Waiting for you", "app/(shopper)/wallet/login/page.tsx"],
  ["Sign in below and it lands in your balance.", "app/(shopper)/wallet/login/page.tsx"],
  ["Enter your mobile number and we'll text you a code. No password to remember.", "app/(shopper)/wallet/login/page.tsx"],
  ["Mobile number", "app/(shopper)/wallet/login/login-form.tsx"],
  ["Send me a code", "app/(shopper)/wallet/login/login-form.tsx"],
  ["We sent a 6-digit code to", "app/(shopper)/wallet/login/login-form.tsx"],
  ["It expires in 10 minutes.", "app/(shopper)/wallet/login/login-form.tsx"],
  ["Your code", "app/(shopper)/wallet/login/login-form.tsx"],
  ["Sign in", "app/(shopper)/wallet/login/login-form.tsx"],
  ["Use a different number", "app/(shopper)/wallet/login/login-form.tsx"],
  ["code is worth", "app/(shopper)/s/[code]/page.tsx"],
  ["Each code works once, so scanning this one again won't add more.", "app/(shopper)/s/[code]/page.tsx"],
  ["Card complete, you've earned", "app/(shopper)/s/[code]/page.tsx"],
  ["Show this code to claim it. It's saved in your rewards too.", "app/(shopper)/s/[code]/page.tsx"],
  ["See my rewards", "app/(shopper)/s/[code]/page.tsx"],
  ["Yours to use", "app/(shopper)/wallet/page.tsx"],
  ["Nothing waiting right now. Finish a card and the code turns up here.", "app/(shopper)/wallet/page.tsx"],
  ["rewards, run on", "app/(shopper)/qumo-footer.tsx"],
];

describe("the sentences on the phone", () => {
  it.each(QUOTES)("%s is on the real screen as well", (quote, file) => {
    expect(read(file)).toContain(quote);
    expect(GUIDE).toContain(quote);
  });

  it("promises a six-digit code, which is the length the form accepts", () => {
    expect(read("app/(shopper)/wallet/login/login-form.tsx")).toContain("code.length !== 6");
  });
});

describe("the brands", () => {
  it("each use a typeface a brand can actually choose", () => {
    for (const b of TOUR_BRANDS) expect(findFont(b.fontId)).not.toBeNull();
  });

  it("each put legible text on their colour", () => {
    for (const b of TOUR_BRANDS) expect(contrast(b.accent, b.accentInk)).toBeGreaterThanOrEqual(4.5);
  });

  it("are distinct, and invented", () => {
    expect(new Set(TOUR_BRANDS.map((b) => b.id)).size).toBe(TOUR_BRANDS.length);
    expect(TOUR_BRANDS.map((b) => b.name)).toEqual(["Copper Kettle", "Amber Oak", "Harbour Bakery"]);
  });
});

describe("what the three brands show", () => {
  it("Amber Oak pays five percent of a R120 basket, rounded the ledger's way", () => {
    const amber = TOUR_BRANDS.find((b) => b.id === "amber-oak")!;
    expect(percentOfSpend(12_000, 500)).toBe(amber.worth);
    expect(formatLedgerAmount(amber.worth, "CENTS")).toBe("R6.00");
    expect(formatLedgerAmount(amber.before + amber.worth, "CENTS")).toBe("R18.50");
  });

  it("Copper Kettle is part way through a card, and the wallet says how far", () => {
    const k = TOUR_BRANDS.find((b) => b.id === "copper-kettle")!;
    const { completed, onCard } = stampsAfter(k.before + k.worth, k.completesAt!);
    expect(completed).toBe(0);
    expect(onCard).toBe(4);
    const standing = cardStanding(
      { campaignId: k.id, campaignName: k.campaignName, unit: "STAMPS", completesAt: k.completesAt!, rewardName: k.rewardName! },
      onCard,
    );
    expect(standing.line).toBe("6 more stamps and a free coffee is yours.");
    expect(k.rewardCode).toBeUndefined();
  });

  it("Harbour Bakery's scan completes the card, so it has a code to show", () => {
    const h = TOUR_BRANDS.find((b) => b.id === "harbour-bakery")!;
    const { completed, onCard } = stampsAfter(h.before + h.worth, h.completesAt!);
    expect(completed).toBe(1);
    // The card's worth comes off, and the next card starts empty.
    expect(onCard).toBe(0);
    expect(h.rewardCode).toBeTruthy();
  });
});
