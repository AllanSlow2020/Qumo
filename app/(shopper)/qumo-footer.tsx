import Link from "next/link";
import { currentBrand } from "@/lib/brand/current";
import { PRODUCT_NAME } from "@/lib/product";

/**
 * Where Qumo went.
 *
 * Small type at the bottom of every screen, and not for modesty: a shopper
 * handing over a phone number is entitled to know who is actually holding
 * it, and burying that entirely would make the brand-first page a
 * misrepresentation rather than a skin. So the brand leads and we are named
 * plainly underneath.
 *
 * Support points at the brand first. They run the programme, they decide
 * what it pays, and a shopper with a complaint about a missing R6 needs the
 * people who owe it to them - not us.
 *
 * But not only at the brand. The notice above this line says the account
 * is ours, and a footer that offers one address, the brand's, makes that
 * claim and then hides from it. The second link is the shorter answer to
 * "how do I reach Qumo" than reading the notice to find out.
 */
export async function QumoFooter() {
  const brand = await currentBrand();
  const support = brand?.supportUrl ?? (brand?.supportEmail ? `mailto:${brand.supportEmail}` : null);

  return (
    <footer className="sc-foot">
      <p>
        {brand ? `${brand.name} rewards, run on ${PRODUCT_NAME}.` : `${PRODUCT_NAME}.`}{" "}
        <Link href="/legal/privacy">How we handle your details</Link> ·{" "}
        <Link href="/legal/terms">Terms</Link>
      </p>
      <p>
        {support ? (
          <>
            Something wrong with your balance? <a href={support}>Contact {brand?.name}</a> ·{" "}
          </>
        ) : (
          "Need to ask somebody? "
        )}
        <Link href="/legal/contact">Contact {PRODUCT_NAME}</Link>
      </p>
    </footer>
  );
}
