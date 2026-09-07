import type { Role } from "@prisma/client";
import { ROOT_DOMAIN } from "@/lib/brand/host";
import { getBrandIdentity, MANAGE_IDENTITY_ROLES } from "@/lib/brand/manage";
import { requireStaff } from "@/lib/staff/current";
import { IdentityForm } from "./identity-form";

export default async function ConsoleSettingsPage() {
  const session = await requireStaff();
  const brand = await getBrandIdentity(session.brandId);
  if (!brand) {
    throw new Error("Signed in against a brand that no longer exists");
  }

  const canManage = MANAGE_IDENTITY_ROLES.includes(session.role as Role);
  const port = ROOT_DOMAIN === "localhost" ? ":3000" : "";
  const host = `${brand.slug}.${ROOT_DOMAIN}${port}`;

  return (
    <>
      <h1 className="cn-h1">Appearance</h1>
      <p className="cn-body">
        Your name, your colour, your type and your logo, on the pages your customers actually see. The same
        mechanic runs underneath for every brand - this is the part that makes it yours. Everything here has a
        Qumo default already set, so changing nothing still gets you a considered page.
      </p>

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">Your address</h2>
        </div>
        <div className="cn-panel-body">
          <p className="cn-mono" style={{ fontSize: 15 }}>{host}</p>
          {/* Not editable, and the reason is worth giving rather than just
              greying out a field. */}
          <p className="cn-body">
            This is fixed. It goes into every QR code you print, so changing it would dead-end every poster, slip and
            tag already out in a store. If you need a different one, that is a move rather than an edit - talk to us
            and we will redirect the old one.
          </p>
        </div>
      </section>

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">How it looks</h2>
        </div>
        {canManage ? (
          <div className="cn-panel-body">
            <IdentityForm brand={brand} />
          </div>
        ) : (
          <div className="cn-panel-body">
            <p className="cn-label">Changing the brand&apos;s appearance needs an owner or admin.</p>
          </div>
        )}
      </section>
    </>
  );
}
