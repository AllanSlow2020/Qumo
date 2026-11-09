import Link from "next/link";
import type { Metadata } from "next";
import { currentBrand } from "@/lib/brand/current";
import {
  OPERATOR_LEGAL_NAME,
  OPERATOR_REGISTRATION,
  PRODUCT_NAME,
  SHOPPER_SUPPORT_EMAIL,
} from "@/lib/product";
import { BrandHeader } from "../../brand-header";

export const metadata: Metadata = {
  title: `Contact · ${PRODUCT_NAME}`,
};

/**
 * How a shopper reaches somebody, and which somebody.
 *
 * ── Why this page exists ─────────────────────────────────────────────────
 *
 * There was no route to Qumo at all. Every path ran through whichever
 * brand the shopper had scanned, which is the right default and was the
 * only option. The privacy notice says the account is ours - the mobile
 * number, the age confirmation, the agreement, held once across every
 * brand and visible to none of them - and then sent anyone with a question
 * about it to a brand that cannot see it. A responsible party that names
 * itself and gives no address has not really named itself.
 *
 * ── Why the brand still comes first ──────────────────────────────────────
 *
 * Because it is usually the right answer and the faster one. A missing
 * stamp, a reward a counter would not honour, a promotion that ended: the
 * people who owe it are the people to ask. This page does not redirect
 * anybody away from them, it says plainly which questions are ours and
 * gives the shopper the choice rather than the runaround.
 *
 * Renders without a session on purpose: somebody who has just deleted
 * their account still needs to be able to reach us, and they have nothing
 * left to sign in with.
 */
export default async function ContactPage() {
  const brand = await currentBrand();
  const brandSupport = brand?.supportUrl ?? (brand?.supportEmail ? `mailto:${brand.supportEmail}` : null);

  return (
    <>
      <BrandHeader caption="Contact" />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1 className="sc-h1">Who to ask</h1>
        <p className="sc-body">
          Two places, and it depends on the question. If you are not sure, ask {brand ? brand.name : "the brand"}{" "}
          first. They will bring us anything that turns out to be ours.
        </p>
      </div>

      {brand && (
        <section className="sc-card">
          <h2 className="sc-h2">Ask {brand.name}</h2>
          <p className="sc-body">
            Anything about their programme: a stamp that did not appear, a reward you were not given, what a
            promotion pays, when it ends, a price or a product or one of their stores. They run it and they decide
            what it is worth.
          </p>
          {brandSupport ? (
            <a href={brandSupport} className="sc-btn sc-btn-ghost">
              Contact {brand.name}
            </a>
          ) : (
            <p className="sc-label">
              They have not given us a contact address to publish. Ask at the counter, or write to us below and we
              will pass it on.
            </p>
          )}
        </section>
      )}

      <section className="sc-card">
        <h2 className="sc-h2">Ask {PRODUCT_NAME}</h2>
        <p className="sc-body">
          Anything about your account rather than a programme: your mobile number, signing in, the one-time codes,
          this agreement, or a record that looks wrong across more than one brand. We hold those, every brand you
          use shares one account with us, and no brand can see them.
        </p>
        <p className="sc-body">
          Write to{" "}
          <a href={`mailto:${SHOPPER_SUPPORT_EMAIL}`} className="sc-linkish">
            {SHOPPER_SUPPORT_EMAIL}
          </a>
          . You do not have to go through {brand ? brand.name : "a brand"} to reach us. If you are asking about
          information we hold about you, the law gives us 30 days to answer and we would rather not use them.
        </p>
      </section>

      <section className="sc-card">
        <h2 className="sc-h2">Faster than writing to anyone</h2>
        <p className="sc-body">
          A copy of everything we hold about you, leaving a brand&apos;s programme, and deleting your account are all
          buttons on your own details page. Nobody has to approve them and nobody has to be asked.
        </p>
        <Link href="/wallet/me" className="sc-btn sc-btn-ghost">
          Your details
        </Link>
      </section>

      <section className="sc-card">
        <h2 className="sc-h2">Who we are</h2>
        <p className="sc-body">
          {PRODUCT_NAME} is run by {OPERATOR_LEGAL_NAME}, registration {OPERATOR_REGISTRATION}, South Africa.
        </p>
        <p className="sc-label">
          <Link href="/legal/privacy">What we keep about you</Link> · <Link href="/legal/terms">Terms</Link>
        </p>
      </section>
    </>
  );
}
