import { currentStaff } from "@/lib/staff/current";
import { prisma } from "@/lib/db/client";

/**
 * The signed-in brand's own logo, for the console to look at.
 *
 * The shopper copy of this lives at /api/brand-logo and resolves the brand
 * from the Host header. That is exactly why it cannot serve the console: the
 * console runs on app.{root}, which names no brand, so the shopper route
 * answers 404 there and the appearance screen would show a broken image of
 * the logo it is asking you to replace.
 *
 * So the brand comes from the staff session instead - the same rule the rest
 * of the console follows, and the same property that makes the shopper route
 * safe. There is no identifier in the URL, so there is nothing to tamper
 * with: this request can only ever return the logo of the brand the caller
 * is signed in to.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const staff = await currentStaff();
  if (!staff) {
    // 404 rather than 401. Whether a brand has uploaded a logo is not worth
    // telling a stranger, and this is an image tag - nothing on the far end
    // is going to act on a status code.
    return new Response("Not found", { status: 404 });
  }

  const row = await prisma.brand.findUnique({
    where: { id: staff.brandId },
    select: { logoData: true, logoMimeType: true },
  });

  if (!row?.logoData || !row.logoMimeType) {
    return new Response("Not found", { status: 404 });
  }

  const body = new Uint8Array(row.logoData);

  return new Response(body, {
    headers: {
      // The stored type, decided by reading the file's own bytes on upload -
      // never a value the uploader supplied.
      "Content-Type": row.logoMimeType,
      "Content-Length": String(body.byteLength),
      "X-Content-Type-Options": "nosniff",
      // Private, because this response depends on who is signed in. The
      // caller's own browser may hold it, keyed on the ?v= stamp the console
      // puts in the URL; no shared cache may.
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
