import { OPERATOR_NAME, PRODUCT_NAME } from "@/lib/product";

/**
 * What a shopper agrees to when they register on the web, and the version
 * that agreement is recorded under.
 *
 * The WhatsApp channel shows different words and keeps its own copy in
 * lib/conversation/consent.ts. Two versions rather than one shared
 * constant, because a single constant would stamp a WhatsApp member and a
 * web shopper identically while they had read entirely different things,
 * and an audit would answer the question confidently and wrongly.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  NOT YET REVIEWED BY A LAWYER. Written in good faith to describe what the
 *  system actually does, and deliberately claiming nothing it does not. It
 *  must be reviewed against POPIA BEFORE the first real shopper registers,
 *  because retrofitting consent onto people who already signed up is
 *  materially harder than getting it right once.
 *
 *  It says what it says deliberately. docs/popia.md used to carry the
 *  operator vs responsible party question as open, while this file quietly
 *  answered it - it told shoppers Qumo held everything "on behalf of the
 *  brands", which is operator language, and the schema disagrees: Person
 *  has no brandId, phoneHash is unique across the whole platform, and
 *  consent and the age confirmation are taken once by us and reused for
 *  every brand. A notice cannot abstain. Leaving it vague would still have
 *  been an answer, just an unexamined one, so it now describes the split
 *  the code actually implements and the brief argues for the same split in
 *  the same words. A lawyer who lands somewhere else changes both.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Bump the version whenever the wording changes in substance. Rows keep the
 * version they were captured under and nothing is rewritten, so an audit can
 * always answer what a given person actually saw. A shopper whose recorded
 * version is behind re-affirms on their next sign-in (lib/consumer/otp.ts).
 */
export const WEB_CONSENT_VERSION = "web-v5";

/**
 * web-v1 said the same things under the product's old working title. That
 * is not a change of substance in what is collected or who holds it - but
 * the *rendered string* changed, so leaving the version alone would make a
 * web-v1 row resolve to copy naming a product that person never saw. That
 * is precisely the question the version exists to answer, so it is bumped.
 * Anyone on web-v1 re-affirms on their next sign-in.
 *
 * web-v2 named a different operating company. Qumo is the entity now, and
 * "who holds my phone number" is the one fact in this notice a person is
 * most entitled to have been told correctly - so it is a change of
 * substance, not just of string. The same bump also picks up the terms,
 * which the tick box now points at alongside the notice: the two documents
 * arrived at different times and rewriting versioned consent copy twice is
 * worse than rewriting it once.
 *
 * web-v3 said we would delete an account and its history on request. That
 * was more than this system can do and more than it should: every ledger
 * entry hangs off the person, so deleting the row would take a brand's
 * record of what it issued with it and move their liability for a quarter
 * that has already closed. What deletion actually does is erase everything
 * identifying and leave an anonymous financial record - see
 * lib/consumer/erase.ts. Narrowing a promise is the clearest case there is
 * of a change in substance, so it is a bump, not an edit.
 *
 * The same correction moved deletion from "contact us and we will action
 * it" to a button on the shopper's own details page, which is the part of
 * this change that is in their favour.
 *
 * web-v4 said Qumo holds this information "on behalf of the
 * brands you interact with". Read against POPIA that is a claim about who
 * answers to the shopper, and it points at the brand. The schema points the
 * other way for everything that identifies a person: Person carries no
 * brandId, phoneHash is unique platform-wide, and the consent and the age
 * confirmation are taken once and honoured for every brand a person goes on
 * to use. A brand cannot answer for a record it cannot see, so telling a
 * shopper to take their number up with the brand was sending them to the one
 * party that does not hold it.
 *
 * So web-v5 splits the answer: the account is ours and each brand's
 * programme is the brand's. It is the largest change of substance this
 * notice has had, because it changes who the shopper is being told to
 * complain to. It also costs nothing today - there are no real shoppers, so
 * nobody is re-consented by it, which is precisely why it is being made now
 * rather than after a pilot.
 */

/** The single line beside the tick box. Kept short enough to actually be read. */
export const CONSENT_CHECKBOX_LABEL = `I agree to ${PRODUCT_NAME} storing my mobile number and my activity with the brands I scan, as described in the privacy notice and the terms.`;

/**
 * The fuller notice, rendered at /legal/privacy and linked from the tick
 * box. Each point describes something the code genuinely does - if a claim
 * here stops being true, the code changed and this list is now a lie.
 */
export const CONSENT_POINTS: { heading: string; body: string }[] = [
  {
    heading: "What we keep",
    body: `Your mobile number, and a record of every scan, reward and redemption you make with brands on ${PRODUCT_NAME}. Your number is stored encrypted, and is used to sign you in and to send you one-time codes. You have one account here however many brands you use, so the number is held once, by us, rather than once per brand.`,
  },
  {
    heading: "What brands can see",
    body: "A brand can see your activity with that brand only: the scans you made, the rewards you earned and what you have spent with them. A brand cannot see your activity with any other brand, or that you use any other brand at all. It also never sees your mobile number. The brand's screens identify you by a membership that belongs to them, and the number stays with us.",
  },
  {
    heading: "Who answers for what",
    body: `Two parties, and the split is worth knowing if you ever want to take something up with somebody. ${OPERATOR_NAME} answers for your account: your mobile number, your age confirmation, this agreement, and keeping all of it secure. Those are ours, they are held once for you across every brand, and no brand sees them. Each brand answers for its own programme: what it offers, what a scan is worth, and the record of what you earned with them. The brand is where you start for either kind of question, and anything that is ours they bring to us. A way to reach ${OPERATOR_NAME} directly is not built yet, and this notice will say so until it is.`,
  },
  {
    heading: "Your balances",
    body: "Points, stamps and wallet value are earned with one brand and can only be used with that brand. They are not money, cannot be transferred between brands, and cannot be exchanged for cash.",
  },
  {
    heading: "Your choices",
    body: `You can download a copy of everything we hold about you, leave any brand's programme, or delete your account, all from your own details page and without asking anyone. Deleting removes your number, your name and anything else that identifies you. The record that a reward was earned on a date stays with the brand, because it is their financial record and once your details are gone it is no longer about you.`,
  },
  {
    heading: "Marketing",
    body: "We will send you the one-time codes you ask for. We will not send you marketing messages on the strength of this agreement alone. If a brand wants to market to you, you will be asked separately.",
  },
];

/**
 * What a number sees before it replies YES, and the version that reply is
 * recorded under.
 *
 * Its own version rather than the web one, for the reason the note at the
 * top of this file gives: a version exists to answer "what did this person
 * actually read", and stamping an SMS joiner as web-v3 would answer it
 * confidently and wrongly. They read two sentences on a feature phone, not
 * a tick box beside a linked notice.
 *
 * ── Why there is no link in it ───────────────────────────────────────────
 *
 * The obvious move is to put /legal/privacy in the message and let the
 * detail live there. It is the wrong move twice over. This channel exists
 * for people who cannot open a web page, so a link is the one thing we know
 * the reader cannot follow; and the notice is served per brand, under the
 * brand's own subdomain, while a bare YES names no brand to build a URL
 * from.
 *
 * So the full text is reachable the way everything else here is: by replying
 * to the message. TERMS costs nothing when nobody sends it, and works on the
 * handset the person is already holding.
 */
/**
 * sms-v1 pointed at a notice that promised outright deletion, because
 * SMS_TERMS_BODY is built from CONSENT_POINTS and CONSENT_POINTS said so.
 * The same correction that produced web-v4 changed what a TERMS reply
 * sends, and the joiner was told TERMS is where the full notice lives, so
 * it is part of what they agreed to and this bumps with it.
 *
 * ── A gap this exposes, named rather than papered over ───────────────────
 *
 * A web shopper on a stale version re-affirms on their next sign-in
 * (lib/consumer/otp.ts). An SMS joiner has no next sign-in: they text a
 * code and it earns. So there is currently no path by which somebody who
 * joined under sms-v1 is ever shown sms-v2, and bumping the constant does
 * not create one. It costs nothing today because no aggregator is
 * connected and nobody has joined this way. It has to be built before that
 * stops being true, and the natural shape is the same one the web uses:
 * check the version on the next inbound message and send the change before
 * acting on it.
 *
 * sms-v3 follows web-v5 for the same mechanical reason sms-v2 followed
 * web-v4: SMS_TERMS_BODY is built from CONSENT_POINTS, so correcting who
 * answers for what changed what a TERMS reply sends, and the joiner was
 * told TERMS is where the full notice lives. The lead-in sentence below
 * carried the "on behalf of" wording in its own right and is corrected with
 * it.
 */
export const SMS_CONSENT_VERSION = "sms-v3";

/**
 * Sent to an unrecognised number before any account exists for it.
 *
 * Deliberately allowed to run past one segment, where everything else in
 * this channel is squeezed under 160 characters because each segment costs
 * money. This is the one message where that trade goes the other way: it is
 * all the person will have read when they agree, so a second segment is
 * cheaper than a consent record that cannot be defended.
 */
export const SMS_JOIN_TERMS = `${PRODUCT_NAME}: reply YES to join. We keep your number and your scans with the brands you use, and each brand sees only its own. Reply TERMS for the full notice, or HELP for what else you can send.`;

/**
 * The fuller notice, sent on TERMS. Multi-segment by necessity: the point
 * of the command is that somebody asked for the detail, so cutting it to
 * fit would defeat the only reason it exists.
 *
 * Built from CONSENT_POINTS rather than retyped, so the SMS and the web
 * notice cannot drift into saying different things. The order is the order
 * a person needs it in, which is the order the array is already written in.
 *
 * It costs what it costs, and the number is worth knowing before anyone
 * lengthens a point above: correcting who answers for what took this from
 * eleven segments to fifteen. Nobody edits this string, so nobody sees the
 * price of editing the array that builds it. docs/consent-copy.md prints
 * the character and segment count beside the rendered message for exactly
 * that reason. Fifteen segments is still the right trade - this is sent
 * only when somebody asks for it, and a consent record that cannot be
 * defended is more expensive than any number of messages - but a point
 * added here for the sake of completeness is paid for by every shopper who
 * ever replies TERMS.
 */
export const SMS_TERMS_BODY = [`${PRODUCT_NAME} privacy notice. We hold your account. Each brand holds its own programme record.`]
  .concat(CONSENT_POINTS.map((point) => `${point.heading}: ${point.body}`))
  .join("\n\n");
