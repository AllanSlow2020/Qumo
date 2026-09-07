import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/product";
import "./console.css";

/**
 * The console's outer shell — stylesheet and ground, nothing else.
 *
 * No session check here, deliberately: the login page lives under this
 * layout and cannot require the thing it exists to obtain. The check is one
 * level down, in the (authed) group, so every page except login inherits it
 * and no future page can be added that forgets it.
 */
export const metadata: Metadata = {
  title: `Console · ${PRODUCT_NAME}`,
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <div className="cn">{children}</div>;
}
