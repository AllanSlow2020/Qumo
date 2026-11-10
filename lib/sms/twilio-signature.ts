import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio's request signature, which is what makes the inbound SMS webhook
 * something other than a public endpoint.
 *
 * ── Why this exists when a shared secret already did ─────────────────────
 *
 * The route used to accept a bearer token, and would take it from the query
 * string as well as a header. Both halves of that were a problem.
 *
 * The query string, because a secret in a URL does not stay where you put
 * it. Twilio's own request inspector records the full URL of every webhook
 * it calls, the platform logs it, and anyone who can read either can
 * replay it. A long-lived credential that leaks into two log stores by
 * design is not a credential.
 *
 * The header, because Twilio's messaging webhook configuration has nowhere
 * to put one. That is why the query-string path was there at all, so
 * "header only" would not have been a fix, it would have been an outage.
 *
 * And a shared secret, however it travels, authenticates the *caller*
 * rather than the *message*. Whoever holds it can post any `From` they
 * like. That matters more here than it would almost anywhere else, because
 * of what an inbound message can do: read any person's balance, claim a
 * pack code into somebody else's account, opt a number out, and - worst of
 * the four - answer YES, which writes a consent record for a number that
 * never consented. The entire lawful basis for processing in this product
 * is consent, so a forged consent does not just leak data, it corrupts the
 * evidence we would answer a regulator with.
 *
 * A signature authenticates the message. The sender, the body and the URL
 * are all inside what was signed, so changing any of them invalidates it,
 * and producing a valid one needs the account's own credential rather than
 * something that was sitting in a log.
 *
 * ── The credential, and the trade this makes ─────────────────────────────
 *
 * Twilio signs with the account's Auth Token. Not an API key secret: there
 * is no way to validate a signature with one, so this is not a choice
 * between credentials.
 *
 * That is worth stating plainly, because sending deliberately moved off the
 * auth token and onto a scoped API key, and this asks for the auth token
 * back in the environment. The reasoning for accepting that:
 *
 *   - it is read here and used for a local HMAC. It is never sent anywhere,
 *     to Twilio or to anyone else, unlike a credential used for sending.
 *   - an attacker who can read it can also read DATABASE_URL,
 *     ENCRYPTION_KEY and PHONE_HASH_SECRET, which are already there. The
 *     worst case does not get worse; a live forgery path gets closed.
 *   - Twilio issues a secondary auth token, so this can be rotated without
 *     the all-at-once breakage that made the primary token unattractive for
 *     sending.
 *
 * The API key keeps doing the sending. This does the verifying.
 *
 * ── The algorithm ────────────────────────────────────────────────────────
 *
 * Twilio builds the signed string by taking the full URL it called, then
 * appending each POST parameter as name followed by value, in order of
 * name, and HMAC-SHA1s the result with the auth token. So every parameter
 * is covered, and so is the URL - which means a signature captured for one
 * endpoint cannot be replayed against another.
 *
 * Sorting is by code unit, which is what `Array.prototype.sort` does by
 * default and what Twilio's own libraries rely on.
 */

/** The header Twilio puts the signature in. */
export const TWILIO_SIGNATURE_HEADER = "x-twilio-signature";

/**
 * The string Twilio signed: the URL, then every parameter in name order.
 *
 * Exported for the test, which is the only way to see that the ordering is
 * right - a wrong order produces a wrong digest and nothing else, so it
 * fails as "signature invalid" and looks like a configuration problem.
 */
export function signedPayload(url: string, params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
}

/**
 * True when `supplied` is the signature Twilio would have sent for this
 * URL and these parameters.
 *
 * Constant time, like every other secret comparison in this repo. Here it
 * matters a little more than usual: an attacker can ask for as many
 * comparisons as they like, against a digest they are trying to guess.
 */
export function twilioSignatureValid(
  authToken: string,
  url: string,
  params: Record<string, string>,
  supplied: string | null,
): boolean {
  if (!authToken || !supplied) return false;

  const expected = createHmac("sha1", authToken).update(signedPayload(url, params), "utf8").digest("base64");

  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The URL to verify against, which has to be the one Twilio called rather
 * than the one this process thinks it is serving.
 *
 * Those differ, and that is the usual reason a correct implementation of
 * the algorithm above still rejects every request. Behind a proxy the
 * inbound request carries an internal host; the signature was computed
 * over the public one. `x-forwarded-proto` and `x-forwarded-host` are the
 * platform's statement of what the caller actually asked for, so they are
 * what gets reconstructed from.
 *
 * TWILIO_WEBHOOK_URL overrides all of it, and is the reliable option: it is
 * the exact string configured in the Twilio console, so there is nothing to
 * infer and no proxy to second-guess. Worth setting if this ever sits
 * behind something that rewrites more than Vercel does.
 *
 * The query string is kept. Twilio signs the URL it was given, so if the
 * configured webhook carries parameters they are part of what was signed.
 */
export function webhookUrl(request: Request, configured: string | undefined): string {
  const explicit = configured?.trim();
  if (explicit) return explicit;

  const incoming = new URL(request.url);
  const headers = request.headers;
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || incoming.protocol.replace(":", "");
  const host = headers.get("x-forwarded-host")?.split(",")[0]?.trim() || headers.get("host") || incoming.host;

  return `${proto}://${host}${incoming.pathname}${incoming.search}`;
}
