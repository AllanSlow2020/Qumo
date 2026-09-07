import { requireStaff } from "@/lib/staff/current";
import { describeAction, isNotable, listAuditEvents, PAGE_SIZE } from "@/lib/audit/read";

/**
 * The log, read by the people it watches.
 *
 * Deliberately visible to every role rather than owners only. A record that
 * only the person who can do the most damage is allowed to read is a
 * weaker record, and there is nothing here a colleague should not see: it
 * names actions, never secrets.
 *
 * There is no filter, no search and no export yet, and that is the right
 * amount for a first version - a brand's log is measured in tens of rows a
 * month, and the newest fifty answer almost every question anyone asks of
 * it. Paging exists so the fifty-first is reachable.
 */

function formatDetail(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const entries = Object.entries(detail as Record<string, unknown>).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  if (entries.length === 0) return null;

  return entries
    .map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, " $1").toLowerCase();
      const shown = Array.isArray(value) ? value.join(", ") : String(value);
      return `${label}: ${shown}`;
    })
    .join(" · ");
}

export default async function ConsoleActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const session = await requireStaff();
  const { before } = await searchParams;

  // A malformed cursor reads as "start from the top" rather than throwing.
  // It arrives from a URL, and a URL somebody edited is not an incident.
  const cursor = before ? new Date(before) : undefined;
  const from = cursor && !Number.isNaN(cursor.getTime()) ? cursor : undefined;

  const rows = await listAuditEvents(session.brandId, { before: from });
  const oldest = rows.at(-1);
  const hasMore = rows.length === PAGE_SIZE;

  return (
    <>
      <h1 className="cn-h1">Activity</h1>
      <p className="cn-body">
        Every change anyone on your team has made: promotions switched on, ceilings moved, store secrets rotated,
        access granted and taken away. Entries are written as the change happens and cannot be edited or deleted by
        anyone, including us.
      </p>

      {rows.length === 0 ? (
        <section className="cn-panel">
          <div style={{ padding: "18px 16px" }}>
            <p className="cn-body">
              {from
                ? "Nothing older than this."
                : "Nothing recorded yet. The next change anyone makes will show up here."}
            </p>
          </div>
        </section>
      ) : (
        <section className="cn-panel">
          <table className="cn-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">What</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const detail = formatDetail(row.detail);
                return (
                  <tr key={row.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <time dateTime={row.createdAt.toISOString()}>
                        {row.createdAt.toLocaleString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </td>
                    <td>
                      {row.actorName}
                      {row.actorEmail && (
                        <div className="cn-sub">
                          {row.actorEmail}
                        </div>
                      )}
                    </td>
                    <td>
                      <span>{describeAction(row.action)}</span>
                      {isNotable(row.action) && (
                        <span className="cn-pill cn-pill-warn" style={{ marginLeft: 8 }}>
                          Notable
                        </span>
                      )}
                      {row.targetLabel && (
                        <div className="cn-sub">
                          {row.targetLabel}
                        </div>
                      )}
                      {detail && (
                        <div className="cn-sub">
                          {detail}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {hasMore && oldest && (
        <p className="cn-body">
          <a href={`/activity?before=${encodeURIComponent(oldest.createdAt.toISOString())}`}>Older entries</a>
        </p>
      )}
      {from && (
        <p className="cn-body">
          <a href="/activity">Back to the newest</a>
        </p>
      )}
    </>
  );
}
