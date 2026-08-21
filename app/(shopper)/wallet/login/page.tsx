import { redirect } from "next/navigation";
import { requireBrand } from "@/lib/brand/current";
import { getConsumerSession } from "@/lib/consumer/session";
import { safeShopperRedirect } from "@/lib/consumer/redirect";
import { BrandHeader } from "../../brand-header";
import { ShopperLoginForm } from "./login-form";

export default async function ShopperLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Validated here rather than trusted straight into the form — see
  // lib/consumer/redirect.ts on why a destination in a query parameter is
  // never taken at face value.
  const destination = safeShopperRedirect(next);

  // Already signed in — send them where they were going rather than making
  // them prove a phone number they proved last month.
  if (await getConsumerSession()) {
    redirect(destination);
  }

  const brand = await requireBrand();

  return (
    <>
      <BrandHeader />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* This used to read "Your rewards, in one place", which was a
            promise about a cross-brand wallet the shopper is no longer being
            offered and would not want from a chicken shop. What they are
            actually doing is joining one brand's programme. */}
        <h1 className="sc-h1">{brand.name} rewards</h1>
        <p className="sc-body">Enter your mobile number and we&apos;ll text you a code. No password to remember.</p>
      </div>
      <ShopperLoginForm destination={destination} />
    </>
  );
}
