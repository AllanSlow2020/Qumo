import { NoBrandNotice } from "../no-brand-notice";

/**
 * The route the proxy rewrites to for the apex and the reserved subdomains.
 *
 * The words live in NoBrandNotice, because the shopper layout renders the
 * same thing for a slug that resolves to no row - a case this route can
 * never see, since deciding it needs a database and the proxy has none.
 *
 * Reached only by rewrite, which means the address bar still shows whatever
 * the shopper typed - the thing they need to look at.
 */
export default function NoBrandPage() {
  return <NoBrandNotice />;
}
