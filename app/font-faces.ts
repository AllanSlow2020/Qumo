import {
  Archivo,
  DM_Sans,
  Figtree,
  Fraunces,
  Instrument_Sans,
  Inter,
  JetBrains_Mono,
  Martian_Mono,
  Roboto_Mono,
  Space_Grotesk,
} from "next/font/google";
import { FONTS, type FontId } from "@/lib/brand/fonts";

/**
 * Every face the registry offers, loaded once.
 *
 * Separate from lib/brand/fonts.ts because `next/font` is a build-time
 * transform that has to be called at module scope with literal arguments —
 * it cannot be handed a value from the database, which is the whole reason
 * the choice is an id from a list rather than a font name in a text box.
 * Keeping the metadata in a plain file also means the console's picker and
 * the validator can read the list without pulling a font loader in with
 * them. tests/brand-fonts.test.ts holds the two files in agreement.
 *
 * All of them are declared on <html>, and that is cheaper than it looks: a
 * declaration is a few lines of CSS, and a browser downloads a face only
 * when something on the page is actually set in it. So a brand on the
 * default pays for the default.
 *
 * `preload` is on for Qumo's own two and off for the rest. A preload hint
 * for a face this page will not use is a wasted request on a phone in a
 * queue; the brand's chosen face is picked up on first paint by the normal
 * path, one hop later.
 *
 * Self-hosted by next/font at build time rather than fetched at runtime, so
 * `font-src 'self'` in the content security policy stays as it is and no
 * shopper's browser tells a font CDN which brand's page they are on.
 *
 * No `weight` on any of them: every face here is a variable font, so one
 * file carries the whole range and the stylesheet can ask for 500 or 700
 * without a separate download.
 */

/* Written out one by one rather than spread from a shared object: the
 * `next/font` transform reads these arguments at build time and refuses
 * anything it cannot see literally, a spread included. Repetitive on
 * purpose, and the compiler is the one enforcing it. */

const instrumentSans = Instrument_Sans({ subsets: ["latin"], variable: "--qf-instrument-sans", preload: true });
const martianMono = Martian_Mono({ subsets: ["latin"], variable: "--qf-martian-mono", preload: true });

const inter = Inter({ subsets: ["latin"], variable: "--qf-inter", preload: false });
const figtree = Figtree({ subsets: ["latin"], variable: "--qf-figtree", preload: false });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--qf-dm-sans", preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--qf-space-grotesk", preload: false });
const archivo = Archivo({ subsets: ["latin"], variable: "--qf-archivo", preload: false });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--qf-fraunces", preload: false });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--qf-jetbrains-mono", preload: false });
const robotoMono = Roboto_Mono({ subsets: ["latin"], variable: "--qf-roboto-mono", preload: false });

/** The class that defines each face's custom property, by registry id. */
export const FONT_CLASSES: Record<FontId, string> = {
  "instrument-sans": instrumentSans.variable,
  inter: inter.variable,
  figtree: figtree.variable,
  "dm-sans": dmSans.variable,
  "space-grotesk": spaceGrotesk.variable,
  archivo: archivo.variable,
  fraunces: fraunces.variable,
  "martian-mono": martianMono.variable,
  "jetbrains-mono": jetbrainsMono.variable,
  "roboto-mono": robotoMono.variable,
};

/** All of them, for the <html> tag. Derived from the registry so a face added to one list is added to both. */
export const ALL_FONT_CLASSES = FONTS.map((font) => FONT_CLASSES[font.id]).join(" ");
