import { prisma } from "@/lib/db/client";
import { brandOrigin } from "@/lib/brand/host";
import { posterQrSvg } from "@/lib/brand/poster";
import { getStaffSession } from "@/lib/staff/session";

/**
 * Downloads the brand's poster QR as vector artwork.
 *
 * Signed in, and no role check. That is a deliberate difference from the
 * pack-code download next door, which takes the same role as creating a
 * batch because it hands over live codes worth real money. This hands over
 * a public address that awards nothing and is meant to be printed where
 * anybody can scan it, so a role gate here would stop a colleague doing
 * their job while protecting nothing. See lib/brand/poster.ts.
 *
 * The session still matters: it is what says *which brand*, and a route
 * that took a slug from the caller would happily generate Campari's poster
 * for a Chicken Licken login.
 */
export async function GET(req: Request): Promise<Response> {
  const staff = await getStaffSession();
  if (!staff) {
    return new Response("Not signed in", { status: 401 });
  }

  const brand = await prisma.brand.findUnique({
    where: { id: staff.brandId },
    select: { slug: true },
  });
  if (!brand) {
    return new Response("Not found", { status: 404 });
  }

  const origin = brandOrigin(brand.slug, req.headers.get("x-forwarded-proto"));
  const svg = await posterQrSvg(origin);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Named after the brand, because this file lands in a folder next to
      // artwork for three other things and "qrcode.svg" helps nobody.
      "Content-Disposition": `attachment; filename="qumo-poster-${brand.slug}.svg"`,
      "Cache-Control": "no-store, private",
    },
  });
}
