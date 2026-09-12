import Link from "next/link";
import type { Role } from "@prisma/client";
import { listCampaignsForConsole } from "@/lib/campaigns/manage";
import { listPackBatches, MANAGE_PACK_BATCH_ROLES } from "@/lib/packs/batch";
import { requireStaff } from "@/lib/staff/current";
import { NewBatchForm } from "./new-batch-form";

export default async function ConsoleCodesPage() {
  const session = await requireStaff();
  const [batches, campaigns] = await Promise.all([
    listPackBatches(session.brandId),
    listCampaignsForConsole(session.brandId),
  ]);

  const canManage = MANAGE_PACK_BATCH_ROLES.includes(session.role as Role);

  return (
    <>
      <h1 className="cn-h1">Pack codes</h1>
      <p className="cn-body">
        Unique codes to print on packs, neck tags and stickers. Unlike a poster, each one is single-use, which is
        what lets it be worth something.
      </p>

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">
            {batches.length} print run{batches.length === 1 ? "" : "s"}
          </h2>
        </div>
        {batches.length === 0 ? (
          <p className="cn-empty">Nothing generated yet.</p>
        ) : (
          <div className="cn-scroll">
            <table className="cn-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Promotion</th>
                  <th className="cn-num">Codes</th>
                  <th className="cn-num">Scanned</th>
                  <th>Generated</th>
                  <th>Print run</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{batch.label}</td>
                    <td>{batch.campaignName}</td>
                    <td className="cn-num">{batch.quantity.toLocaleString("en-ZA")}</td>
                    <td className="cn-num">
                      {batch.scanned.toLocaleString("en-ZA")}
                      <div className="cn-label">
                        {batch.quantity > 0 ? Math.round((batch.scanned / batch.quantity) * 100) : 0}%
                      </div>
                    </td>
                    <td className="cn-label">
                      {batch.createdAt.toLocaleDateString("en-ZA", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      {/* Both links are hidden from a role that cannot have
                          the codes, rather than shown and then refused. The
                          routes behind them check the role themselves and are
                          what actually enforces it - this only stops the
                          console offering somebody a door that will not
                          open. */}
                      {canManage && (
                        <div className="cn-actions">
                          {/* A plain link, not a button: it is a file
                              download, and the browser already does that
                              well. */}
                          <a href={`/api/console/batches/${batch.id}`} className="cn-btn cn-btn-quiet" download>
                            CSV
                          </a>
                          {/* The same codes as something you can scan. What
                              a vendor needs is the CSV; what everybody else
                              needs is this. */}
                          <Link href={`/codes/${batch.id}/sheet`} className="cn-btn cn-btn-quiet">
                            Labels
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canManage ? (
        <section className="cn-panel">
          <div className="cn-panel-head">
            <h2 className="cn-h2">New print run</h2>
          </div>
          <NewBatchForm
            campaigns={campaigns.map((c) => ({
              id: c.id,
              name: c.name,
              canPrint: c.rule !== null && c.rule.type === "FLAT_PER_SCAN",
              status: c.status,
            }))}
          />
        </section>
      ) : (
        <p className="cn-label">Generating codes needs an owner, admin or marketing role.</p>
      )}

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">What to send your printer</h2>
        </div>
        <div className="cn-panel-body">
          <p className="cn-body">
            The CSV has four columns: the code, how it should be printed for anyone reading it out, the URL to turn
            into a QR, and whether it has been scanned yet.
          </p>
          <p className="cn-body">
            The URL already carries your own address, so a shopper who scans it lands on your page rather than
            ours. Print the QR and the readable code together. A scuffed label still works if somebody can type it.
          </p>
        </div>
      </section>
    </>
  );
}
