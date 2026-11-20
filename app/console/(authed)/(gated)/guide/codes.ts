/**
 * The three kinds of code, once.
 *
 * Both the "Where to start" cards at the top of the guide and the ladder of
 * proof further down describe the same three things, and a page that says one
 * thing in its opening cards and another in the comparison below them is a
 * guide that contradicts itself. So the words live here and both read them.
 *
 * ── What is a fact and what is wording ───────────────────────────────────
 *
 * What each code proves, and so what it can award, is a fact about the
 * engine: a poster code never awards, a pack code can award a fixed amount or
 * a stamp but cannot know what was spent, and only a till slip carries the
 * basket total. The `awards` flags below are those facts. They are not tuned
 * for the page; if the engine's rules change, this is the file that has to.
 */

export type CodeId = "poster" | "pack" | "slip";

export interface CodeKind {
  id: CodeId;
  /** As the guide's sections name it. */
  name: string;
  /** One sentence for the opening cards. */
  summary: string;
  /** Who can scan it. */
  who: string;
  /** What it proves, in a phrase. */
  proves: string;
  /** How much it proves, 0 to 2, for the meter: nothing, the item, the item and the amount. */
  proofLevel: 0 | 1 | 2;
  awards: { stamp: boolean; fixed: boolean; share: boolean };
  /** How much of your own work it asks for. */
  effort: string;
  /** The thing in the world, said in a line, above the "try it" buttons. */
  scene: string;
}

export const CODES: CodeKind[] = [
  {
    id: "poster",
    name: "A poster code",
    summary:
      "Explains what you are running and takes sign-ups. Anybody can scan it, so it never awards anything.",
    who: "Anybody walking past, and anybody they send a photo to",
    proves: "Nothing",
    proofLevel: 0,
    awards: { stamp: false, fixed: false, share: false },
    effort: "Print it and put it up",
    scene: "A poster on a shop wall, with a code printed on it once.",
  },
  {
    id: "pack",
    name: "A pack code",
    summary: "One unique code per item, under the label or inside the sleeve. Each one works once, ever.",
    who: "Whoever has the item in their hands",
    proves: "That it was bought",
    proofLevel: 1,
    awards: { stamp: true, fixed: true, share: false },
    effort: "No technical work",
    scene: "A box of tea with its own code under the label. Worth R5 a scan, in this example.",
  },
  {
    id: "slip",
    name: "A till slip code",
    summary:
      "Printed per transaction with the basket total. The only code that can award a share of what they spend.",
    who: "Whoever took the receipt",
    proves: "That it was bought, and what it came to",
    proofLevel: 2,
    awards: { stamp: true, fixed: true, share: true },
    effort: "Your till prints and signs it",
    scene: "A receipt for R184.50, signed by the till that printed it. Worth 5% of the basket, in this example.",
  },
];

/** The three shapes a promotion can award, in the console's own words. */
export const AWARD_ROWS = [
  { key: "stamp", label: "A stamp toward a card" },
  { key: "fixed", label: "A fixed amount per scan" },
  { key: "share", label: "A share of what they spend" },
] as const;

/** Where a reader who does not know what they are doing should begin. */
export const START_HERE: CodeId = "pack";
