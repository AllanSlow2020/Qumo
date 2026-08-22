import { headers } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ROOT_DOMAIN } from "@/lib/brand/host";
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

  // Derived rather than assumed: locally this is http on *.localhost, and
  // printing https on a poster that then fails to load is a reprint.
  const proto = (await headers()).get("x-forwarded-proto") ?? (ROOT_DOMAIN === "localhost" ? "http" : "https");
  const port = ROOT_DOMAIN === "localhost" ? ":3000" : "";
  const joinUrl = `${proto}://${brand?.slug}.${ROOT_DOMAIN}${port}/join`;

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
          <p className="cn-mono" style={{ fontSize: 15, wordBreak: "break-all" }}>
            {joinUrl}
          </p>
          <p className="cn-body">
            Put this behind the QR code on posters, table-talkers and shelf tags. It explains whatever is live and
            takes a sign-up — it never awards anything, which is what makes it safe to print somewhere anybody can
            scan it.
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
