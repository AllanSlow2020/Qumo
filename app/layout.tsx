import type { Metadata } from "next";
import { getTheme } from "@/lib/theme";
import { PRODUCT_NAME } from "@/lib/product";
import { ALL_FONT_CLASSES } from "./font-faces";
import "./globals.css";

/**
 * Two roles, and both of them a brand can take over.
 *
 * ── Why two roles and not one ────────────────────────────────────────────
 *
 * `--font-display` is everything a shopper reads. `--font-mono` is every
 * figure: a balance, a basket total, a coupon code, a column of amounts.
 * They are separate because the second job has a requirement the first does
 * not — digits that are all the same width, so a column does not shift
 * sideways as the numbers in it change. The stylesheet asks for that with
 * `font-variant-numeric: tabular-nums` on every figure, which most faces
 * honour; a monospace is the one that cannot fail to.
 *
 * That used to be a rule: brands chose the display face and we kept the
 * numerals. It is now a default. A brand can set both, because it is their
 * identity and a house style that cannot be turned off is not a default,
 * it is a restriction wearing one. What survives of the old rule is a note
 * on the picker pointing at the preview, which is where a face without
 * tabular figures actually shows itself.
 *
 * ── What the defaults are ────────────────────────────────────────────────
 *
 * Instrument Sans and Martian Mono, set in globals.css and pointed at by
 * these two variables. A brand that never opens the appearance screen gets
 * Qumo's set style rather than the browser's idea of one.
 *
 * Every face in the registry is declared here — see app/font-faces.ts for
 * why that is cheap — and a brand's choice is an alias of one of them,
 * applied where the accent is (lib/brand/theme.ts).
 */

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
      className={ALL_FONT_CLASSES}
      {...(theme ? { "data-theme": theme } : {})}
    >
      <body>{children}</body>
    </html>
  );
}
