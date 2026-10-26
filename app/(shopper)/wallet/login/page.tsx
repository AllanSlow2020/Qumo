import { redirect } from "next/navigation";
import { requireBrand } from "@/lib/brand/current";
import { getConsumerSession } from "@/lib/consumer/session";
import { safeShopperRedirect } from "@/lib/consumer/redirect";
import { describePackCode } from "@/lib/packs/scan";
import { formatLedgerAmount } from "@/lib/consumer/wallet";
import { BrandHeader } from "../../brand-header";
import { ShopperLoginForm } from "./login-form";

export default async function ShopperLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Validated here rather than trusted straight into the form - see
  // lib/consumer/redirect.ts on why a destination in a query parameter is
  // never taken at face value.
  const destination = safeShopperRedirect(next);

  // Already signed in - send them where they were going rather than making
  // them prove a phone number they proved last month.
  if (await getConsumerSession()) {
    redirect(destination);
  }

  const brand = await requireBrand();

  /*
   * What they just scanned, said before they are asked for anything.
   *
   * /s/<code> sends an unrecognised shopper here carrying the code, and the
   * page used to drop it on the floor as far as the screen was concerned:
   * somebody had picked up a pack, opened their camera, scanned a label, and
   * been answered with "enter your mobile number" and no reason at all. The
   * ask arrived before the offer.
   *
   * Null for everything that is not a live, unclaimed, fixed-value code -
   * including an ordinary sign-in, which is most of them - and the page then
   * reads exactly as it did.
   */
  const scanned = destination.startsWith("/s/")
    ? await describePackCode(destination.slice(3), brand.id)
    : null;

  return (
    <>
      <BrandHeader />

      {scanned && (
        <section className="sc-card sc-waiting">
          <p className="sc-label">Waiting for you</p>
          <p className="sc-figure">{formatLedgerAmount(scanned.amount, scanned.unit)}</p>
          {/* Named, because "a reward" is what every other loyalty scheme
              says and it is the reason nobody believes any of them. */}
          <p className="sc-body">
            from the {scanned.campaignName} code you scanned. Sign in below and it lands in your balance.
          </p>
        </section>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* This used to read "Your rewards, in one place", which was a
            promise about a cross-brand wallet the shopper is no longer being
            offered and would not want from a takeaway. What they are
            actually doing is joining one brand's programme. */}
        <h1 className="sc-h1">{brand.name} rewards</h1>
        <p className="sc-body">Enter your mobile number and we&apos;ll text you a code. No password to remember.</p>
      </div>
      <ShopperLoginForm destination={destination} />
    </>
  );
}
