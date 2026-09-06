import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FONTS, DEFAULT_DISPLAY_FONT, DEFAULT_FIGURE_FONT, findFont, fontStack } from "@/lib/brand/fonts";
import { toBrandTheme, brandStyle, safeFont } from "@/lib/brand/theme";

/**
 * The registry, and the way it can quietly come apart.
 *
 * A brand's chosen face is a reference to a custom property that
 * app/font-faces.ts is supposed to have defined. If the two files disagree
 * about the property's name, nothing errors — the reference resolves to
 * nothing and the page renders in the browser's default font, on the one
 * screen whose entire job is looking like the brand.
 *
 * TypeScript already covers half of it: FONT_CLASSES is keyed by FontId, so
 * a face cannot be missing or invented. What it cannot see is the string
 * inside the `variable:` option, which is what actually names the property.
 * So that half is checked against the source text, because that is where
 * the fact lives — app/font-faces.ts cannot be imported here at all, since
 * `next/font` only exists as a build-time transform.
 */
const FACES_SOURCE = readFileSync(new URL("../app/font-faces.ts", import.meta.url), "utf8");

describe("lib/brand/fonts", () => {
  it("defines the custom property each registry entry advertises", () => {
    for (const font of FONTS) {
      expect(FACES_SOURCE, `app/font-faces.ts never defines ${font.variable}`).toContain(
        `variable: "${font.variable}"`,
      );
    }
  });

  it("loads no face the registry does not list", () => {
    // A face loaded and not listed is a download nobody can choose.
    const declared = [...FACES_SOURCE.matchAll(/variable: "(--qf-[a-z0-9-]+)"/g)].map((m) => m[1]);
    expect(new Set(declared)).toEqual(new Set(FONTS.map((f) => f.variable)));
  });

  it("derives every property name from the id, so one rename is enough", () => {
    for (const font of FONTS) {
      expect(font.variable).toBe(`--qf-${font.id}`);
    }
  });

  it("has both defaults in the list", () => {
    expect(findFont(DEFAULT_DISPLAY_FONT)).not.toBeNull();
    expect(findFont(DEFAULT_FIGURE_FONT)).not.toBeNull();
    // The figures default has to have fixed-width digits. A default that
    // does not would make the warning on the picker a lie.
    expect(findFont(DEFAULT_FIGURE_FONT)?.mono).toBe(true);
  });

  it("offers a real choice on both sides", () => {
    expect(FONTS.filter((f) => !f.mono).length).toBeGreaterThan(1);
    expect(FONTS.filter((f) => f.mono).length).toBeGreaterThan(1);
  });
});

describe("a font a brand did not choose", () => {
  const base = {
    id: "b1",
    slug: "chicken-licken",
    name: "Chicken Licken",
    displayName: null,
    tagline: null,
    logoUrl: null,
    accentColor: null,
    accentInkColor: null,
    supportEmail: null,
    supportUrl: null,
  };

  it("is looked up, not sanitised — an unknown id is Qumo's own", () => {
    // The value reaches a font-family, which will happily accept a bare
    // word, so nothing a brand stored is allowed through. A row written
    // straight into the database gets the default, not a broken page.
    expect(safeFont("Comic Sans MS")).toBeNull();
    expect(safeFont("var(--qf-inter); background: url(https://evil/)")).toBeNull();
    expect(safeFont("")).toBeNull();
    expect(safeFont(null)).toBeNull();
    expect(safeFont("inter")?.id).toBe("inter");
  });

  it("writes no token at all, so the default in globals.css applies", () => {
    const theme = toBrandTheme({ ...base, displayFont: null, figureFont: null });
    expect(theme.displayFont).toBeNull();
    expect(brandStyle(theme)).toBeUndefined();
  });

  it("writes only the side the brand set", () => {
    const theme = toBrandTheme({ ...base, displayFont: "fraunces", figureFont: null });
    expect(brandStyle(theme)).toEqual({ "--font-display": "var(--qf-fraunces)" });
  });

  it("lets a brand take both, which is the point", () => {
    const theme = toBrandTheme({ ...base, displayFont: "archivo", figureFont: "jetbrains-mono" });
    expect(brandStyle(theme)).toEqual({
      "--font-display": "var(--qf-archivo)",
      "--font-mono": "var(--qf-jetbrains-mono)",
    });
  });

  it("lets a brand set its figures in a proportional face, warned but not blocked", () => {
    // Allowed on purpose: a brand that wants one face throughout is making a
    // real choice. The console says what it costs; nothing here refuses it.
    const theme = toBrandTheme({ ...base, displayFont: "fraunces", figureFont: "fraunces" });
    expect(brandStyle(theme)).toEqual({
      "--font-display": "var(--qf-fraunces)",
      "--font-mono": "var(--qf-fraunces)",
    });
  });

  it("puts a reference to our own property in the style, never the stored string", () => {
    for (const font of FONTS) {
      expect(fontStack(font)).toBe(`var(--qf-${font.id})`);
    }
  });
});
