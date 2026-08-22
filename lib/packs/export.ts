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
 * Codes are not secret in the way a signing secret is — they end up printed
 * on the outside of a box — so unlike a signing secret this is downloadable
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

  // Scoped, so a batchId belonging to another brand is simply not found —
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
 * Three columns and no cleverness. The URL is the whole point — a printer
 * generates the QR from it — and it carries the brand's own host, because a
 * code scanned at the apex would land on the no-brand page.
 *
 * The formatted code is included beside the canonical one so a shopper with
 * a damaged label can read it out in groups, which is what
 * lib/packs/code.ts's formatting exists for.
 */
export function toCsv(data: BatchExport, origin: string): string {
  const lines = ["code,printed_as,url,status"];
  for (const row of data.rows) {
    // No field here can contain a comma or a quote — codes come from a
    // fixed alphabet and status is an enum — so this needs no escaping and
    // deliberately does not pretend to be a general CSV writer.
    lines.push([row.code, formatPackCode(row.code), `${origin}/s/${row.code}`, row.status].join(","));
  }
  return lines.join("\n");
}
