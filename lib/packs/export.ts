import QRCode from "qrcode";
import { forBrand } from "@/lib/db/tenant";
import { formatPackCode } from "./code";

/**
 * Getting a print run out of the database and to whoever prints it.
 *
 * The missing half of pack codes: generating a batch put rows in a table
 * that nothing could read back, so a brand could order 50,000 stickers and
 * have no way to send them anywhere. A print vendor needs the code and the
 * URL it resolves to, and that is what this produces.
 *
 * Codes are not secret in the way a signing secret is - they end up printed
 * on the outside of a box - so unlike a signing secret this is downloadable
 * as often as a brand wants. What makes a code worth anything is that it is
 * single-use, not that it is confidential.
 */

export type BatchExport = {
  label: string;
  campaignName: string;
  quantity: number;
  rows: { code: string; status: string }[];
};

export async function exportBatchCodes(brandId: string, batchId: string): Promise<BatchExport | null> {
  const scoped = forBrand(brandId);

  // Scoped, so a batchId belonging to another brand is simply not found -
  // this route hands out every code in a print run, and it is exactly the
  // sort of thing an id in a URL should not be able to reach across.
  const batch = await scoped.packBatch.findFirst({
    where: { id: batchId },
    include: { campaign: { select: { name: true } } },
  });
  if (!batch) return null;

  const codes = await scoped.packCode.findMany({
    where: { batchId: batch.id },
    select: { code: true, status: true },
    orderBy: { code: "asc" },
  });

  return {
    label: batch.label,
    campaignName: batch.campaign.name,
    quantity: batch.quantity,
    rows: codes,
  };
}

/**
 * CSV, because it is what a print vendor's artwork pipeline actually reads.
 *
 * Three columns and no cleverness. The URL is the whole point - a printer
 * generates the QR from it - and it carries the brand's own host, because a
 * code scanned at the apex would land on the no-brand page.
 *
 * The formatted code is included beside the canonical one so a shopper with
 * a damaged label can read it out in groups, which is what
 * lib/packs/code.ts's formatting exists for.
 */
export function toCsv(data: BatchExport, origin: string): string {
  const lines = ["code,printed_as,url,status"];
  for (const row of data.rows) {
    // No field here can contain a comma or a quote - codes come from a
    // fixed alphabet and status is an enum - so this needs no escaping and
    // deliberately does not pretend to be a general CSV writer.
    lines.push([row.code, formatPackCode(row.code), `${origin}/s/${row.code}`, row.status].join(","));
  }
  return lines.join("\n");
}

/** One label as it will be printed: what to scan, and what to read if it will not. */
export type PackLabel = {
  code: string;
  /** Hyphenated, for the line under the QR. */
  printedAs: string;
  url: string;
  /** Inline SVG. Rendered here rather than in the page so the page stays a page. */
  qr: string;
};

export type LabelSheet = {
  label: string;
  campaignName: string;
  /** Codes in the whole run, which is usually far more than one sheet. */
  total: number;
  page: number;
  pageCount: number;
  labels: PackLabel[];
};

/**
 * A sheet of labels is a page at a time, and the page size is a physical
 * fact rather than a preference: 24 fits an A4 at a QR size that survives
 * being printed small and scanned off a curved bottle.
 */
export const LABELS_PER_SHEET = 24;

/**
 * The codes for one printable sheet, with their QR already rendered.
 *
 * Paged rather than whole, and the reason is worth stating so nobody
 * "fixes" it later: a run is routinely tens of thousands of codes, and a
 * single page carrying that many inline SVGs is not a slow page, it is a
 * browser that stops responding. A real print run leaves as CSV and the
 * vendor generates the artwork. This is for the short run somebody prints
 * themselves, the sample before committing to fifty thousand, and the demo.
 */
export async function labelSheet(
  brandId: string,
  batchId: string,
  origin: string,
  page = 1,
): Promise<LabelSheet | null> {
  const scoped = forBrand(brandId);

  // Scoped for the same reason exportBatchCodes is: this hands out live
  // codes, and an id in a URL must not reach across a tenant boundary.
  const batch = await scoped.packBatch.findFirst({
    where: { id: batchId },
    include: { campaign: { select: { name: true } } },
  });
  if (!batch) return null;

  const total = await scoped.packCode.count({ where: { batchId: batch.id } });
  const pageCount = Math.max(1, Math.ceil(total / LABELS_PER_SHEET));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);

  const codes = await scoped.packCode.findMany({
    where: { batchId: batch.id },
    select: { code: true },
    orderBy: { code: "asc" },
    skip: (current - 1) * LABELS_PER_SHEET,
    take: LABELS_PER_SHEET,
  });

  const labels = await Promise.all(
    codes.map(async ({ code }) => {
      const url = `${origin}/s/${code}`;
      return {
        code,
        printedAs: formatPackCode(code),
        url,
        // Error correction M, not H. H survives more damage and costs
        // modules, and modules on a neck tag are the scarce thing - the
        // same trade lib/stores/payload.ts makes when it truncates a
        // signature to keep a receipt QR readable off thermal paper.
        qr: await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" }),
      };
    }),
  );

  return { label: batch.label, campaignName: batch.campaign.name, total, page: current, pageCount, labels };
}
