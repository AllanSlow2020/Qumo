import { headers } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { brandOrigin } from "@/lib/brand/host";
import { joinUrl, posterQrSvg } from "@/lib/brand/poster";
import { listCampaignsForConsole, MANAGE_CAMPAIGN_ROLES } from "@/lib/campaigns/manage";
import { requireStaff } from "@/lib/staff/current";
import { PromotionsWorkspace } from "./promotions-workspace";

export default async function ConsolePromotionsPage() {
  const session = await requireStaff();

  const [brand, campaigns] = await Promise.all([
    prisma.brand.findUnique({ where: { id: session.brandId }, select: { slug: true } }),
    listCampaignsForConsole(session.brandId),
  ]);

  const canManage = MANAGE_CAMPAIGN_ROLES.includes(session.role as Role);

  // brandOrigin rather than built here, which is what this was doing and
  // what the CSV route and the label sheet were each doing separately. Three
  // copies of "what is this brand's address" would eventually disagree, and
  // the copy that disagreed would be the one already printed on a poster.
  const origin = brandOrigin(brand?.slug ?? "", (await headers()).get("x-forwarded-proto"));
  const posterUrl = joinUrl(origin);
  const posterQr = brand ? await posterQrSvg(origin) : null;

  const live = campaigns.filter((c) => c.status === "ACTIVE").length;

  return (
    <>
      <h1 className="cn-h1">Promotions</h1>
      <p className="cn-body">
        What a shopper earns, and what that can cost you. {live} of {campaigns.length} live.
      </p>

      {/* What is running on the left, the way to start another on the right.
          Three rows in one grid rather than a two-column block with a band
          under it, because the poster belongs to this page in a different
          way from the other two and the layout should say so.

          The rail is narrow on purpose. It holds two fields, and an equal
          half would have made the thing a brand looks at every day share the
          screen with the thing they do once a month. */}
      <div className="cn-split">
        <PromotionsWorkspace campaigns={campaigns} canManage={canManage} />

        {/* Its own row rather than a band across the bottom of the page. It
            is reference for what is running above it, so at width it sits
            under the promotions and shares their right edge; on a phone it
            falls below the form, because an action a brand reaches for
            should not be buried under something they read once. */}
        <div className="cn-split-foot">
          <section className="cn-panel">
            <div className="cn-panel-head">
              <h2 className="cn-h2">Your poster address</h2>
            </div>
            <div className="cn-panel-body">
              <div className="cn-poster">
                {posterQr && (
                  // Rendered so it can be checked with a phone before it is
                  // sent anywhere. A QR nobody scanned before it went to
                  // print is a reprint waiting to happen.
                  <div className="cn-poster-qr" dangerouslySetInnerHTML={{ __html: posterQr }} />
                )}
                <div className="cn-poster-main">
                  <p className="cn-mono" style={{ fontSize: 15, wordBreak: "break-all" }}>
                    {posterUrl}
                  </p>
                  <p className="cn-body">
                    Put this on posters, table-talkers and shelf tags. It explains whatever is live and takes a
                    sign-up. It never awards anything, which is what makes it safe to print somewhere anybody can
                    scan it.
                  </p>
                  {/* SVG, not a screenshot. A poster is laid out by somebody
                      else at a size nobody has decided yet, and a QR scaled
                      up from a small raster is a QR that fails in a shop
                      window. */}
                  <a href="/api/console/poster" className="cn-btn cn-btn-quiet" download>
                    Download the QR as SVG
                  </a>
                  <p className="cn-label">
                    Vector, so it works at any size from a shelf tag to a shop window. Scan it with your own phone
                    before it goes to print.
                  </p>
                </div>
              </div>
              {/* This paragraph used to name the till slip as the only thing
                  that can award, which is wrong and was wrong on the screen a
                  brand reads before choosing a mechanism. A code printed on
                  the pack is single-use in exactly the same way. What
                  separates both of them from the poster above is uniqueness,
                  not where they are printed. */}
              <p className="cn-body">
                The codes that <em>do</em> award are the unique ones: printed under a pack, or printed per
                transaction on a till slip. Either way each code works once, which is what makes it proof that
                something was bought rather than walked past.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
