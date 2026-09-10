import { prisma } from "@/lib/db/client";
import { brandOrigin } from "@/lib/brand/host";
import { getStaffSession } from "@/lib/staff/session";
import { requireRole, ForbiddenError } from "@/lib/auth/rbac";
import { MANAGE_PACK_BATCH_ROLES } from "@/lib/packs/batch";
import { exportBatchCodes, toCsv } from "@/lib/packs/export";

/**
 * Downloads one print run as CSV.
 *
 * Under /api, which the proxy deliberately lets through without a session
 * check - so this handler does its own, and it is not optional. It returns
 * every code in a batch, which is the whole print run.
 *
 * Three checks, not one. The staff session says who is asking;
 * exportBatchCodes is scoped to their brand, so a batchId from another
 * brand's console is not found rather than served; and the role is the same
 * one required to create a batch.
 *
 * That third check was missing, and the comment that used to justify its
 * absence was wrong: "codes are not secret - they end up printed on the
 * outside of a box." True of a printed code, which costs a purchase to
 * obtain. Not true of the file: a batch that has not been printed yet is
 * every unredeemed code in one download, each one worth an award, and QUALITY
 * - the one role deliberately barred from creating a batch - could take the
 * lot.
 */
export async function GET(req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const staff = await getStaffSession();
  if (!staff) {
    return new Response("Not signed in", { status: 401 });
  }

  try {
    requireRole(staff.role, MANAGE_PACK_BATCH_ROLES);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return new Response("Not allowed", { status: 403 });
    }
    throw err;
  }

  const { batchId } = await params;
  const data = await exportBatchCodes(staff.brandId, batchId);
  if (!data) {
    return new Response("Not found", { status: 404 });
  }

  const brand = await prisma.brand.findUnique({ where: { id: staff.brandId }, select: { slug: true } });
  if (!brand) {
    return new Response("Not found", { status: 404 });
  }
  const origin = brandOrigin(brand.slug, req.headers.get("x-forwarded-proto"));

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
