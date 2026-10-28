import Link from "next/link";
import { headers } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { brandOrigin } from "@/lib/brand/host";
import { joinUrl, posterQrSvg } from "@/lib/brand/poster";
import { listCampaignsForConsole, MANAGE_CAMPAIGN_ROLES } from "@/lib/campaigns/manage";
import { consoleUiMode } from "@/lib/console/ui-mode";
import { photoCaptureConfigured } from "@/lib/slips/read";
import { requireStaff } from "@/lib/staff/current";
import { PromotionsWorkspace } from "./promotions-workspace";

export default async function ConsolePromotionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireStaff();

  const [brand, campaigns] = await Promise.all([
    prisma.brand.findUnique({ where: { id: session.brandId }, select: { slug: true } }),
    listCampaignsForConsole(session.brandId),
  ]);

  const canManage = MANAGE_CAMPAIGN_ROLES.includes(session.role as Role);

  // Read on the server, because it is an environment decision rather than
  // a brand one. Offering the photograph tier while no reader is
  // configured would be offering a brand a setting that silently does
  // nothing to every shopper who tries it.
  const photoReady = photoCaptureConfigured();

  // The setup flow lives in a panel that slides in from the right.
  // ?ui=stacked is the way back to the previous layout without a deploy.
  // Read here rather than in the client: it never changes while somebody
  // is working.
  const mode = consoleUiMode((await searchParams).ui);

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
      {/* A pointer rather than an explanation. The concept behind this page
          is explained once, in one place, instead of in a paragraph every
          daily user scrolls past for the rest of the year. */}
      <p className="cn-explain">
        New to this? <Link href="/guide#awards">What a promotion can award</Link>
      </p>

      {/* Setting one up, then what is already running, then the poster.
          Stacked rather than split: the setup flow is a sequence with an
          explanation at every step, and an explanation does not fit in a
          330px rail. See promotions-workspace for why the list moved down
          and what makes that safe. */}
      <div className="cn-promo-stack">
        <PromotionsWorkspace campaigns={campaigns} canManage={canManage} photoReady={photoReady} mode={mode} />

        {/* Last, because it is reference rather than action: the address on
            it never changes and never awards anything, so it belongs below
            the two things that do. */}
        <div>
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
