/**
 * The Content-Security-Policy, built per request because it carries a
 * per-request nonce.
 *
 * Edge-safe: no node:crypto, no Prisma, nothing this file imports pulls
 * either in. proxy.ts runs in the Edge runtime and this is called from it.
 *
 * ── Why a nonce and not 'unsafe-inline' ──────────────────────────────────
 *
 * A CSP with `script-src 'unsafe-inline'` stops almost nothing: the whole
 * point of the header is to make an injected <script> inert, and
 * 'unsafe-inline' is a blanket permission for exactly that. It is the usual
 * compromise because most apps have inline scripts they cannot remove.
 *
 * This one does not have any. There is no <script> tag and no
 * dangerouslySetInnerHTML anywhere in app/, and next/font self-hosts the
 * one typeface at build time rather than fetching it, so nothing is loaded
 * from a font CDN either. That means the strict policy is available for the
 * cost of writing it down, and taking the weaker one would be a choice
 * rather than a constraint.
 *
 * Next.js reads the nonce out of the Content-Security-Policy header on the
 * *request* and stamps it onto the framework's own script tags, which is
 * why proxy.ts sets the header in both directions.
 *
 * ── Where it is deliberately loose, and why ──────────────────────────────
 *
 * `style-src` allows inline. Brand theming sets colours through the `style`
 * attribute (lib/brand/theme.ts), so every themed element carries an inline
 * style, and a nonce cannot cover a style *attribute* — only a <style>
 * block. The alternative is a stylesheet regenerated per brand per colour
 * change. Inline style is also a far weaker vector than inline script: it
 * can restyle a page, not run code on it.
 *
 * `img-src` allows any https origin. A brand's logo lives on that brand's
 * own CDN and we do not know the host in advance
 * (lib/brand/theme.ts#safeLogoUrl only insists on https). Worth naming the
 * cost: every shopper's browser fetches that logo directly, so the brand's
 * host learns the shopper's address and that they were on the page.
 * Proxying logos through our own origin would close that and let this drop
 * to 'self'. A real improvement, and a bigger change than this one.
 */

/**
 * The violation sink. Exported so proxy.ts can name the same path in the
 * Reporting-Endpoints header, and so the proxy's public-path list can let
 * it through without a session — a browser posting a violation report has
 * no cookie to offer and no way to be told to sign in.
 */
export const REPORT_PATH = "/api/csp-report";

/** 128 bits, base64. Web Crypto rather than node:crypto, for the Edge. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * @param secure whether this request arrived over https. See the note on
 *   `upgrade-insecure-requests` at the bottom of the policy.
 */
export function buildCsp(nonce: string, secure: boolean): string {
  // Turbopack's dev server compiles with eval and injects its own inline
  // scripts, and hot reload talks over a websocket. None of that exists in
  // a build, so the loosening is confined to the runtime that needs it —
  // and the production policy is the one that ships.
  //
  // The cost of the split is that `next dev` does not exercise the real
  // policy, so a violation would not show up there. That is why the strict
  // policy is verified against `next build && next start` instead.
  // Read per call rather than captured at module load, so a test can build
  // the production policy without being a production process. Next inlines
  // NODE_ENV at build time either way.
  const dev = process.env.NODE_ENV !== "production";

  const script = dev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : // 'strict-dynamic' lets a nonced script load the chunks it needs
      // without every chunk URL being listed. 'self' is kept for browsers
      // too old to understand 'strict-dynamic', which ignore the nonce.
      `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const connect = dev ? "'self' ws: wss:" : "'self'";

  return [
    "default-src 'self'",
    `script-src ${script}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data:",
    // next/font self-hosts, so fonts only ever come from our own origin.
    "font-src 'self'",
    `connect-src ${connect}`,
    // Server actions post back to the page they came from and nothing else
    // submits anywhere. A form that could post a session cookie off-site is
    // one of the quieter ways data leaves a building.
    "form-action 'self'",
    // Nothing here is ever meant to be framed. Stops clickjacking a till
    // screen or a consent tick box, and supersedes X-Frame-Options for any
    // browser that understands it.
    "frame-ancestors 'none'",
    "frame-src 'none'",
    // No plugins, and no <base> to rewrite where relative URLs resolve to.
    "object-src 'none'",
    "base-uri 'none'",
    // Where a browser posts what it just blocked.
    //
    // report-uri only, and that is a finding rather than an oversight. The
    // obvious thing is to send both spellings — report-uri for older
    // browsers, report-to for newer ones. Doing that delivers nothing:
    // Chrome ignores report-uri whenever report-to is present, and the
    // report-to path then failed silently, which is the worst possible
    // behaviour for the one feature whose job is to tell you when something
    // is failing silently.
    //
    // Established by removing report-to and watching the same violation
    // arrive immediately. report-uri is deprecated and universally
    // supported; report-to can be added the day it can be verified against
    // a real certificate on the real domain, and not before.
    //
    // A relative path on purpose: it resolves against whichever brand
    // subdomain the shopper is on, so every brand reports to its own origin
    // and nothing is hardcoded to a domain that is not registered yet.
    `report-uri ${REPORT_PATH}`,
  ]
    .concat(
      // Only on a page that is already secure, where it is a safety net for
      // any subresource that slipped through as http.
      //
      // Not on an http page, where it is actively harmful: the directive
      // upgrades same-origin *navigations* too, so on http://…:3000 every
      // link and form submission is rewritten to https://…:3000, which is
      // not listening. That breaks the local run of a production build —
      // which is how this build gets shown to anyone before it is deployed
      // — and it was found by driving one rather than by reading the spec.
      //
      // Keyed on the request's own protocol rather than on NODE_ENV, so a
      // production build served over http locally behaves, and a staging
      // deployment over https gets the directive without being told it is
      // production.
      secure ? ["upgrade-insecure-requests"] : [],
    )
    .join("; ");
}
