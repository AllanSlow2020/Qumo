/**
 * The faces a brand can choose from, as data.
 *
 * Deliberately no `next/font` import in this file. The registry is read by
 * the console's picker, by the validator, and by a test - none of which
 * want a font loader dragged in behind them. The faces themselves are
 * loaded once, in app/font-faces.ts, and a test holds the two lists in
 * agreement so an id can never exist here without a face behind it.
 *
 * ── Why a list and not a text box ────────────────────────────────────────
 *
 * A brand typing a font name would produce three failures we cannot fix
 * from here: a name nobody's browser has, a webfont link that widens the
 * content security policy to a third party, and a file the brand may not
 * be licensed to serve. A curated list loads at build time from our own
 * origin, so `font-src 'self'` stays as it is and no shopper's browser
 * tells a font CDN which brand's page they are looking at.
 *
 * The list is short on purpose and each entry is here for a reason a
 * marketing person would recognise. It is meant to grow - adding a face is
 * two lines and a test that already passes - and a brand's own licensed
 * typeface is a real ask that wants file storage and a licence question
 * answered, which is a different piece of work.
 */

export type FontId =
  | "instrument-sans"
  | "inter"
  | "figtree"
  | "dm-sans"
  | "space-grotesk"
  | "archivo"
  | "fraunces"
  | "martian-mono"
  | "jetbrains-mono"
  | "roboto-mono";

export type FontFace = {
  id: FontId;
  label: string;
  /** What it is for, in the words of somebody choosing rather than building. */
  note: string;
  /**
   * True for the faces that are monospaced by construction.
   *
   * The distinction is narrower than it first looks, and worth stating
   * accurately because the console repeats it to a brand. Every figure on
   * the shopper surface is already set with `font-variant-numeric:
   * tabular-nums`, which most proportional faces honour - so a column of
   * amounts usually holds still in one of those too. What a monospace
   * guarantees is that it holds still whether the face has that feature or
   * not.
   *
   * So this decides what a brand is *told* before choosing a proportional
   * face for their figures, not whether they may. They may.
   */
  mono: boolean;
  /** The custom property app/font-faces.ts defines for this face. */
  variable: string;
};

/**
 * Qumo's own set style, and what every brand gets until it says otherwise.
 *
 * Instrument Sans has a real bold and enough character to not read as a
 * default; Martian Mono is a true monospace that is not one of the two or
 * three grotesques every product ships with. Together they are the house
 * style - a brand that never opens the appearance screen still gets a
 * considered page rather than the browser's idea of one.
 */
export const DEFAULT_DISPLAY_FONT: FontId = "instrument-sans";
export const DEFAULT_FIGURE_FONT: FontId = "martian-mono";

export const FONTS: FontFace[] = [
  {
    id: "instrument-sans",
    label: "Instrument Sans",
    note: "Qumo's own. Confident, a bit squarer than the usual, and it holds up small.",
    mono: false,
    variable: "--qf-instrument-sans",
  },
  {
    id: "inter",
    label: "Inter",
    note: "The neutral one. If your website already uses a sans and nobody can name it, it is probably this.",
    mono: false,
    variable: "--qf-inter",
  },
  {
    id: "figtree",
    label: "Figtree",
    note: "Rounder and warmer. Reads friendly without going soft.",
    mono: false,
    variable: "--qf-figtree",
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    note: "Geometric and quiet. Gets out of the way of a strong logo.",
    mono: false,
    variable: "--qf-dm-sans",
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    note: "Distinctive, slightly technical. Good when you want the type itself noticed.",
    mono: false,
    variable: "--qf-space-grotesk",
  },
  {
    id: "archivo",
    label: "Archivo",
    note: "Sturdy and loud in bold. Built for signage and price points.",
    mono: false,
    variable: "--qf-archivo",
  },
  {
    id: "fraunces",
    label: "Fraunces",
    note: "The serif. Reaches for premium rather than fast.",
    mono: false,
    variable: "--qf-fraunces",
  },
  {
    id: "martian-mono",
    label: "Martian Mono",
    note: "Qumo's own figures. Wide, deliberate, and every digit the same width.",
    mono: true,
    variable: "--qf-martian-mono",
  },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    note: "A tighter monospace. Fits more into a narrow amount column.",
    mono: true,
    variable: "--qf-jetbrains-mono",
  },
  {
    id: "roboto-mono",
    label: "Roboto Mono",
    note: "The quiet monospace. Barely announces itself.",
    mono: true,
    variable: "--qf-roboto-mono",
  },
];

const BY_ID = new Map<string, FontFace>(FONTS.map((font) => [font.id, font]));

/**
 * The face for an id, or null.
 *
 * Null for an id that is not in the list, which covers a value written
 * straight into the database and a face we removed after a brand had
 * chosen it. Both end up on Qumo's default, which is the right answer:
 * there is no version of "the brand picked a font we no longer have" that
 * should produce a broken page.
 */
export function findFont(id: string | null | undefined): FontFace | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

/**
 * What goes in a CSS font-family, for a face we have already found.
 *
 * A reference to the custom property, never the brand's stored string. The
 * value lands in a `style` attribute, so the same rule applies as to a
 * colour: it is not sanitised on the way out, it is built here out of
 * something that came from this file.
 */
export function fontStack(font: FontFace): string {
  return `var(${font.variable})`;
}
