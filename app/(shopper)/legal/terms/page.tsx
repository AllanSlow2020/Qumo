import Link from "next/link";
import type { Metadata } from "next";
import { TERMS_POINTS, TERMS_VERSION } from "@/lib/consumer/terms";
import { OPERATOR_NAME, PRODUCT_NAME } from "@/lib/product";
import { BrandHeader } from "../../brand-header";

export const metadata: Metadata = {
  title: `Terms · ${PRODUCT_NAME}`,
};

/**
 * The other half of the small print.
 *
 * Rendered from lib/consumer/terms.ts for the same reason the privacy
 * notice is rendered from the consent copy: one string, shown wherever it
 * needs showing, so the version a shopper agreed to and the version they
 * can come back and read cannot drift apart.
 */
export default function TermsPage() {
  return (
    <>
      <BrandHeader />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1 className="sc-h1">Terms</h1>
        <p className="sc-body">
          What your balance is, how you earn it, and what happens to it if the programme ends.
        </p>
      </div>

      <section className="sc-card">
        {TERMS_POINTS.map((point) => (
          <div key={point.heading} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 className="sc-h2">{point.heading}</h2>
            <p className="sc-body">{point.body}</p>
          </div>
        ))}

        <p className="sc-label">
          Version {TERMS_VERSION} · {OPERATOR_NAME}. What we keep about you is a separate document.
        </p>
      </section>

      <Link href="/legal/privacy" className="sc-btn sc-btn-ghost">
        Read the privacy notice
      </Link>
    </>
  );
}
