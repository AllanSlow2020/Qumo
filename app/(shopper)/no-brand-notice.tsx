import { PRODUCT_NAME } from "@/lib/product";

/**
 * What a host that names no brand gets.
 *
 * Its own component rather than only a page, because there are two ways to
 * arrive and only one of them is a route. The proxy rewrites the apex and
 * the reserved subdomains to /no-brand, which renders this. A slug that
 * looks valid but matches no row cannot be caught there at all: the proxy
 * runs in the Edge runtime with no database, so it has no way to know which
 * slugs exist. The shopper layout finds out, and renders this directly.
 *
 * Both paths land on identical words on purpose. It says nothing about
 * whether the name somebody tried exists, so this is not a way to ask which
 * brands we have.
 */
export function NoBrandNotice() {
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
          Nothing is wrong with your account. This address just doesn&apos;t belong to a programme.
        </p>
      </section>
    </>
  );
}
