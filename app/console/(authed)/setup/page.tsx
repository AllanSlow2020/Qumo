import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireStaff } from "@/lib/staff/current";
import { PRODUCT_NAME } from "@/lib/product";
import { ColoursForm } from "./colours-form";

export const metadata: Metadata = { title: `Make it yours · ${PRODUCT_NAME}` };

/**
 * The first thing a brand does, before the console will open.
 *
 * Outside the (gated) group for the same reason /change-password is: this is
 * the screen that satisfies the condition, so it cannot be behind it.
 *
 * Why force it at all, rather than leaving it in settings for whenever. The
 * programme is live from the moment a code is printed, and the first shopper
 * to scan one sees whatever is configured at that instant. A brand that
 * skipped this ships a black button and their legal name to their own
 * customers, and nobody finds out until somebody photographs it.
 */
export default async function SetupPage() {
  const staff = await requireStaff();
  const brand = await prisma.brand.findUniqueOrThrow({
    where: { id: staff.brandId },
    select: { name: true, displayName: true, accentColor: true, accentInkColor: true, accentColorDark: true, accentInkColorDark: true, logoUrl: true, slug: true },
  });

  // Somebody who already has colours and came here by typing the address is
  // not in first-run any more. Send them to the full screen, which can do
  // everything this one can and more.
  if (brand.accentColor) {
    redirect("/settings");
  }

  return (
    <>
      <p className="cn-label">Step 1 of 1</p>
      <h1 className="cn-h1">Make it yours</h1>
      <p className="cn-body">
        Your customers never see {PRODUCT_NAME}. They see you: your name at the top of the page, your colour on the
        button they press. Set that here and the console opens.
      </p>

      <ColoursForm
        brandName={brand.displayName ?? brand.name}
        slug={brand.slug}
        initial={{
          accentColor: brand.accentColor ?? "",
          accentInkColor: brand.accentInkColor ?? "",
          accentColorDark: brand.accentColorDark ?? "",
          accentInkColorDark: brand.accentInkColorDark ?? "",
          logoUrl: brand.logoUrl ?? "",
        }}
      />
    </>
  );
}
