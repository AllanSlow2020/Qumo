import type { Metadata } from "next";
import { currentBrand } from "@/lib/brand/current";
import { brandStyle, brandTitle } from "@/lib/brand/theme";
import { QumoFooter } from "./qumo-footer";
import "./shopper.css";

/**
 * The shopper shell. Mobile-first because it is reached almost exclusively
 * by scanning something with a phone - the narrow column is the design, not
 * a small-screen concession.
 *
 * Everything below lives under `.sc`, which is where the shopper surface's
 * own tokens are defined (shopper.css). Brand theming is an override of four
 * of those tokens and nothing more - the button, its ink, and the two type
 * faces - applied here as inline custom properties so they cascade to every
 * child without a stylesheet per brand.
 *
 * A request whose host names no brand never reaches a page under here: the
 * proxy rewrites it to /no-brand first. So this layout does not branch, and
 * requireBrand() throwing is a genuine invariant violation rather than a
 * routine case dressed up as one.
 */

export async function generateMetadata(): Promise<Metadata> {
  const brand = await currentBrand();
  return {
    // The title in a shared tab list, and in the link preview when a shopper
    // sends the page to somebody. It has to name the brand for the same
    // reason the header does.
    title: brandTitle(brand),
    description: brand ? `${brand.name} rewards.` : "Rewards programmes, run for brands.",
  };
}

export default async function ShopperLayout({ children }: { children: React.ReactNode }) {
  const brand = await currentBrand();

  return (
    <div className="sc" style={brandStyle(brand)}>
      <div className="sc-shell">
        {children}
        <QumoFooter />
      </div>
    </div>
  );
}
