import Link from "next/link";
import type { Role } from "@prisma/client";
import { listRecentRedemptions, REDEEM_COUPON_ROLES } from "@/lib/coupons/manage";
import { requireStaff } from "@/lib/staff/current";
import { RedeemForm } from "./redeem-form";

/**
 * Where a reward actually changes hands.
 *
 * Until this screen existed a completed stamp card issued a coupon that
 * nothing could mark used, so the same screenshot worked at every counter
 * for ever. That is the hole this closes, and it is worth stating on the
 * page itself: the reason to type the code in rather than glance at a phone
 * is that typing it in is what stops the second visit working.
 */
export default async function ConsoleRedeemPage() {
  const session = await requireStaff();
  const canRedeem = REDEEM_COUPON_ROLES.includes(session.role as Role);
  const recent = canRedeem ? await listRecentRedemptions(session.brandId) : [];

  return (
    <>
      <h1 className="cn-h1">Redeem</h1>
      <p className="cn-body">
        A shopper who has finished a card has a code in their wallet. Type it in here before you hand anything over.
        A code works once: the second time it is entered, this screen says so and names who took it the first time.
      </p>
      <p className="cn-explain">
        New to this? <Link href="/guide#cards">How a stamp card finishes</Link>
      </p>

      {!canRedeem ? (
        <section className="cn-panel">
          <p className="cn-empty">
            Your role can&apos;t redeem rewards. An owner or an admin can, and so can anyone on marketing.
          </p>
        </section>
      ) : (
        <>
          <section className="cn-panel">
            <div className="cn-panel-head">
              <h2 className="cn-h2">Take a reward</h2>
            </div>
            <RedeemForm />
          </section>

          <section className="cn-panel">
            <div className="cn-panel-head">
              <h2 className="cn-h2">Last taken</h2>
            </div>
            {recent.length === 0 ? (
              <p className="cn-empty">Nothing has been redeemed yet.</p>
            ) : (
              <div className="cn-scroll">
                <table className="cn-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Reward</th>
                      <th>When</th>
                      <th>Who</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((row) => (
                      <tr key={row.code}>
                        <td className="cn-mono">{row.code}</td>
                        <td>{row.rewardName}</td>
                        <td>
                          {row.at.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}{" "}
                          {row.at.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td>{row.by ?? "Someone since removed"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
