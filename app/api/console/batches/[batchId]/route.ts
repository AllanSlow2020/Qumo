import { prisma } from "@/lib/db/client";
import { ROOT_DOMAIN } from "@/lib/brand/host";
import { getStaffSession } from "@/lib/staff/session";
import { exportBatchCodes, toCsv } from "@/lib/packs/export";

/**
 * Downloads one print run as CSV.
 *
 * Under /api, which the proxy deliberately lets through without a session
 * check — so this handler does its own, and it is not optional. It returns
 * every code in a batch, which is the whole print run.
 *
 * Two checks, not one: the staff session says who is asking, and
 * exportBatchCodes is scoped to their brand, so a batchId from another
 * brand's console is not found rather than served.
 */
export async function GET(req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const staff = await getStaffSession();
  if (!staff) {
    return new Response("Not signed in", { status: 401 });
  }

  const { batchId } = await params;
  const data = await exportBatchCodes(staff.brandId, batchId);
  if (!data) {
    return new Response("Not found", { status: 404 });
  }

  const brand = await prisma.brand.findUnique({ where: { id: staff.brandId }, select: { slug: true } });
  // The brand's own host, not the console's: a code scanned at app.qumo… or
  // at the apex lands on a page that names no brand.
  const proto = req.headers.get("x-forwarded-proto") ?? (ROOT_DOMAIN === "localhost" ? "http" : "https");
  const port = ROOT_DOMAIN === "localhost" ? ":3000" : "";
  const origin = `${proto}://${brand?.slug}.${ROOT_DOMAIN}${port}`;

  const safeLabel = data.label.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60) || "batch";

  return new Response(toCsv(data, origin), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="qumo-codes-${safeLabel}.csv"`,
      // Never cached, never stored by an intermediary. A print run is not
      // secret, but it is also not something to leave in a shared proxy.
      "Cache-Control": "no-store, private",
    },
  });
}
