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
   * A repeat scan of a code this same shopper already used.
   *
   * The engine has always told these apart - someone else's used code is
   * refused outright, and only your own comes back as a success carrying
   * `alreadyEarned` - and this page ignored the flag and rendered both the
   * same. So a second scan said "+R10.00, added to your balance", which is
   * true of the first scan and reads as a second award. It never was one:
   * the ledger has a single row and the balance underneath is unchanged.
   *
   * Worth more than tidiness. The first thing anybody does with a loyalty
   * QR is scan it twice to see whether it pays twice, and the honest answer
   * has to be on the screen rather than only in the database.
   */
  if (result.alreadyEarned) {
    return (
      <>
        <BrandHeader />
        <section className="sc-card">
          <p className="sc-label">
            {result.brandName} · {result.campaignName}
          </p>
          <h1 className="sc-h1">You already claimed this one</h1>
          <p className="sc-body">
            This code gave you {formatLedgerAmount(result.amount, result.unit)} when you first scanned it. Each code
            works once. Your balance is{" "}
            <strong style={{ color: "var(--sc-ink)" }}>{formatLedgerAmount(result.newBalance, result.unit)}</strong>.
          </p>
          <Link href="/wallet" className="sc-btn">
            See my rewards
          </Link>
        </section>
      </>
    );
  }

  return (
    <>
      <BrandHeader />
      <section className="sc-card">
        <p className="sc-label">
          {result.brandName} · {result.campaignName}
        </p>
        <p className="sc-figure sc-pos">+{formatLedgerAmount(result.amount, result.unit)}</p>
        <p className="sc-body">
          Added to your {result.brandName} balance. You now have{" "}
          <strong style={{ color: "var(--sc-ink)" }}>{formatLedgerAmount(result.newBalance, result.unit)}</strong>.
        </p>

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
