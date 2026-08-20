import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getTheme } from "@/lib/theme";
import { PRODUCT_NAME } from "@/lib/product";
import "./globals.css";

// One face, self-hosted by next/font at build time rather than fetched from
// Google at runtime — faster, and one less external origin to allow when a
// content security policy gets written.
//
// Only Inter, where CIOS carried three. The other two dressed a staff portal
// that did not come with us, and per-brand theming (Phase D) will bring its
// own type decisions anyway: the whole point of a skinned site is that
// Chicken Licken does not look like Campari.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
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
    <html lang="en" className={inter.variable} {...(theme ? { "data-theme": theme } : {})}>
      <body>{children}</body>
    </html>
  );
}
