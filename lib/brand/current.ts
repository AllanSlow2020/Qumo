import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/client";
import { BRAND_HEADER } from "./host";
import { toBrandTheme, type BrandTheme } from "./theme";

/**
 * The brand this request is addressed to, on the Node side.
 *
 * Reads the header the proxy set from the Host header, then loads the row.
 * Nothing here parses a hostname: doing it in two places is how the two
 * places end up disagreeing, and the proxy's copy is the one that has
 * already stripped a client-supplied header.
 *
 * `cache()` scopes memoisation to the request, so a layout, a page and three
 * components asking for the brand cost one query. Not a module-level cache -
 * that would outlive the request and serve one brand's identity to the next
 * shopper.
 */

const SELECT = {
  id: true,
  slug: true,
  name: true,
  displayName: true,
  tagline: true,
  logoUrl: true,
  accentColor: true,
  accentInkColor: true,
  displayFont: true,
  figureFont: true,
  supportEmail: true,
  supportUrl: true,
} as const;

/**
 * Null when the host names no brand (the apex, a reserved subdomain) and
 * also when it names one that does not exist. The two are deliberately not
 * distinguished to a caller: a slug that resolves to nothing is a host
 * pointed at us by mistake or by somebody probing for brand names, and
 * neither deserves a different answer.
 */
export const currentBrand = cache(async (): Promise<BrandTheme | null> => {
  const slug = (await headers()).get(BRAND_HEADER);
  if (!slug) return null;

  const brand = await prisma.brand.findUnique({ where: { slug }, select: SELECT });
  return brand ? toBrandTheme(brand) : null;
});

/**
 * For the pages that cannot mean anything without a brand - a wallet, a
 * scan, an opt-out. Throwing is right here: every one of these routes is
 * reached from a link or a code that carried a brand host, so arriving
 * without one is a routing bug, not a shopper mistake.
 *
 * app/(shopper)/layout.tsx renders the no-brand notice rather than its
 * children when there is no brand, so in practice this never throws on a
 * shopper page. It said that before the layout actually did it, and the
 * gap was a server error on every page of a deployment whose first brand
 * had not been created yet.
 */
export async function requireBrand(): Promise<BrandTheme> {
  const brand = await currentBrand();
  if (!brand) {
    throw new Error("This route requires a brand host and the request did not carry one");
  }
  return brand;
}
