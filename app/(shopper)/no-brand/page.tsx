import { PRODUCT_NAME } from "@/lib/product";

/**
 * What a host that names no brand gets.
 *
 * Reached by the apex, by a reserved subdomain, and by a slug that does not
 * resolve — the last of which is what someone probing for brand names sees,
 * which is why all three get the identical page. It says nothing about
 * whether the name they tried exists.
 *
 * The alternative was a 404, and this is better: the person here is far more
 * likely to be a shopper who retyped a URL from a poster than anyone
 * probing, and "you need the link from the poster" is the sentence that
 * actually helps them.
 *
 * Reached only by the proxy's rewrite, which means the address bar still
 * shows whatever the shopper typed — the thing they need to look at.
 */
export default function NoBrandPage() {
  return (
    <>
      <header className="sc-head">
        <div className="sc-mark">{PRODUCT_NAME}</div>
      </header>
      <section className="sc-card">
        <h2 className="sc-h2">This link needs a brand</h2>
        <p className="sc-body">
          {PRODUCT_NAME} runs rewards programmes for brands, and each one lives at its own address. Scan the code on
          the poster, the till slip or the tag again, or open the link exactly as it was printed.
        </p>
        <p className="sc-label">
          Nothing is wrong with your account — this address just doesn&apos;t belong to a programme.
        </p>
      </section>
    </>
  );
}
