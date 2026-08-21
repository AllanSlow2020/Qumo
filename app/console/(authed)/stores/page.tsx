import { listStores } from "@/lib/stores/manage";
import { requireStaff } from "@/lib/staff/current";

export default async function ConsoleStoresPage() {
  const session = await requireStaff();
  const stores = await listStores(session.brandId);

  return (
    <>
      <h1 className="cn-h1">Stores</h1>
      <p className="cn-body">
        Every till that can put a Qumo code on a slip. The store code is what the point of sale prints into the QR;
        whether it&apos;s signed is what decides how much that slip proves.
      </p>

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">{stores.length} store{stores.length === 1 ? "" : "s"}</h2>
        </div>
        {stores.length === 0 ? (
          <p className="cn-empty">No stores yet.</p>
        ) : (
          <div className="cn-scroll">
            <table className="cn-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Code</th>
                  <th>Slips</th>
                  <th className="cn-num">Scans</th>
                  <th className="cn-num">Unsigned scans</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id}>
                    <td>{store.name}</td>
                    <td className="cn-mono">{store.code}</td>
                    <td>
                      {store.isSigned ? (
                        <span className="cn-pill cn-pill-ok">Signed</span>
                      ) : (
                        <span className="cn-pill cn-pill-warn">Unsigned</span>
                      )}
                    </td>
                    <td className="cn-num">{store.scanCount.toLocaleString("en-ZA")}</td>
                    {/* Counted separately rather than inferred from the
                        store's current setting: a store that was unsigned
                        last month and signed today still accepted those
                        slips, and the exposure is historical. */}
                    <td className="cn-num">{store.unsignedScanCount.toLocaleString("en-ZA")}</td>
                    <td>
                      {store.isActive ? (
                        <span className="cn-pill">Active</span>
                      ) : (
                        <span className="cn-pill cn-pill-off">Off</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
