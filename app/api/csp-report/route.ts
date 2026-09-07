import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/security/logger";
import { rateLimit } from "@/lib/security/rate-limit";

/**
 * Where a browser posts a Content-Security-Policy violation.
 *
 * Worth having specifically because the policy is new. A CSP that is
 * slightly too strict does not fail loudly - it silently drops one script
 * on one browser, and the first anyone hears is a brand saying the page
 * "doesn't work on my phone". This endpoint turns that into a log line with
 * the blocked URI and the directive that blocked it.
 *
 * ── This is an unauthenticated public POST, so it is treated as one ──────
 *
 * Anyone can post anything here; browsers do not sign these reports. So:
 *
 *  - it is rate limited per client address, using the shared counter, so it
 *    cannot be used to flood the logs or to run up a log bill;
 *  - the body is size-capped before it is parsed, because the cheapest
 *    attack on a JSON endpoint is a very large JSON document;
 *  - only known fields are read, and each is truncated, so a report cannot
 *    inject a megabyte of text into a log line;
 *  - it always answers 204 regardless. A reporting endpoint that returns
 *    different answers for different inputs is a probe, and there is
 *    nothing here worth telling anyone about.
 *
 * Reports are logged rather than sent through reportError: a violation is a
 * signal about configuration, not a crash, and one misbehaving extension in
 * one shopper's browser should not page anybody at two in the morning.
 */

const LIMIT = 20;
const WINDOW_MS = 60_000;
const MAX_BODY_BYTES = 8 * 1024;
const MAX_FIELD = 300;

/** Both shapes browsers send: the old report-uri body and the newer one. */
type ViolationBody = {
  "csp-report"?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

function field(source: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = source[name];
    if (typeof value === "string" && value.length > 0) {
      return value.slice(0, MAX_FIELD);
    }
  }
  return undefined;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // Every early return is the same 204. See the note above.
  const done = new NextResponse(null, { status: 204 });

  try {
    const { allowed } = await rateLimit(`csp-report:${client}`, LIMIT, WINDOW_MS);
    if (!allowed) return done;

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      logger.warn("csp report: body too large", { bytes: raw.length });
      return done;
    }

    const parsed = JSON.parse(raw) as ViolationBody | ViolationBody[];
    // report-to sends an array of reports; report-uri sends one object.
    const reports = Array.isArray(parsed) ? parsed.slice(0, 10) : [parsed];

    for (const report of reports) {
      const detail = report["csp-report"] ?? report.body ?? (report as Record<string, unknown>);
      logger.warn("csp violation", {
        directive: field(detail, "effective-directive", "effectiveDirective", "violated-directive"),
        blocked: field(detail, "blocked-uri", "blockedURL"),
        document: field(detail, "document-uri", "documentURL"),
        // The offending line, when the browser gives one. The single most
        // useful field for finding what actually needs allowing.
        sample: field(detail, "script-sample", "sample"),
      });
    }
  } catch {
    // A malformed body from something that is not a browser. Not worth a
    // log line each time, and certainly not worth an error.
  }

  return done;
}
