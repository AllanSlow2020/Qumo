import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { handleInboundSms } from "@/lib/sms/inbound";
import { logger } from "@/lib/security/logger";

/**
 * Where the aggregator posts every message sent to our short code.
 *
 * ── This endpoint is the whole trust boundary ────────────────────────────
 *
 * The body carries a phone number and we act on it: we look up whose it is
 * and answer with their balance. Nothing downstream re-checks that claim,
 * because there is nothing to re-check it against - the network's assertion
 * is the only evidence there ever was. So an unauthenticated version of this
 * route is not a smaller version of the feature. It is a public endpoint
 * that reads any South African's balance to anyone who can guess the URL.
 *
 * Hence: a shared secret, compared in constant time, and no path through
 * this file that reaches handleInboundSms() without it.
 *
 * ── Why it refuses when the secret is unset ──────────────────────────────
 *
 * With SMS_WEBHOOK_SECRET missing, every request 401s. That is deliberate
 * and it is the same choice the cron routes make: the failure mode of "not
 * configured yet" has to be the safe one, because "not configured yet" is
 * the state every deployment starts in and some of them stay in.
 *
 * ── Provider shape ───────────────────────────────────────────────────────
 *
 * No aggregator has been chosen yet (see docs/qumo-architecture.md), so this
 * reads the two encodings all of them use - JSON and form - and looks for
 * the sender and body under the field names they use. That is not future
 * proofing for its own sake; it is what lets the channel be built, tested
 * and reviewed before a commercial decision that is not ours to make.
 *
 * What is genuinely provider-specific is the *reply* envelope: Twilio wants
 * TwiML, Africa's Talking wants JSON, others take plain text. That is one
 * function, written when we know, and the rest of this does not move.
 */

export const runtime = "nodejs";

/** The names aggregators give the sender's number, in the order we try them. */
const FROM_KEYS = ["from", "From", "msisdn", "sender", "sourceAddr", "source_addr", "phoneNumber"];
/** The names they give the message body. */
const TEXT_KEYS = ["text", "Body", "body", "message", "content", "shortMessage"];

function firstValue(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return "";
}

/**
 * Constant time, like every other secret comparison here.
 *
 * Worth saying plainly: no test in tests/sms-webhook.test.ts catches the
 * loss of this property. Replacing the body with `supplied === expected`
 * leaves the suite green, because a timing leak is not observable from a
 * unit test. It is held by review, so if you are reading this in a diff
 * that changed it, that is the review.
 *
 * The token is accepted from a header or from the query string. Both,
 * because some aggregator consoles offer a URL field and nothing else - and
 * a scheme that only works for the ones that can set headers is a scheme
 * that gets replaced by no scheme at all on the day we sign with one that
 * cannot.
 */
function secretMatches(supplied: string | null, expected: string): boolean {
  if (!supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorised(request: NextRequest, expected: string): boolean {
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (secretMatches(bearer, expected)) return true;
  return secretMatches(request.nextUrl.searchParams.get("token"), expected);
}

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") ?? "";

  if (type.includes("application/json")) {
    try {
      const parsed: unknown = await request.json();
      return parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  if (type.includes("form")) {
    const form = await request.formData();
    return Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
  }

  return {};
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.SMS_WEBHOOK_SECRET;
  if (!expected || !authorised(request, expected)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = await readBody(request);
  const from = firstValue(body, FROM_KEYS);
  const text = firstValue(body, TEXT_KEYS);

  if (from.length === 0) {
    // A delivery receipt, a status callback, or a shape we do not know. 200
    // rather than 400: an aggregator that gets an error retries, and
    // retrying a message with no sender achieves nothing but load.
    logger.info("inbound sms with no sender, ignored", { keys: Object.keys(body) });
    return new NextResponse("", { status: 200 });
  }

  const { command, reply } = await handleInboundSms({ from, text });

  // The message body is never logged. It carries a pack code, which is a
  // bearer token worth money until it is spent, and this log is the one
  // place it would sit in plaintext outside the row that owns it.
  logger.info("inbound sms handled", { command, replied: reply.length > 0 });

  return new NextResponse(reply, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
