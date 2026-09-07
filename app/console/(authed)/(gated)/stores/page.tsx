import type { Role } from "@prisma/client";
import { listStores, MANAGE_STORE_ROLES } from "@/lib/stores/manage";
import { requireStaff } from "@/lib/staff/current";
import { AddStoreForm } from "./add-store-form";
import { StoreActions } from "./store-actions";

export default async function ConsoleStoresPage() {
  const session = await requireStaff();
  const stores = await listStores(session.brandId);

  // The same list the engine enforces against, read here only to decide what
  // to render. The controls are hidden from a role that cannot use them, and
  // every action re-checks server-side - hiding a button is courtesy, not
  // access control.
  const canManage = MANAGE_STORE_ROLES.includes(session.role as Role);

  const unsigned = stores.filter((s) => !s.isSigned).length;

  return (
    <>
      <h1 className="cn-h1">Stores</h1>
      <p className="cn-body">
        Every till that can put a Qumo code on a slip. The store code is what the point of sale prints into the QR;
        whether it&apos;s signed is what decides how much that slip proves.
      </p>

      {unsigned > 0 && (
        <section className="cn-panel">
          <div className="cn-panel-head">
            <h2 className="cn-h2">
              {unsigned} store{unsigned === 1 ? "" : "s"} can&apos;t sign
            </h2>
            <span className="cn-pill cn-pill-warn">Exposure</span>
          </div>
          <div style={{ padding: "14px 16px" }}>
            <p className="cn-body">
              At an unsigned store nothing binds a slip to the till that printed it, so a shopper who has seen one of
              their own receipts can invent others. Your promotion&apos;s per-person and per-campaign ceilings bound
              what that costs - they don&apos;t prevent it. Turning signing on below is the fix, and it needs your
              point of sale to compute the signature.
            </p>
          </div>
        </section>
      )}

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">
            {stores.length} store{stores.length === 1 ? "" : "s"}
          </h2>
        </div>
        {stores.length === 0 ? (
          <p className="cn-empty">No stores yet. Add your first till below.</p>
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
                  {canManage && <th>Manage</th>}
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
                    {canManage && (
                      <td>
                        <StoreActions
                          store={{
                            id: store.id,
                            code: store.code,
                            isSigned: store.isSigned,
                            isActive: store.isActive,
                          }}
                        />
                      </td>
                    )}
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
            <h2 className="cn-h2">Add a store</h2>
          </div>
          <AddStoreForm />
        </section>
      ) : (
        <p className="cn-label">
          Adding and changing stores needs an owner or admin. You can see everything here, but not change it.
        </p>
      )}
    </>
  );
}
