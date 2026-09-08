import { NextResponse, type NextRequest } from "next/server";
import { CONSUMER_SESSION_COOKIE } from "@/lib/consumer/session-cookie";
import { BRAND_HEADER, brandSlugFromHost, isConsoleHost } from "@/lib/brand/host";
import { STAFF_SESSION_COOKIE } from "@/lib/staff/session-cookie";
import { buildCsp, generateNonce, REPORT_PATH } from "@/lib/security/csp";

/**
 * Edge routing for the shopper surface.
 *
 * Two principals, and the first thing this file does is decide which one it
 * is looking at - by hostname, before anything else. `app.{root}` is the
 * brand console; `{slug}.{root}` is a brand's shopper surface; anything else
 * is neither.
 *
 * The split is total and runs in both directions. A brand host cannot reach
 * a console route and a console host cannot reach a shopper route, so the
 * two never share a cookie, a session table, or a code path. That is
 * deliberate rather than tidy: two principals through one mechanism is how a
 * single decoding mistake presents a shopper as brand staff.
 */

// Reachable with no session at all, and each for a specific reason.
const SHOPPER_LOGIN = "/wallet/login";
// Where a QR on a pack or sticker lands. Short because the whole URL is
// encoded into a code printed at label size and every character costs scan
// reliability. Public because the page has to run in order to redirect to
// login carrying the scanned code - a pack code is single-use, so bouncing
// it costs the shopper a pack.
const SCAN_ROOT = "/s";
// Where a QR printed on a till slip lands. Separate from /s because the
// payload is several query parameters rather than one code, and a receipt
// template can concatenate a query string far more easily than it can encode
// anything (lib/stores/payload.ts).
const RECEIPT_ROOT = "/r";
// The privacy notice is linked from the consent tick box, so it has to be
// readable by someone who has agreed to nothing.
const LEGAL_ROOT = "/legal";
// Where a poster, a table-talker or a plain NFC tag lands. Public because
// its entire job is to be read by somebody who has never heard of us: a
// poster that redirected to a login before saying what the offer is would be
// asking for a phone number in exchange for nothing.
const JOIN_PATH = "/join";

// The console lives under this prefix in the app directory, and never in a
// URL a person types: on the console host every path is rewritten into it.
const CONSOLE_ROOT = "/console";
// What a staff member actually types, on app.{root}.
const CONSOLE_LOGIN = "/login";

function underRoot(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function isPublic(pathname: string): boolean {
  return (
    pathname === SHOPPER_LOGIN ||
    pathname === JOIN_PATH ||
    // The bare address. Public because the page behind it only decides
    // where to send you - signed in to the wallet, otherwise to the join
    // page - and a session check here would bounce a first-time visitor to
    // a login form before anything had explained the programme, which is
    // the exact thing JOIN_PATH exists to avoid.
    pathname === "/" ||
    underRoot(pathname, SCAN_ROOT) ||
    underRoot(pathname, RECEIPT_ROOT) ||
    underRoot(pathname, LEGAL_ROOT) ||
    // Called by the scheduler with no browser session to carry. Protected by
    // its own CRON_SECRET check inside the handler instead - the same
    // "public URL, real auth in the route" shape a webhook uses.
    pathname.startsWith("/api/cron") ||
    // The aggregator posting an inbound SMS. Same shape as cron and for
    // the same reason: a network has no cookie to carry, so the URL is
    // public and the route checks its own shared secret. It also arrives
    // on whatever host the aggregator was given, which names no brand -
    // fine, because an SMS asserts no brand and the code it carries
    // already knows its own.
    pathname.startsWith("/api/sms") ||
    // A browser posting a blocked-resource report has no session and cannot
    // be told to sign in. It defends itself instead: rate limited, size
    // capped, and answering 204 to everything.
    pathname === REPORT_PATH ||
    // The till simulator, which has to be reachable before you have signed
    // in - producing a slip is how you get something to sign in *for*. It
    //404s outside development regardless of what happens here; see
    // lib/dev/guard.ts. This list only decides whether a request is sent to
    // the page at all.
    pathname.startsWith("/dev/")
  );
}

// Where a request on a host that names no brand is sent. Its own route
// rather than a flag on every page - see below.
const NO_BRAND = "/no-brand";

/**
 * One request's Content-Security-Policy and the nonce inside it.
 *
 * Generated once per request and threaded through every branch below,
 * because a nonce that appeared in the response header but not on the
 * script tags - or the other way round - would produce a page whose own
 * scripts are blocked.
 */
type Security = { nonce: string; csp: string };

/**
 * Request headers, with the security context attached.
 *
 * Both headers matter and for different readers. Next.js looks for the
 * nonce in the Content-Security-Policy header on the *request* and stamps
 * it onto the framework's script tags; `x-nonce` is there for our own
 * components, should any of them ever need to mark a script as ours.
 */
function withSecurity(headers: Headers, security: Security): Headers {
  headers.set("content-security-policy", security.csp);
  headers.set("x-nonce", security.nonce);
  return headers;
}

/**
 * Request headers with the brand decided from the Host header, on a header
 * the client cannot influence.
 *
 * The delete is the important line. See BRAND_HEADER in lib/brand/host.ts.
 */
function brandHeaders(req: NextRequest, security: Security): { headers: Headers; slug: string | null } {
  const headers = withSecurity(new Headers(req.headers), security);
  headers.delete(BRAND_HEADER);

  const slug = brandSlugFromHost(req.headers.get("host"));
  if (slug) {
    headers.set(BRAND_HEADER, slug);
  }
  return { headers, slug };
}

/**
 * The console: `app.{root}`, one principal, its own cookie.
 *
 * Every path is rewritten under /console, so a staff member types
 * app.qumo.co.za/stores and the app directory keeps its routes namespaced.
 * The namespace is what makes the guard on the other side cheap - a brand
 * host asking for /console/anything is asking for something no brand URL
 * ever produces, so it can be refused without a list of console routes to
 * keep in step.
 */
function consoleRoute(req: NextRequest, pathname: string, security: Security): NextResponse {
  // The brand header is never set on this surface, and is stripped like
  // everywhere else. The console's tenant comes from the signed-in user's
  // row, not from a hostname - a console that read its brand from the
  // address bar would let staff of one brand reach another's data by
  // editing it.
  const headers = withSecurity(new Headers(req.headers), security);
  headers.delete(BRAND_HEADER);

  // Cron and any other machine-called route keep their own paths and their
  // own authentication.
  if (pathname.startsWith("/api")) {
    return NextResponse.next({ request: { headers } });
  }

  // Presence only, for the same reason as the shopper side: verifying means
  // a database read and this runs in the Edge runtime. The real check is
  // getStaffSession() in the layout, which also refuses a revoked session
  // and a deactivated account.
  if (pathname !== CONSOLE_LOGIN && !req.cookies.get(STAFF_SESSION_COOKIE)) {
    return NextResponse.redirect(new URL(CONSOLE_LOGIN, req.nextUrl.origin));
  }

  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? CONSOLE_ROOT : `${CONSOLE_ROOT}${pathname}`;
  return NextResponse.rewrite(url, { request: { headers } });
}

/**
 * Every branch below returns a response, and every one of them needs the
 * policy on it, so the header is set once here rather than at eight return
 * statements where the ninth would eventually be forgotten.
 *
 * Set only on documents: the matcher at the bottom of this file excludes
 * static assets and images, which have no scripts to govern. The headers
 * that do apply to everything - HSTS, nosniff, referrer policy - are in
 * next.config.ts, and the policy is deliberately not repeated there. Two
 * Content-Security-Policy headers on one response are enforced as the
 * intersection of both, which is a hard thing to reason about and an easy
 * thing to get wrong twice.
 */
export function proxy(req: NextRequest): NextResponse {
  const nonce = generateNonce();
  // Vercel terminates TLS at the edge and forwards the original scheme, so
  // the header is the authority in production; nextUrl.protocol is the
  // fallback for running the server directly.
  const secure =
    req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
  const security: Security = { nonce, csp: buildCsp(nonce, secure) };
  const response = route(req, security);
  response.headers.set("Content-Security-Policy", security.csp);
  return response;
}

function route(req: NextRequest, security: Security): NextResponse {
  const { pathname } = req.nextUrl;

  // The login rate limit used to sit here and no longer does. It counted
  // in this runtime's memory, which is the one thing an Edge function
  // cannot share between instances, so the limit was really the limit
  // times however many copies were running. It now lives in
  // lib/security/login-guard.ts, against a counter in Postgres, called from
  // the login actions themselves - the nearest place to here that can read
  // a number every instance agrees on.

  // Which surface, decided by hostname and nothing else, before any question
  // about who is signed in.
  if (isConsoleHost(req.headers.get("host"))) {
    return consoleRoute(req, pathname, security);
  }

  const { headers, slug } = brandHeaders(req, security);

  // The other direction of the same split. A console route reached on a
  // brand host would render with no staff session and no brand header, which
  // is a strange enough state to be worth refusing outright rather than
  // reasoning about.
  if (underRoot(pathname, CONSOLE_ROOT)) {
    const url = req.nextUrl.clone();
    url.pathname = NO_BRAND;
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // The brand decision comes before the session one, and the order matters.
  // With it the other way round, /wallet on the apex redirected to
  // /wallet/login and *then* discovered there was no brand - so a shopper
  // ended up at a login URL reading "this link needs a brand", which
  // explains the problem at an address that has nothing to do with it.
  // Nothing under the shopper surface means anything without a brand, so
  // that is the first question asked.
  if (!slug) {
    // Two exceptions. The cron sweep is called by a scheduler at whatever
    // host it was configured with - very likely the apex - and
    // authenticates itself with CRON_SECRET rather than a brand. The privacy
    // notice is Qumo's own document, linked from the footer of every page
    // including the no-brand one; rewriting it made that link point back at
    // the page it was on, a dead end on the one screen whose job is
    // explaining a dead end.
    if (!pathname.startsWith("/api") && !underRoot(pathname, LEGAL_ROOT)) {
      const url = req.nextUrl.clone();
      url.pathname = NO_BRAND;
      // Rewrite, not redirect: the address the shopper typed stays in the
      // bar, which is the address they need to look at to see what is wrong
      // with it.
      return NextResponse.rewrite(url, { request: { headers } });
    }
  }

  if (isPublic(pathname)) {
    return NextResponse.next({ request: { headers } });
  }

  // Presence only, deliberately. Verifying a session means a database read,
  // and this runs in the Edge runtime where the Prisma client is not
  // available. So this is the cheap half - it turns "no cookie at all" into a
  // redirect rather than a rendered page - and the real check happens in the
  // page or route, which runs in Node and calls getConsumerSession(). A
  // forged or revoked cookie gets past here and fails there.
  if (!req.cookies.get(CONSUMER_SESSION_COOKIE)) {
    return NextResponse.redirect(new URL(SHOPPER_LOGIN, req.nextUrl.origin));
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
