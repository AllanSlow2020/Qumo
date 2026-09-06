import Link from "next/link";
import { formatLedgerAmount } from "@/lib/consumer/wallet";
import { requireStaff } from "@/lib/staff/current";
import {
  costPerMemberCents,
  getPerformance,
  isPeriod,
  PERIODS,
  repeatRate,
  type CampaignRow,
  type PeriodDays,
  type Performance,
  type StoreRow,
  type UnitAmount,
} from "@/lib/console/performance";

/**
 * "Is this working?"
 *
 * The overview answers "what is happening". This answers the harder
 * question, and it is arranged so the answer is the first thing on the
 * page: repeat rate and cost per member reached, then the evidence.
 */

function unitLine(rows: UnitAmount[]): string {
  if (rows.length === 0) return "—";
  return rows.map((r) => formatLedgerAmount(r.amount, r.unit)).join(" · ");
}

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

/**
 * The scan chart, drawn against the busiest day.
 *
 * Relative rather than absolute, because the question is which way it is
 * going. Only every seventh label is drawn on the longer windows — ninety
 * dates on one axis is not a chart, it is a wall.
 */
function ScanChart({ series, days }: { series: { day: Date; count: number }[]; days: PeriodDays }) {
  const peak = Math.max(...series.map((d) => d.count), 0);
  if (peak === 0) {
    return <p className="cn-body">Nothing scanned in this window.</p>;
  }

  const labelEvery = days <= 7 ? 1 : days <= 30 ? 5 : 15;

  return (
    <div className="cn-chart cn-chart-tall">
      {series.map((d, i) => (
        <div key={d.day.toISOString()}>
          <i
            className={i === series.length - 1 ? "cn-chart-now" : undefined}
            style={{ height: `${Math.max(Math.round((d.count / peak) * 100), 2)}%` }}
            title={`${d.count} on ${d.day.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`}
          />
          <em>{i % labelEvery === 0 ? d.day.toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : " "}</em>
        </div>
      ))}
    </div>
  );
}

/**
 * The repeat distribution as one bar.
 *
 * Three segments rather than three numbers, because the shape is the
 * finding: a bar that is nearly all "once" is a discount, not a loyalty
 * programme, and that reads in a second where three percentages do not.
 */
function RepeatBar({ repeat }: { repeat: Performance["repeat"] }) {
  const total = repeat.once + repeat.twice + repeat.more;
  if (total === 0) return <p className="cn-body">Nobody has earned in this window yet.</p>;

  const parts = [
    { key: "once", label: "Once", value: repeat.once, className: "cn-seg-once" },
    { key: "twice", label: "2–3 times", value: repeat.twice, className: "cn-seg-twice" },
    { key: "more", label: "4 or more", value: repeat.more, className: "cn-seg-more" },
  ];

  return (
    <>
      <div className="cn-stack" role="img" aria-label={`${repeat.once} once, ${repeat.twice} two to three times, ${repeat.more} four or more`}>
        {parts.map((p) =>
          p.value === 0 ? null : (
            <span key={p.key} className={p.className} style={{ flex: p.value }} />
          ),
        )}
      </div>
      <div className="cn-legend">
        {parts.map((p) => (
          <span key={p.key}>
            <i className={p.className} />
            {p.label} <b className="cn-num">{p.value.toLocaleString("en-ZA")}</b>
          </span>
        ))}
      </div>
    </>
  );
}

function StoreTable({ rows }: { rows: StoreRow[] }) {
  if (rows.length === 0) return <p className="cn-body">No stores yet.</p>;

  const busiest = rows[0]?.scans ?? 0;

  return (
    <table className="cn-table">
      <thead>
        <tr>
          <th scope="col">Store</th>
          <th scope="col">Signing</th>
          <th scope="col" className="cn-num">Slips</th>
          <th scope="col">Share</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.id}>
            <td>
              {s.name}
              <div className="cn-sub cn-mono">{s.code}</div>
            </td>
            <td>
              {s.isSigned ? (
                <span className="cn-pill cn-pill-ok">Signed</span>
              ) : (
                <span className="cn-pill cn-pill-warn">Unsigned</span>
              )}
            </td>
            <td className="cn-num">{s.scans.toLocaleString("en-ZA")}</td>
            <td>
              {/* A bar rather than a percentage: the question is whether the
                  programme is running everywhere or in three stores, and a
                  column of bars answers that without being read. */}
              <div className="cn-bar">
                <span style={{ width: `${busiest === 0 ? 0 : (s.scans / busiest) * 100}%` }} />
              </div>
              <div className="cn-sub cn-mono">{percent(s.share)}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CampaignTable({ rows }: { rows: CampaignRow[] }) {
  if (rows.length === 0) return <p className="cn-body">No promotions yet.</p>;

  return (
    <table className="cn-table">
      <thead>
        <tr>
          <th scope="col">Promotion</th>
          <th scope="col" className="cn-num">Issued</th>
          <th scope="col" className="cn-num">People</th>
          <th scope="col">Budget used</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id}>
            <td>
              {c.name}
              <div className="cn-sub">{c.status.toLowerCase()}</div>
            </td>
            <td className="cn-num">{c.unit ? formatLedgerAmount(c.issued, c.unit) : "—"}</td>
            <td className="cn-num">{c.members.toLocaleString("en-ZA")}</td>
            <td>
              {c.ceilingUsed === null ? (
                /* Not blank and not zero: somebody decided not to set one,
                   and that decision is the most consequential thing on
                   this row. */
                <span className="cn-unset">No ceiling</span>
              ) : (
                <>
                  <div className="cn-bar">
                    {/* The bar is clamped because a bar cannot be longer
                        than its track; the figure under it is not, because
                        180% and 100% are different facts. */}
                    <span
                      className={c.ceilingUsed > 0.8 ? "cn-bar-warn" : undefined}
                      style={{ width: `${Math.min(c.ceilingUsed, 1) * 100}%` }}
                    />
                  </div>
                  <div className={`cn-sub cn-mono${c.ceilingUsed > 1 ? " cn-warn-note" : ""}`}>
                    {percent(c.ceilingUsed)}
                    {c.ceilingUsed > 1 && " — over budget"}
                  </div>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function ConsolePerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await requireStaff();
  const { days: raw } = await searchParams;
  // A window off the end of a URL is not an error worth a page for.
  const days: PeriodDays = isPeriod(Number(raw)) ? (Number(raw) as PeriodDays) : 30;

  const p = await getPerformance(session.brandId, days);
  const perMember = costPerMemberCents(p);
  const rate = repeatRate(p);

  return (
    <>
      <div className="cn-head-row">
        <h1 className="cn-h1">Performance</h1>
        <nav className="cn-seg" aria-label="Period">
          {PERIODS.map((n) => (
            <Link key={n} href={`/performance?days=${n}`} aria-current={n === days ? "true" : undefined}>
              {n} days
            </Link>
          ))}
        </nav>
      </div>

      <p className="cn-body">
        Everything below covers the last {days} days, except what you still owe, which is all of it.
      </p>

      {/* The two numbers that decide whether this is working, first and
          largest. Everything under them is the evidence. */}
      <div className="cn-grid cn-grid-2">
        <div className="cn-metric">
          <div className="cn-metric-v">{percent(rate)}</div>
          <div className="cn-metric-k">Came back</div>
          <div className="cn-metric-note">
            {rate === null
              ? "Nobody has earned yet"
              : `${(p.repeat.twice + p.repeat.more).toLocaleString("en-ZA")} of ${p.membersReached.toLocaleString("en-ZA")} people earned more than once`}
          </div>
          <RepeatBar repeat={p.repeat} />
        </div>

        <div className="cn-metric">
          <div className="cn-metric-v">{perMember === null ? "—" : formatLedgerAmount(perMember, "CENTS")}</div>
          <div className="cn-metric-k">Cost per person reached</div>
          <div className="cn-metric-note">
            {perMember === null
              ? "Nobody reached in this window"
              : `${unitLine(p.issued)} issued to ${p.membersReached.toLocaleString("en-ZA")} people`}
          </div>
        </div>
      </div>

      <div className="cn-grid">
        <div className="cn-metric">
          <div className="cn-metric-v">{unitLine(p.outstanding)}</div>
          <div className="cn-metric-k">Still owed to shoppers</div>
          <div className="cn-metric-note">All time, not this window</div>
        </div>
        <div className="cn-metric">
          <div className="cn-metric-v">{p.slips.toLocaleString("en-ZA")}</div>
          <div className="cn-metric-k">Slips scanned</div>
          <div className="cn-metric-note">
            {p.packCodes > 0 ? `${p.packCodes.toLocaleString("en-ZA")} pack codes as well` : "No pack codes yet"}
          </div>
        </div>
        <div className="cn-metric">
          <div className="cn-metric-v">{p.membersReached.toLocaleString("en-ZA")}</div>
          <div className="cn-metric-k">People who earned</div>
          <div className="cn-metric-note">{p.newMembers.toLocaleString("en-ZA")} joined in this window</div>
        </div>
      </div>

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">Slips scanned</h2>
        </div>
        <div style={{ padding: "18px 16px 12px" }}>
          <ScanChart series={p.scansByDay} days={days} />
        </div>
      </section>

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">Where it is running</h2>
          <span className="cn-metric-note">Busiest first</span>
        </div>
        <div className="cn-scroll">
          <StoreTable rows={p.byStore} />
        </div>
      </section>

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">By promotion</h2>
        </div>
        <div className="cn-scroll">
          <CampaignTable rows={p.byCampaign} />
        </div>
      </section>
    </>
  );
}
