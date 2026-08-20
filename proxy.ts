import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { CONSUMER_SESSION_COOKIE } from "@/lib/consumer/session-cookie";

/**
 * Edge routing for the shopper surface.
 *
 * Much smaller than CIOS's, and for a reason worth stating: that one wrapped
 * NextAuth because it guarded a staff portal, and every path had to be
 * classified as staff, shopper, or public. Qumo has no staff surface yet —
 * the brand console arrives in its own phase with its own auth — so there is
 * exactly one principal here and the rules collapse to "signed in, or not".
 *
 * When the console lands it gets its own matcher and its own session; it
 * must never share this cookie. Two principals through one mechanism is how
 * one decoding mistake presents a shopper as brand staff.
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

const RATE_LIMITED = [SHOPPER_LOGIN];
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

  if (isPublic(pathname)) {
    return NextResponse.next();
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
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
