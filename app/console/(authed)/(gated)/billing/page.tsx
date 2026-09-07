import type { Role } from "@prisma/client";
import { requireStaff } from "@/lib/staff/current";
import { getSubscriptionView, MANAGE_SUBSCRIPTION_ROLES } from "@/lib/subscriptions/manage";
import { HONOUR_WINDOW_DAYS, HONOUR_WINDOW_MS } from "@/lib/subscriptions/state";
import { ProgrammeControls } from "./programme-controls";

const LABELS: Record<string, string> = {
  UNMANAGED: "Not on a plan yet",
  TRIALING: "Trial",
  ACTIVE: "Running",
  CANCELLED: "Ending",
  CLOSED: "Closed",
};

export default async function ConsoleBillingPage() {
  const session = await requireStaff();
  // Read once here rather than inside JSX: the lint rule against calling
  // impure functions during render is right, and a clock read in a render
  // body is exactly the kind of thing it exists to catch.
  const now = new Date();
  const view = await getSubscriptionView(session.brandId, now);
  const canManage = MANAGE_SUBSCRIPTION_ROLES.includes(session.role as Role);

  return (
    <>
      <h1 className="cn-h1">Plan</h1>
      <p className="cn-body">
        Your standing with Qumo, and what it means for your shoppers. You can end the programme at any time.
      </p>

      <div className="cn-grid">
        <div className="cn-metric">
          <div className="cn-metric-v" style={{ fontSize: 20 }}>
            {LABELS[view.status] ?? view.status}
          </div>
          <div className="cn-metric-k">Status</div>
          {view.status === "UNMANAGED" && (
            // Said plainly rather than hidden. Billing is not integrated
            // yet, so this brand is running on nothing but our goodwill and
            // a handshake - which is fine, and should not be a secret.
            <div className="cn-metric-note">Set up by hand. Billing isn&apos;t connected yet.</div>
          )}
        </div>

        <div className="cn-metric">
          <div className="cn-metric-v" style={{ fontSize: 20 }}>
            {view.canEarn ? "Yes" : "No"}
          </div>
          <div className="cn-metric-k">Shoppers can earn</div>
        </div>

        <div className="cn-metric">
          <div className="cn-metric-v" style={{ fontSize: 20 }}>
            {view.canRedeem ? "Yes" : "No"}
          </div>
          <div className="cn-metric-k">Shoppers can spend</div>
          {view.honourUntil && (
            <div className="cn-metric-note">
              {view.canRedeem ? "Until " : "Ended "}
              {view.honourUntil.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          )}
        </div>
      </div>

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">Ending the programme</h2>
        </div>
        <div className="cn-panel-body">
          {/* The rule stated before anybody needs it, not discovered at the
              moment of cancelling. */}
          <p className="cn-body">
            You can stop at any time. Earning stops immediately; anything your shoppers have already earned stays
            spendable for {HONOUR_WINDOW_DAYS} days, then the programme closes. That window is fixed when you
            cancel - changing our policy later won&apos;t shorten a promise already made to your customers.
          </p>

          {canManage ? (
            <ProgrammeControls
              canEarn={view.canEarn}
              status={view.status}
              honourUntil={view.honourUntil?.toISOString() ?? null}
              prospectiveUntil={new Date(now.getTime() + HONOUR_WINDOW_MS).toISOString()}
            />
          ) : (
            <p className="cn-label">Only an owner can end or restart the programme.</p>
          )}
        </div>
      </section>
    </>
  );
}
