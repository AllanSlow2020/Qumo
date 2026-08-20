import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/product";
import "./shopper.css";

/**
 * The shopper shell. Mobile-first because it is reached almost exclusively
 * by scanning something with a phone — the narrow column is the design, not
 * a small-screen concession.
 *
 * Everything below lives under `.sc`, which is where the shopper surface's
 * own tokens are defined (shopper.css). The staff portal keeps its own
 * identity untouched; restyling one can never reach the other.
 */

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "Your rewards, in one place.",
};

export default function ShopperLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sc">
      <div className="sc-shell">{children}</div>
    </div>
  );
}
