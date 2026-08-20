import Link from "next/link";
import type { Metadata } from "next";
import { CONSENT_POINTS, WEB_CONSENT_VERSION } from "@/lib/consumer/consent";
import { OPERATOR_NAME, PRODUCT_NAME } from "@/lib/product";
import { Wordmark } from "../../wordmark";

export const metadata: Metadata = {
  title: `Privacy notice · ${PRODUCT_NAME}`,
};

/**
 * The notice linked from the registration tick box.
 *
 * Rendered from lib/consumer/consent.ts rather than written out again here,
 * so the text a shopper agreed to and the text they can go back and read
 * are the same string. Two copies would drift, and the one that drifts is
 * always the one nobody remembered was there.
 */
export default function PrivacyNoticePage() {
  return (
    <>
      <Wordmark />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1 className="sc-h1">Privacy notice</h1>
        <p className="sc-body">
          What {PRODUCT_NAME} keeps about you, who can see it, and what you can ask us to do with it.
        </p>
      </div>

      <section className="sc-card">
        {CONSENT_POINTS.map((point) => (
          <div key={point.heading} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 className="sc-h2">{point.heading}</h2>
            <p className="sc-body">{point.body}</p>
          </div>
        ))}

        <p className="sc-label">
          Version {WEB_CONSENT_VERSION} · {OPERATOR_NAME}. If this notice changes in substance, we&apos;ll ask you to
          agree again the next time you sign in.
        </p>
      </section>

      <Link href="/wallet/login" className="sc-btn sc-btn-ghost">
        Back to sign in
      </Link>
    </>
  );
}
