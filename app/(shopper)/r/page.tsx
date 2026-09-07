import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBrand } from "@/lib/brand/current";
import { getConsumerSession } from "@/lib/consumer/session";
import { formatLedgerAmount } from "@/lib/consumer/wallet";
import { redeemReceipt, RECEIPT_FAILURE_MESSAGES } from "@/lib/stores/receipt";
import { BrandHeader } from "../brand-header";

/**
 * Where a QR printed on a till slip lands.
 *
 * Query parameters rather than a path segment, because the payload is
 * several fields and a POS receipt template can concatenate a query string
 * far more easily than it can encode anything - see lib/stores/payload.ts.
 */
export default async function ReceiptScanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;

  // Rebuilt rather than passed through, so only the fields the payload
  // defines reach the verifier and array-valued duplicates collapse to one.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value) && value[0] !== undefined) {
      params.set(key, value[0]);
    }
  }

  const personId = await getConsumerSession();
  if (!personId) {
    // Carry the whole slip through login. Unlike a pack code this one is
    // still scannable afterwards, but sending someone back to a receipt
    // they have already put in a bin is not a recovery.
    redirect(`/wallet/login?next=${encodeURIComponent(`/r?${params.toString()}`)}`);
  }

  // The brand named by the subdomain, cross-checked against the store's own
  // brand inside redeemReceipt. A slip from another brand is refused before
  // anything is awarded rather than rendered under the wrong header.
  const brand = await requireBrand();
  const result = await redeemReceipt(params, personId, new Date(), brand.id);

  if (!result.ok) {
    return (
      <>
        <BrandHeader />
        <section className="sc-card">
          <h1 className="sc-h1">That didn&apos;t work</h1>
          <p className="sc-body">{RECEIPT_FAILURE_MESSAGES[result.reason]}</p>
          <Link href="/wallet" className="sc-btn sc-btn-ghost">
            Go to my rewards
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
          {result.brandName} · {result.storeName}
        </p>
        <p className="sc-figure sc-pos">+{formatLedgerAmount(result.awarded, result.unit)}</p>
        {/* Deliberately worded the same whether this is the first render or
            a repeat. The App Router fetches this page twice on one
            navigation, so the second render is what a first-time scanner
            actually sees - "you already earned this" would then greet
            everyone, which is worse than the problem it was fixing. The
            balance underneath carries the real information, and this
            sentence is true either way. `alreadyEarned` still does its job
            in the data, where it stops a coupon being shown twice. */}
        <p className="sc-body">
          Earned on a {formatLedgerAmount(result.amountCents, "CENTS")} purchase. You have{" "}
          <strong style={{ color: "var(--sc-ink)" }}>{formatLedgerAmount(result.newBalance, result.unit)}</strong> with{" "}
          {result.brandName}.
        </p>

        {result.coupon && (
          <div className="sc-tile sc-tile-pos">
            <p className="sc-label">Card complete - you&apos;ve earned</p>
            <p className="sc-h2">{result.coupon.name}</p>
            <p className="sc-code-sm sc-pos">{result.coupon.code}</p>
          </div>
        )}

        <Link href="/wallet" className="sc-btn">
          See my rewards
        </Link>
      </section>
    </>
  );
}
