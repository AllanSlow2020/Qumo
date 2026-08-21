/**
 * Which brand a request is addressed to, decided from the Host header alone.
 *
 * This file is imported by proxy.ts and therefore runs in the Edge runtime:
 * no node:crypto, no Prisma, no database. It is pure string work on purpose,
 * and the database lookup happens later in Node (lib/brand/current.ts).
 *
 * The whole reskin requirement rests on this function. Getting it wrong in
 * the permissive direction — accepting a host we do not control, or letting
 * a client choose its own brand — hands one brand's shoppers to another.
 */

/**
 * The apex we own. Everything to the left of it, in a host with exactly one
 * more label, is a brand slug.
 *
 * Configurable because it is not settled: the plan says qumo.app is taken
 * and qumo.co.za is the likely answer, and a hostname baked into the code is
 * the kind of thing nobody finds until the certificate is already issued.
 * `localhost` is the default so a checkout with no .env still runs, and
 * because *.localhost resolves to 127.0.0.1 in every current browser, which
 * makes chicken-licken.localhost:3000 a working local brand host with no
 * hosts-file editing.
 */
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_QUMO_ROOT_DOMAIN?.toLowerCase() || "localhost";

/**
 * Subdomains that are ours and can never be sold, claimed or resolved as a
 * brand. `www` because it is the apex by another name; the rest because they
 * are the addresses the brand console, the API and the marketing site will
 * want, and a brand that registers the slug "app" first would take one of
 * them with it.
 *
 * Enforced here rather than only at brand creation, so a row that predates
 * the rule — or one written straight into the database — still cannot claim
 * a reserved host.
 */
export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "console",
  "dashboard",
  "static",
  "assets",
  "mail",
  "status",
  "docs",
  "help",
  "support",
]);

/** What a slug is allowed to look like, and therefore what a host label is. */
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * The brand slug in a host, or null if the host does not name one.
 *
 * Null is a normal answer, not an error: the apex, `www`, a bare
 * `localhost`, a preview deployment and an IP address all legitimately name
 * no brand. Callers decide what to do about it (app/(shopper)/no-brand).
 *
 * Deliberately strict. Only a host that is *exactly* one label deeper than
 * the root domain resolves, so `evil.chicken-licken.qumo.co.za` — which an
 * attacker with a wildcard record beneath their own name could otherwise
 * arrange — does not.
 */
export function brandSlugFromHost(host: string | null | undefined, rootDomain = ROOT_DOMAIN): string | null {
  if (!host) return null;

  // Strip the port, lowercase, and drop the trailing dot of a fully
  // qualified name. A browser will not send that dot but a health check or a
  // crafted request can, and "brand.qumo.co.za." must not read as a
  // different host than "brand.qumo.co.za".
  const hostname = (host.split(":")[0] ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!hostname) return null;

  const root = (rootDomain.split(":")[0] ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!hostname.endsWith(`.${root}`)) {
    // The apex itself, or a host we do not serve — a preview URL, an IP, or
    // somebody else's domain pointed at us. None of them name a brand.
    return null;
  }

  const label = hostname.slice(0, -(root.length + 1));
  // Exactly one label. Anything containing a dot is deeper than we serve.
  if (!SLUG.test(label)) return null;
  if (RESERVED_SUBDOMAINS.has(label)) return null;

  return label;
}

/**
 * The header the proxy uses to tell the Node side which brand a request was
 * addressed to, having already worked it out from the Host header.
 *
 * The proxy sets it on every request and deletes it first, without
 * exception. A header is the one part of a request a client fully controls,
 * so if the proxy ever merely *added* it, sending
 * `X-Qumo-Brand: some-other-brand` would be enough to read another brand's
 * page — and, once the console lands, to aim a write at another brand's
 * tenant. Stripping is not defence in depth here; it is the defence.
 */
export const BRAND_HEADER = "x-qumo-brand";

/**
 * The console's own subdomain. In RESERVED_SUBDOMAINS above, so no brand can
 * ever claim it — that reservation and this constant have to agree, and they
 * do by construction because this is the string in that set.
 */
export const CONSOLE_SUBDOMAIN = "app";

/**
 * True when this host is the brand console rather than a shopper surface.
 *
 * Note what this does *not* do: it never returns a brand. The console's user
 * brings their brand with them in their session, read from the database on
 * every request. A console that took its tenant from the hostname would let
 * a signed-in staff member of one brand reach another's data by editing the
 * address bar, which is the single worst bug this product could have.
 */
export function isConsoleHost(host: string | null | undefined, rootDomain = ROOT_DOMAIN): boolean {
  if (!host) return false;
  const hostname = (host.split(":")[0] ?? "").trim().toLowerCase().replace(/\.$/, "");
  const root = (rootDomain.split(":")[0] ?? "").trim().toLowerCase().replace(/\.$/, "");
  return hostname === `${CONSOLE_SUBDOMAIN}.${root}`;
}
