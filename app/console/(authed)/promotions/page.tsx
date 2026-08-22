import { headers } from "next/headers";
import { prisma } from "@/lib/db/client";
import { listOffers } from "@/lib/consumer/join";
import { ROOT_DOMAIN } from "@/lib/brand/host";
import { requireStaff } from "@/lib/staff/current";

/**
 * What is running, and the address to print on a poster.
 *
 * Read-only for now — editing a promotion is the next screen. It exists
 * already because the overview tells a brand how their campaigns are doing
 * without ever telling them what those campaigns actually say, and because
 * the join page has no value at all if nobody knows the URL to point at it.
 */
export default async function ConsolePromotionsPage() {
  const session = await requireStaff();

  const [brand, offers] = await Promise.all([
    prisma.brand.findUnique({ where: { id: session.brandId }, select: { slug: true, name: true } }),
    listOffers(session.brandId),
  ]);

  // The scheme is derived rather than assumed: locally this is http on
  // *.localhost, and printing https on a poster that then fails to load is a
  // reprint, not a bug report.
  const proto = (await headers()).get("x-forwarded-proto") ?? (ROOT_DOMAIN === "localhost" ? "http" : "https");
  const port = ROOT_DOMAIN === "localhost" ? ":3000" : "";
  const joinUrl = `${proto}://${brand?.slug}.${ROOT_DOMAIN}${port}/join`;

  return (
    <>
      <h1 className="cn-h1">Promotions</h1>

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">Running now</h2>
          <span className="cn-pill">{offers.length}</span>
        </div>
        {offers.length === 0 ? (
          <p className="cn-empty">Nothing running. Shoppers can still join and will be set up for the next one.</p>
        ) : (
          <div className="cn-scroll">
            <table className="cn-table">
              <thead>
                <tr>
                  <th>Promotion</th>
                  <th>What a shopper is told</th>
                  <th>Qualifying</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr key={offer.campaignId}>
                    <td>{offer.campaignName}</td>
                    {/* The shopper-facing sentence, rendered from the same
                        function the poster page uses. A brand should read the
                        words their customers will, not the basis points. */}
                    <td>{offer.headline}</td>
                    <td>{offer.condition ?? "Any purchase"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">Your poster address</h2>
        </div>
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <p className="cn-mono" style={{ fontSize: 15, wordBreak: "break-all" }}>{joinUrl}</p>
          <p className="cn-body">
            Put this behind the QR code on posters, table-talkers and shelf tags. It explains the promotion and takes
            a sign-up — it never awards anything, which is what makes it safe to print somewhere anybody can scan it.
          </p>
          <p className="cn-body">
            The codes that <em>do</em> award are the ones printed per transaction on a till slip. Those are the only
            thing that proves a purchase happened.
          </p>
        </div>
      </section>
    </>
  );
}
