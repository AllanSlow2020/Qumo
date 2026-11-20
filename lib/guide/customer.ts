/**
 * The brands in the customer view on the How it works page, and the checks
 * that keep them honest.
 *
 * Invented brands, invented numbers, and nothing that reads a real brand: the
 * page shows a brand how the shopper's screens wear its name, its colour and
 * its typeface, and lets them try three different ones. Everything a screen
 * says comes from the real shopper surface (app/(shopper)), and
 * tests/guide-customer.test.ts fails if the wording here and the wording there
 * ever part company.
 *
 * ── What a brand controls, and what it does not ──────────────────────────
 *
 * Its name, a tagline, a logo (not drawn here), an accent colour with the ink
 * that sits on it, and the typeface for headings. The accent marks action and
 * progress and nothing else: money is always ink, so a brand whose colour is
 * red does not get a column of red amounts that read as money lost. The
 * guide's phone follows that rule, because a page that showed otherwise would
 * be promising a brand something the product does not do.
 */

import type { FontId } from "@/lib/brand/fonts";

export type TourKind = "card" | "balance";

export type TourBrandSpec = {
  id: "copper-kettle" | "amber-oak" | "harbour-bakery";
  name: string;
  tagline: string;
  /** The brand's colour, and the ink drawn on top of it. */
  accent: string;
  accentInk: string;
  /** From the console's own list, so the face on screen is one a brand can pick. */
  fontId: FontId;
  kind: TourKind;
  campaignName: string;
  /** What the scanned code is worth. Stamps for a card, cents for a balance. */
  worth: number;
  /** The balance before this scan, in the same unit. */
  before: number;
  /** Stamps that complete one card. Cards only. */
  completesAt?: number;
  /** What the brand calls the thing at the end, as the shopper's screen says it. */
  rewardName?: string;
  /** The code the shopper shows to claim it, when this scan completes a card. */
  rewardCode?: string;
};

/**
 * Three brands, each chosen to show a different thing.
 *
 * Copper Kettle is a card part way through. Amber Oak pays a share of the
 * basket into a balance, with the rand figure worked out by the ledger's own
 * function in customer-view.tsx. Harbour Bakery's scan completes a card, so
 * the result screen shows what a finished one looks like.
 */
export const TOUR_BRANDS: TourBrandSpec[] = [
  {
    id: "copper-kettle",
    name: "Copper Kettle",
    tagline: "Small-batch coffee",
    accent: "#b4541d",
    accentInk: "#ffffff",
    fontId: "fraunces",
    kind: "card",
    campaignName: "Coffee card",
    worth: 1,
    before: 3,
    completesAt: 10,
    rewardName: "a free coffee",
  },
  {
    id: "amber-oak",
    name: "Amber Oak",
    tagline: "Spirits and bottle store",
    accent: "#1f3a5f",
    accentInk: "#ffffff",
    fontId: "instrument-sans",
    kind: "balance",
    campaignName: "5% back",
    // Five percent of a R120 basket. The figure itself is worked out where it
    // is shown, by the ledger's own function, so the page cannot say 5% and
    // show a number the engine would not produce.
    worth: 600,
    before: 1250,
  },
  {
    id: "harbour-bakery",
    name: "Harbour Bakery",
    tagline: "Fresh every morning",
    accent: "#0f766e",
    accentInk: "#ffffff",
    fontId: "figtree",
    kind: "card",
    campaignName: "Loaf card",
    worth: 1,
    before: 5,
    completesAt: 6,
    rewardName: "a free loaf",
    rewardCode: "HB-7K3Q",
  },
];

/** Relative luminance of a #rrggbb colour, per WCAG 2.x. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Contrast ratio between two #rrggbb colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
