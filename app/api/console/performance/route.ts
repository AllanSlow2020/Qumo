import type { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/staff/session";
import { formatLedgerAmount } from "@/lib/consumer/wallet";
import { getPerformance, isPeriod, type PeriodDays } from "@/lib/console/performance";

/**
 * The performance figures as a spreadsheet.
 *
 * "Can we get this in a spreadsheet" is the first thing anybody asks after
 * being shown a dashboard, and the honest reason is that a console is where
 * a number is read while a spreadsheet is where it is argued about. A
 * brand's finance team will not take a screenshot into a budget meeting.
 *
 * Under /api, which the proxy lets through without a session, so this does
 * its own check — and it is scoped through the same getPerformance every
 * screen uses, so an export can never contain a row the screen would not
 * show.
 *
 * Deliberately no role gate, unlike the pack-code export: that one hands
 * over every unredeemed code, each worth an award. This hands over
 * aggregates of a brand's own activity to that brand's own staff, and
 * there is no row in it a colleague should not see.
 */

/** One tidy long-format table rather than four wide ones stacked. */
type Row = [section: string, key: string, value: string];

function csvCell(value: string): string {
  // A store called "Sea Point, Main Rd" would otherwise become two columns.
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET(request: NextRequest): Promise<Response> {
  const staff = await getStaffSession();
  if (!staff) {
    return new Response("Not signed in", { status: 401 });
  }

  const raw = Number(request.nextUrl.searchParams.get("days"));
  const days: PeriodDays = isPeriod(raw) ? raw : 30;
  const p = await getPerformance(staff.brandId, days);

  const rows: Row[] = [
    ["window", "days", String(days)],
    ["window", "from", p.from.toISOString().slice(0, 10)],
    ["window", "to", new Date().toISOString().slice(0, 10)],
    ["totals", "slips scanned", String(p.slips)],
    ["totals", "pack codes redeemed", String(p.packCodes)],
    ["totals", "people who earned", String(p.membersReached)],
    ["totals", "people who joined", String(p.newMembers)],
    ["repeat", "earned once", String(p.repeat.once)],
    ["repeat", "earned 2-3 times", String(p.repeat.twice)],
    ["repeat", "earned 4 or more times", String(p.repeat.more)],
  ];

  for (const row of p.issued) rows.push(["issued in window", row.unit.toLowerCase(), formatLedgerAmount(row.amount, row.unit)]);
  for (const row of p.outstanding) rows.push(["outstanding, all time", row.unit.toLowerCase(), formatLedgerAmount(row.amount, row.unit)]);

  for (const day of p.scansByDay) rows.push(["slips per day", day.day.toISOString().slice(0, 10), String(day.count)]);

  for (const store of p.byStore) {
    rows.push(["store slips", `${store.name} (${store.code})`, String(store.scans)]);
    rows.push(["store signing", `${store.name} (${store.code})`, store.isSigned ? "signed" : "unsigned"]);
  }

  for (const c of p.byCampaign) {
    rows.push(["promotion issued", c.name, c.unit ? formatLedgerAmount(c.issued, c.unit) : "—"]);
    rows.push(["promotion people", c.name, String(c.members)]);
    rows.push([
      "promotion budget used",
      c.name,
      c.ceilingUsed === null ? "no ceiling" : `${Math.round(c.ceilingUsed * 100)}%`,
    ]);
  }

  const csv = ["section,item,value", ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="qumo-performance-${days}d-${stamp}.csv"`,
      "Cache-Control": "no-store, private",
    },
  });
}
