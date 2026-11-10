import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { handleInboundSms } from "@/lib/sms/inbound";
import { twimlReply, TWIML_CONTENT_TYPE } from "@/lib/sms/twiml";
import { logger } from "@/lib/security/logger";
import { TWILIO_SIGNATURE_HEADER, twilioSignatureValid, webhookUrl } from "@/lib/sms/twilio-signature";

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
 * Hence: Twilio's own request signature, and no path through this file that
 * reaches handleInboundSms() without it. A shared bearer secret remains as
 * a fallback for a provider that cannot sign, and the difference between
 * the two is the whole point - a secret proves who called, a signature
 * proves what they said. See lib/sms/twilio-signature.ts, which carries the
 * reasoning and the credential trade.
 *
 * ── Why it refuses when nothing is configured ────────────────────────────
 *
 * With neither TWILIO_AUTH_TOKEN nor SMS_WEBHOOK_SECRET set, every request
 * 401s. That is deliberate and it is the same choice the cron routes make:
 * the failure mode of "not configured yet" has to be the safe one, because
 * "not configured yet" is the state every deployment starts in and some of
 * them stay in.
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
 * TwiML, Africa's Talking wants JSON, others take plain text. That was one
 * function, written when we knew, and it is now lib/sms/twiml.ts. The
 * number is a Twilio number, so TwiML is what goes back. Nothing else in
 * this file moved, which is what the split was for.
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
 */
function secretMatches(supplied: string | null, expected: string): boolean {
  if (!supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The bearer fallback, for an aggregator that cannot sign.
 *
 * Header only. This used to read the token from the query string too, and
 * that is gone: a secret in a URL is recorded by the provider's request
 * inspector and by the platform's logs, so it leaks by design rather than
 * by accident. The reasoning is in lib/sms/twilio-signature.ts.
 *
 * Which means this path no longer works for Twilio, whose webhook
 * configuration has nowhere to put a header - and that is the point. For
 * Twilio the signature is the mechanism; this exists for whatever is wired
 * up next, and only until that one can be verified properly too.
 */
function bearerAuthorised(request: NextRequest, expected: string): boolean {
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  return secretMatches(bearer, expected);
}

/**
 * Why this is a ladder rather than a set of alternatives.
 *
 * When an auth token is configured, a valid signature is *required* and the
 * bearer secret is not consulted at all. Accepting either would mean the
 * weaker of the two decides what an attacker has to defeat, which is the
 * same as not having added the stronger one.
 *
 * A signature can only be checked over form parameters, because that is
 * what the scheme covers and what Twilio sends. A JSON body with an auth
 * token configured is therefore refused rather than waved through on the
 * bearer secret: it is not Twilio, so it is not something this deployment
 * is expecting.
 *
 * With neither configured, everything is refused. That is the same choice
 * the cron routes make, and for the same reason: "not configured yet" is
 * the state every deployment begins in, so it has to be the safe one.
 */
function authorised(request: NextRequest, params: Record<string, string> | null): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (authToken) {
    if (!params) return false;
    const url = webhookUrl(request, process.env.TWILIO_WEBHOOK_URL);
    return twilioSignatureValid(authToken, url, params, request.headers.get(TWILIO_SIGNATURE_HEADER));
  }

  const secret = process.env.SMS_WEBHOOK_SECRET?.trim();
  if (secret) return bearerAuthorised(request, secret);

  return false;
}

/**
 * The parsed body, plus the form parameters separately when that is what
 * arrived.
 *
 * Two shapes out rather than one, because the signature check needs the
 * form parameters as the strings they were sent as, while the field
 * extraction below wants anything it can read a sender out of. `form` is
 * null for a JSON body, which is how authorised() knows a signature cannot
 * be checked over it.
 */
type ParsedBody = { record: Record<string, unknown>; form: Record<string, string> | null };

async function readBody(request: NextRequest): Promise<ParsedBody> {
  const type = request.headers.get("content-type") ?? "";

  if (type.includes("application/json")) {
    try {
      const parsed: unknown = await request.json();
      const record = parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
      return { record, form: null };
    } catch {
      return { record: {}, form: null };
    }
  }

  if (type.includes("form")) {
    const data = await request.formData();
    const form = Object.fromEntries([...data.entries()].map(([key, value]) => [key, String(value)]));
    return { record: form, form };
  }

  return { record: {}, form: null };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  /*
   * Read before authenticating, which is the opposite of the usual order
   * and is forced by the signature covering the POST parameters: there is
   * no way to verify it without them.
   *
   * What that costs is parsing a body for a request that turns out to be
   * refused, bounded by the framework's own body limit. What it does not
   * cost is any action on that body - nothing below this line runs until
   * authorised() has returned true.
   */
  const { record, form } = await readBody(request);

  if (!authorised(request, form)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const from = firstValue(record, FROM_KEYS);
  const text = firstValue(record, TEXT_KEYS);

  if (from.length === 0) {
    // A delivery receipt, a status callback, or a shape we do not know. 200
    // rather than 400: an aggregator that gets an error retries, and
    // retrying a message with no sender achieves nothing but load.
    logger.info("inbound sms with no sender, ignored", { keys: Object.keys(record) });
    // Empty TwiML rather than an empty body. Twilio reads anything it
    // cannot parse as an application error and logs a schema warning for
    // it, and a delivery receipt we meant to let pass in silence is not
    // worth one of those.
    return new NextResponse(twimlReply(""), {
      status: 200,
      headers: { "content-type": TWIML_CONTENT_TYPE, "cache-control": "no-store" },
    });
  }

  const { command, reply } = await handleInboundSms({ from, text });

  // The message body is never logged. It carries a pack code, which is a
  // bearer token worth money until it is spent, and this log is the one
  // place it would sit in plaintext outside the row that owns it.
  logger.info("inbound sms handled", { command, replied: reply.length > 0 });

  return new NextResponse(twimlReply(reply), {
    status: 200,
    headers: { "content-type": TWIML_CONTENT_TYPE, "cache-control": "no-store" },
  });
}
