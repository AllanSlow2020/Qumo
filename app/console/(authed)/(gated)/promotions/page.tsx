import { headers } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { brandOrigin } from "@/lib/brand/host";
import { joinUrl, posterQrSvg } from "@/lib/brand/poster";
import { listCampaignsForConsole, MANAGE_CAMPAIGN_ROLES } from "@/lib/campaigns/manage";
import { requireStaff } from "@/lib/staff/current";
import { CampaignCard } from "./campaign-card";
import { CreateCampaignForm } from "./create-campaign-form";

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

      {campaigns.length === 0 ? (
        <p className="cn-empty">No promotions yet.</p>
      ) : (
        campaigns.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} canManage={canManage} />
        ))
      )}

      {canManage ? (
        <section className="cn-panel">
          <div className="cn-panel-head">
            <h2 className="cn-h2">New promotion</h2>
          </div>
          <CreateCampaignForm />
        </section>
      ) : (
        <p className="cn-label">
          Creating and changing promotions needs an owner or admin. You can see everything here, but not change it.
        </p>
      )}

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">Your poster address</h2>
        </div>
        <div className="cn-panel-body">
          <div className="cn-poster">
            {posterQr && (
              // Rendered so it can be checked with a phone before it is sent
              // anywhere. A QR nobody scanned before it went to print is a
              // reprint waiting to happen.
              <div className="cn-poster-qr" dangerouslySetInnerHTML={{ __html: posterQr }} />
            )}
            <div className="cn-poster-main">
              <p className="cn-mono" style={{ fontSize: 15, wordBreak: "break-all" }}>
                {posterUrl}
              </p>
              <p className="cn-body">
                Put this on posters, table-talkers and shelf tags. It explains whatever is live and takes a sign-up.
                It never awards anything, which is what makes it safe to print somewhere anybody can scan it.
              </p>
              {/* SVG, not a screenshot. A poster is laid out by somebody else
                  at a size nobody has decided yet, and a QR scaled up from a
                  small raster is a QR that fails in a shop window. */}
              <a href="/api/console/poster" className="cn-btn" download>
                Download the QR as SVG
              </a>
              <p className="cn-label">
                Vector, so it works at any size from a shelf tag to a shop window. Scan it with your own phone before
                it goes to print.
              </p>
            </div>
          </div>
          <p className="cn-body">
            The codes that <em>do</em> award are the ones printed per transaction on a till slip. Those are the only
            thing that proves a purchase happened.
          </p>
        </div>
      </section>
    </>
  );
}
