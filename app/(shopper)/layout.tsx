import type { Metadata } from "next";
import { currentBrand } from "@/lib/brand/current";
import { brandStyle, brandTitle } from "@/lib/brand/theme";
import { NoBrandNotice } from "./no-brand-notice";
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
 * ── Why this branches on a missing brand ─────────────────────────────────
 *
 * It used to say that a request whose host names no brand never reaches a
 * page under here, because the proxy rewrites it to /no-brand first. That
 * is true of the apex and of a reserved subdomain, and false of the case
 * that matters: a host whose slug is perfectly well formed and matches no
 * row. The proxy cannot tell, because it runs in the Edge runtime and
 * deciding needs a database read.
 *
 * So those requests arrived here, every page below called requireBrand(),
 * and the shopper got a server error. That is the state a deployment is in
 * between its first successful build and its first brand being created,
 * which is to say the first thing anybody sees.
 */

export async function generateMetadata(): Promise<Metadata> {
  const brand = await currentBrand();
  return {
    // The title in a shared tab list, and in the link preview when a shopper
    // sends the page to somebody. It has to name the brand for the same
    // reason the header does.
    title: brandTitle(brand),
    description: brand ? `${brand.name} rewards.` : "Rewards programmes, run for brands.",
    /*
     * The brand's own mark in the tab, where they have given us one.
     *
     * app/icon.svg puts a Qumo Q on every page in the application, which is
     * right for the console and wrong here: this surface wears the brand,
     * and the whole argument for it is that a shopper is dealing with
     * Copper Kettle rather than with an infrastructure vendor they have
     * never heard of. A Qumo glyph in the tab is a small contradiction of
     * the one thing this surface is for.
     *
     * Declared only when a brand has a logo. Returning undefined leaves the
     * file-based icon in place, which is the honest fallback: a brand that
     * has not given us a mark has not given us one to show, and Qumo's is
     * better than an empty square.
     *
     * No size or type is asserted. The logo is whatever the brand uploaded
     * at whatever aspect ratio, served from their own address, and claiming
     * it is a 32x32 PNG when it might be a wide SVG would be a worse answer
     * than letting the browser work it out.
     */
    ...(brand?.logoUrl ? { icons: { icon: brand.logoUrl, apple: brand.logoUrl } } : {}),
  };
}

export default async function ShopperLayout({ children }: { children: React.ReactNode }) {
  const brand = await currentBrand();

  return (
    <div className="sc" style={brandStyle(brand)}>
      <div className="sc-shell">
        {/*
          Rendered instead of the children, not alongside a redirect: the
          address the shopper typed is the thing they need to look at, and
          sending them somewhere else takes it out of the bar. Same reason
          the proxy rewrites rather than redirects.
        */}
        {brand ? children : <NoBrandNotice />}
        <QumoFooter />
      </div>
    </div>
  );
}
