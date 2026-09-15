import { currentBrand } from "@/lib/brand/current";
import { prisma } from "@/lib/db/client";

/**
 * A brand's uploaded logo, served on the brand's own origin.
 *
 * No slug in the path: the brand is resolved from the Host header, the same
 * way every other shopper-facing route resolves it. That is not tidiness -
 * it means a request can only ever fetch the logo of the site it was made
 * from, so there is no identifier to tamper with and no way to enumerate
 * other brands' assets from a hostname that is not theirs.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const brand = await currentBrand();
  if (!brand) {
    return new Response("Not found", { status: 404 });
  }

  const row = await prisma.brand.findUnique({
    where: { id: brand.id },
    select: { logoData: true, logoMimeType: true, logoUpdatedAt: true },
  });

  if (!row?.logoData || !row.logoMimeType) {
    return new Response("Not found", { status: 404 });
  }

  const body = new Uint8Array(row.logoData);

  return new Response(body, {
    headers: {
      // The stored type, which was decided by reading the file's own bytes
      // on upload - never a value the uploader supplied.
      "Content-Type": row.logoMimeType,
      "Content-Length": String(body.byteLength),
      // The browser must not go looking for a better idea than the type we
      // gave it. Without this, a file that is almost-something-else can be
      // sniffed into being executed.
      "X-Content-Type-Options": "nosniff",
      // Immutable for a year, which is safe precisely because the URL
      // carries logoUpdatedAt: a new upload is a new URL, so nothing has to
      // be invalidated anywhere.
      "Cache-Control": "public, max-age=31536000, immutable",
      // Belt and braces for a response that is user-supplied bytes: even if
      // something got past the type check, this origin will not run it.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
