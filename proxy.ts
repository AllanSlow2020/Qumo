import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { CONSUMER_SESSION_COOKIE } from "@/lib/consumer/session-cookie";
import { BRAND_HEADER, brandSlugFromHost, isConsoleHost } from "@/lib/brand/host";
import { STAFF_SESSION_COOKIE } from "@/lib/staff/session-cookie";

/**
 * Edge routing for the shopper surface.
 *
 * Two principals, and the first thing this file does is decide which one it
 * is looking at — by hostname, before anything else. `app.{root}` is the
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
// login carrying the scanned code — a pack code is single-use, so bouncing
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

// The console lives under this prefix in the app directory, and never in a
// URL a person types: on the console host every path is rewritten into it.
const CONSOLE_ROOT = "/console";
// What a staff member actually types, on app.{root}.
const CONSOLE_LOGIN = "/login";

const RATE_LIMITED = [SHOPPER_LOGIN, CONSOLE_LOGIN];
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

function underRoot(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function isPublic(pathname: string): boolean {
  return (
    pathname === SHOPPER_LOGIN ||
    underRoot(pathname, SCAN_ROOT) ||
    underRoot(pathname, RECEIPT_ROOT) ||
    underRoot(pathname, LEGAL_ROOT) ||
    // Called by the scheduler with no browser session to carry. Protected by
    // its own CRON_SECRET check inside the handler instead — the same
    // "public URL, real auth in the route" shape a webhook uses.
    pathname.startsWith("/api/cron")
  );
}

// Where a request on a host that names no brand is sent. Its own route
// rather than a flag on every page — see below.
const NO_BRAND = "/no-brand";

/**
 * Request headers with the brand decided from the Host header, on a header
 * the client cannot influence.
 *
 * The delete is the important line. See BRAND_HEADER in lib/brand/host.ts.
 */
function brandHeaders(req: NextRequest): { headers: Headers; slug: string | null } {
  const headers = new Headers(req.headers);
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
 * The namespace is what makes the guard on the other side cheap — a brand
 * host asking for /console/anything is asking for something no brand URL
 * ever produces, so it can be refused without a list of console routes to
 * keep in step.
 */
function consoleRoute(req: NextRequest, pathname: string): NextResponse {
  // The brand header is never set on this surface, and is stripped like
  // everywhere else. The console's tenant comes from the signed-in user's
  // row, not from a hostname — a console that read its brand from the
  // address bar would let staff of one brand reach another's data by
  // editing it.
  const headers = new Headers(req.headers);
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

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  if (RATE_LIMITED.includes(pathname)) {
    // Per-process and honest about it: on a serverless deployment the
    // effective limit is this times the instance count. A first line against
    // casual abuse, not a defence — the real backstop for passcodes is the
    // per-code attempt cap in lib/consumer/otp.ts. A shared store belongs
    // here before real traffic; see docs/qumo-architecture.md.
    const forwardedFor = req.headers.get("x-forwarded-for");
    const clientKey = forwardedFor?.split(",")[0]?.trim() ?? "unknown";
    const { allowed } = rateLimit(`${pathname}:${clientKey}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!allowed) {
      return new NextResponse("Too many requests", { status: 429 });
    }
  }

  // Which surface, decided by hostname and nothing else, before any question
  // about who is signed in.
  if (isConsoleHost(req.headers.get("host"))) {
    return consoleRoute(req, pathname);
  }

  const { headers, slug } = brandHeaders(req);

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
  // /wallet/login and *then* discovered there was no brand — so a shopper
  // ended up at a login URL reading "this link needs a brand", which
  // explains the problem at an address that has nothing to do with it.
  // Nothing under the shopper surface means anything without a brand, so
  // that is the first question asked.
  if (!slug) {
    // Two exceptions. The cron sweep is called by a scheduler at whatever
    // host it was configured with — very likely the apex — and
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
  // available. So this is the cheap half — it turns "no cookie at all" into a
  // redirect rather than a rendered page — and the real check happens in the
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
