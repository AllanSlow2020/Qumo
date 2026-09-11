import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Role } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/client";
import { brandOrigin } from "@/lib/brand/host";
import { labelSheet, LABELS_PER_SHEET } from "@/lib/packs/export";
import { MANAGE_PACK_BATCH_ROLES } from "@/lib/packs/batch";
import { requireStaff } from "@/lib/staff/current";

export const metadata: Metadata = { title: "Labels" };

/**
 * The missing step between "we generated fifty thousand codes" and a code on
 * a bottle.
 *
 * Until now a print run left as a CSV, which is right for a print vendor
 * whose artwork pipeline reads one, and useless to everybody else. Nobody
 * can scan a spreadsheet. A brand printing a few hundred gift-pack inserts
 * themselves, anybody who wants a sample before committing to a full run,
 * and anybody demonstrating the product all need the same thing: the codes
 * as something you can hold up to a phone.
 *
 * ── Why a page and not a PDF ─────────────────────────────────────────────
 *
 * A PDF would mean a rendering library, a font pipeline and a new class of
 * bug, to arrive at what the browser's own print dialogue already produces
 * from HTML - including "save as PDF". The print stylesheet is the feature.
 *
 * ── Guarded like the CSV, because it is the same secret ──────────────────
 *
 * A batch that has not been printed is every unredeemed code in the run,
 * each one worth an award. The CSV route learned this the hard way: it
 * checked the session and the tenant and not the role, so QUALITY - the one
 * role deliberately barred from making a batch - could take the lot. This
 * hands out the same codes in a prettier shape, so it takes the same role.
 */
export default async function LabelSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const staff = await requireStaff();
  if (!MANAGE_PACK_BATCH_ROLES.includes(staff.role as Role)) {
    // notFound rather than a "not allowed" screen. A reader who cannot have
    // the codes also has no business learning that this batch id exists.
    notFound();
  }

  const [{ batchId }, query] = await Promise.all([params, searchParams]);

  const brand = await prisma.brand.findUnique({
    where: { id: staff.brandId },
    select: { slug: true, name: true },
  });
  if (!brand) notFound();

  const requestHeaders = await headers();
  const origin = brandOrigin(brand.slug, requestHeaders.get("x-forwarded-proto"));

  const sheet = await labelSheet(staff.brandId, batchId, origin, Number(query.page ?? 1));
  if (!sheet) notFound();

  const first = (sheet.page - 1) * LABELS_PER_SHEET + 1;
  const last = first + sheet.labels.length - 1;

  return (
    <>
      {/* cn-noprint on everything that is screen furniture. What survives the
          print dialogue is the grid and nothing else - a header, a nav and a
          pager on a sheet of stickers is wasted ink and a wasted label. */}
      <div className="cn-noprint">
        <h1 className="cn-h1">{sheet.label}</h1>
        <p className="cn-body">
          {sheet.campaignName}. Codes {first.toLocaleString("en-ZA")} to {last.toLocaleString("en-ZA")} of{" "}
          {sheet.total.toLocaleString("en-ZA")}, {LABELS_PER_SHEET} to a page.
        </p>
        <p className="cn-label">
          Print this, or save it as a PDF from the print dialogue. A full run goes to your printer as the CSV
          instead. This is for a short run, a sample, or checking one scans before you commit to the lot.
        </p>

        <div className="cn-actions">
          {sheet.page > 1 && (
            <Link className="cn-btn cn-btn-quiet" href={`?page=${sheet.page - 1}`}>
              Previous page
            </Link>
          )}
          {sheet.page < sheet.pageCount && (
            <Link className="cn-btn cn-btn-quiet" href={`?page=${sheet.page + 1}`}>
              Next page
            </Link>
          )}
          <Link className="cn-btn cn-btn-quiet" href="/codes">
            Back to pack codes
          </Link>
        </div>
      </div>

      <div className="cn-sheet">
        {sheet.labels.map((label) => (
          <div className="cn-label-cell" key={label.code}>
            {/* Server-rendered SVG, so there is no client bundle here at all
                and the print dialogue has nothing to wait for. */}
            <div className="cn-label-qr" dangerouslySetInnerHTML={{ __html: label.qr }} />
            <span className="cn-label-code">{label.printedAs}</span>
          </div>
        ))}
      </div>

      <p className="cn-noprint cn-label">
        Each code scans to {origin}/s/… and works exactly once. The readable code under the QR is not decoration:
        it is what a shopper reads out when the label is scuffed, and what they text in when they have no data.
      </p>
    </>
  );
}
