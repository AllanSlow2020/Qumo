import type { Metadata } from "next";
import { Instrument_Sans, Martian_Mono } from "next/font/google";
import { getTheme } from "@/lib/theme";
import { PRODUCT_NAME } from "@/lib/product";
import "./globals.css";

/**
 * Two faces, two jobs, and the split is the type contract rather than a
 * preference.
 *
 * ── Why two roles and not one ────────────────────────────────────────────
 *
 * Brands will choose their own type. That is right for the *display* face:
 * the wordmark, the headings, the voice — it is their site and their
 * identity. It is wrong for the *numeric* face, and the reason is concrete:
 * a balance, a basket total and a column of amounts need tabular figures, a
 * real bold, and an unambiguous 0/O and 1/l. A brand picking a face without
 * tabular numerals makes every amount column jitter as it updates, and the
 * balance is the one number in this product that must never look sloppy.
 *
 * So: the brand sets the display face, we own the numerals. It is the same
 * shape as the colour contract — they choose the accent, we refuse one that
 * renders illegibly.
 *
 * ── Why these two ────────────────────────────────────────────────────────
 *
 * Instrument Sans is the default display face, replaced per brand later.
 * Martian Mono carries every figure: a receipt reads down a column, and a
 * true monospace is what makes that column line up. It is also deliberately
 * not one of the two or three grotesques every product ships with.
 *
 * Self-hosted by next/font at build time rather than fetched at runtime, so
 * `font-src 'self'` in the content security policy stays as it is and no
 * shopper's browser tells a font CDN which page they are on.
 */
const display = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

const mono = Martian_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "Your rewards, in one place.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read server-side and stamped on <html>, so the first paint is already in
  // the right theme — a class toggled after hydration flashes the wrong one.
  const theme = await getTheme();

  return (
    <html
      lang="en"
      className={`${display.variable} ${mono.variable}`}
      {...(theme ? { "data-theme": theme } : {})}
    >
      <body>{children}</body>
    </html>
  );
}
