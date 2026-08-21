import Link from "next/link";
import type { LedgerUnit } from "@prisma/client";
import { formatLedgerAmount } from "@/lib/consumer/wallet";
import { getBrandOverview } from "@/lib/console/overview";
import { requireStaff } from "@/lib/staff/current";

function Metric({ value, label, note, warn }: { value: string; label: string; note?: string; warn?: boolean }) {
  return (
    <div className="cn-metric">
      <div className="cn-metric-v">{value}</div>
      <div className="cn-metric-k">{label}</div>
      {note && <div className={`cn-metric-note${warn ? " cn-warn-note" : ""}`}>{note}</div>}
    </div>
  );
}

/** Cents, points and stamps do not add up, so they are never added up. */
function unitLine(rows: { unit: LedgerUnit; amount: number }[]): string {
  if (rows.length === 0) return "—";
  return rows.map((r) => formatLedgerAmount(r.amount, r.unit)).join(" · ");
}

export default async function ConsoleOverviewPage() {
  const session = await requireStaff();
  const o = await getBrandOverview(session.brandId);

  const cents = o.outstanding.find((r) => r.unit === "CENTS")?.amount ?? 0;
  const issuedCents = o.issued.find((r) => r.unit === "CENTS")?.amount ?? 0;
  const redeemed = issuedCents - cents;

  return (
    <>
      <h1 className="cn-h1">Overview</h1>

      <div className="cn-grid">
        {/* First, and the largest thing on the page, because it is the
            question a finance director asks and the one the plan recorded as
            having no answer. It is the sum of every ledger row, so a
            redemption nets it down the moment it happens and it can never
            disagree with the rows behind it. */}
        <Metric
          value={unitLine(o.outstanding)}
          label="Outstanding — owed to shoppers"
          note={redeemed > 0 ? `${formatLedgerAmount(redeemed, "CENTS")} already redeemed` : undefined}
        />
        <Metric value={unitLine(o.issued)} label="Issued in total" note="Before anything was spent" />
        <Metric
          value={o.members.toLocaleString("en-ZA")}
          label="Members"
          note={
            o.optedOut > 0
              ? `${o.optedOut.toLocaleString("en-ZA")} opted out`
              : `${o.newMembersLast7Days.toLocaleString("en-ZA")} joined this week`
          }
        />
        <Metric
          value={o.scansLast7Days.toLocaleString("en-ZA")}
          label="Slips scanned, last 7 days"
          note={`${o.activeCampaigns} active promotion${o.activeCampaigns === 1 ? "" : "s"}`}
        />
        <Metric
          value={o.stores.toLocaleString("en-ZA")}
          label="Stores"
          note={
            o.unsignedStores > 0
              ? `${o.unsignedStores} can't sign their slips`
              : "All signing their slips"
          }
          warn={o.unsignedStores > 0}
        />
      </div>

      {o.unsignedStores > 0 && (
        <section className="cn-panel">
          <div className="cn-panel-head">
            <h2 className="cn-h2">Unsigned stores are your exposure</h2>
            <span className="cn-pill cn-pill-warn">{o.unsignedStores} of {o.stores}</span>
          </div>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Said plainly rather than buried, because it is the one thing
                on this page a brand can act on and the one that costs them
                money if they don't. */}
            <p className="cn-body">
              A store whose point of sale can&apos;t sign a slip is a store where the shopper controls what the slip
              says. The per-person and per-campaign ceilings on your promotion bound what that can cost, but they
              don&apos;t stop it. Getting a signing secret into those tills is the fix.
            </p>
            <Link href="/stores" className="cn-btn cn-btn-quiet" style={{ alignSelf: "flex-start", textDecoration: "none" }}>
              See which stores
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
