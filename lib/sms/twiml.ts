/**
 * The reply envelope Twilio expects.
 *
 * ── Why this file exists now and not before ──────────────────────────────
 *
 * app/api/sms/inbound/route.ts was written before an aggregator had been
 * chosen, so it read the two encodings every provider uses and answered in
 * plain text, with a comment saying the reply envelope is the one genuinely
 * provider-specific part and would be one function written when we knew.
 * We know. The number is a Twilio number, Twilio posts form-encoded with
 * `From` and `Body` (both already in the route's key lists), and Twilio
 * wants TwiML back.
 *
 * Until this, a shopper who texted the number got a 200 with a body Twilio
 * could not parse, which Twilio treats as an application error: it logs
 * 12200 "Schema validation warning" and sends the shopper nothing at all.
 * So the channel looked like it worked from our side and was silence from
 * theirs, which is the worst of the three possible outcomes.
 *
 * ── On signatures, which this deliberately does not use ──────────────────
 *
 * Twilio can sign every webhook with `X-Twilio-Signature`, and validating
 * it is stronger than the shared secret in the URL that the route uses
 * today. It is not adopted here because the signature is computed with the
 * account auth token, which is the exact credential we have just finished
 * moving production off: adopting it would make the master credential for
 * the whole Twilio account load-bearing again, to protect an endpoint that
 * is already behind a constant-time secret comparison. If Twilio ever
 * supports signing with a scoped key, that is the moment to revisit.
 */

/**
 * XML text content, with the five characters that can end it escaped.
 *
 * Only the first three can actually break text content; the quote forms
 * matter in attributes and are escaped anyway, because the day somebody
 * reuses this helper for an attribute is not the day to discover which
 * three it covered. Twilio's parser decodes all five before the message is
 * sent, so a shopper never sees an entity.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A TwiML document carrying one message, or none.
 *
 * An empty reply has to be an empty `<Response/>` rather than an empty
 * body: it is how you tell Twilio "received, say nothing", and it is the
 * right answer to a throttled sender and to a delivery receipt. An empty
 * body would be the schema warning again, for a message we meant to let
 * pass in silence.
 */
export function twimlReply(reply: string): string {
  const body = reply.trim().length > 0 ? `<Message>${escapeXml(reply)}</Message>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

/** What the response has to be served as, or Twilio will not parse it. */
export const TWIML_CONTENT_TYPE = "text/xml; charset=utf-8";
