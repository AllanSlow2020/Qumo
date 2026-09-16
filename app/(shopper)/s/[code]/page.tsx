import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBrand } from "@/lib/brand/current";
import { getConsumerSession } from "@/lib/consumer/session";
import { formatLedgerAmount } from "@/lib/consumer/wallet";
import { redeemPackCode, SCAN_FAILURE_MESSAGES } from "@/lib/packs/scan";
import { BrandHeader } from "../../brand-header";

/**
 * Where a QR code on a pack lands. Kept at /s/<code> rather than something
 * more descriptive because the whole URL is encoded into a QR printed at
 * label size - every character costs density, and density is what decides
 * whether it scans first time in a badly lit aisle.
 *
 * Rendering this page awards the code. That is deliberate: asking a shopper
 * to press a button after scanning adds a step that earns nothing, since
 * arriving here at all already required physical possession of the pack.
 */
export default async function ScanPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const personId = await getConsumerSession();
  if (!personId) {
    // Carry the code through login and come back to it. Without this the
    // scan is simply lost - and a pack code is single-use, so "just scan it
    // again" is not available to them.
    redirect(`/wallet/login?next=${encodeURIComponent(`/s/${code}`)}`);
  }

  // See /r: the subdomain's brand has to agree with the code's, and the
  // check lands before the code is burned.
  const brand = await requireBrand();
  const result = await redeemPackCode(code, personId, new Date(), brand.id);

  if (!result.ok) {
    return (
      <>
        <BrandHeader />
        <section className="sc-card">
          <h1 className="sc-h1">That didn&apos;t work</h1>
          <p className="sc-body">{SCAN_FAILURE_MESSAGES[result.reason]}</p>
          <Link href="/wallet" className="sc-btn sc-btn-ghost">
            Go to my rewards
          </Link>
        </section>
      </>
    );
  }

  /*
   * One screen, whether this render performed the award or found it already
   * done, and the copy is true either way.
   *
   * There were two screens here and the split could not work. This page
   * awards on render and the App Router renders it three times for one
   * navigation, so the render a shopper actually reads is never the one that
   * did the awarding - it is one of the two that arrive to find the code
   * already claimed, by this same shopper, a few milliseconds earlier. A
   * branch that says "you already claimed this one" therefore fires on
   * every genuine first scan, which is what it did.
   *
   * The earlier bug was the opposite mistake: one screen saying "+R10.00,
   * added to your balance", which on a real second scan reads as a second
   * award. Both readings came from trying to name *this scan* as the event.
   * The code is the event. It is worth a fixed amount, once, and the
   * balance underneath is the running total - and stating it that way is
   * true on the first tap, on the accidental double tap, and on the scan
   * somebody tries a week later to see whether it pays twice.
   */
  return (
    <>
      <BrandHeader />
      <section className="sc-card">
        <p className="sc-label">
          {result.brandName} · {result.campaignName}
        </p>
        <p className="sc-figure sc-pos">{formatLedgerAmount(result.amount, result.unit)}</p>
        {/* "from this code", not "added": the amount belongs to the code,
            and the sentence stays honest on a rescan. The balance beside it
            is the number that actually moved, and on a rescan it visibly
            has not. */}
        <p className="sc-body">
          from this code. Your {result.brandName} balance is{" "}
          <strong style={{ color: "var(--sc-ink)" }}>{formatLedgerAmount(result.newBalance, result.unit)}</strong>.
        </p>
        <p className="sc-label">Each code works once, so scanning this one again won&apos;t add more.</p>

        {/* A completed card is the moment the whole stamp mechanic exists
            for - the shopper has to leave this screen knowing they earned
            something and what to show at the counter. */}
        {result.coupon && (
          <div className="sc-tile sc-tile-pos">
            <p className="sc-label">Card complete, you&apos;ve earned</p>
            <p className="sc-h2">{result.coupon.name}</p>
            <p className="sc-code-sm sc-pos">{result.coupon.code}</p>
            <p className="sc-label">Show this code to claim it. It&apos;s saved in your rewards too.</p>
          </div>
        )}

        <Link href="/wallet" className="sc-btn">
          See my rewards
        </Link>
      </section>
    </>
  );
}
