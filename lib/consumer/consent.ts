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
 *  must be reviewed against POPIA — and rewritten to match whichever
 *  position the business takes — BEFORE the first real shopper registers.
 *  See docs/qumo-design.md §3: the operator vs responsible party decision
 *  changes what this copy has to say, and retrofitting consent onto people
 *  who already signed up is materially harder than getting it right once.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Bump the version whenever the wording changes in substance. Rows keep the
 * version they were captured under and nothing is rewritten, so an audit can
 * always answer what a given person actually saw. A shopper whose recorded
 * version is behind re-affirms on their next sign-in (lib/consumer/otp.ts).
 */
export const WEB_CONSENT_VERSION = "web-v2";

/**
 * web-v1 said the same things under the product's old working title. That
 * is not a change of substance in what is collected or who holds it — but
 * the *rendered string* changed, so leaving the version alone would make a
 * web-v1 row resolve to copy naming a product that person never saw. That
 * is precisely the question the version exists to answer, so it is bumped.
 * Anyone on web-v1 re-affirms on their next sign-in.
 */

/** The single line beside the tick box. Kept short enough to actually be read. */
export const CONSENT_CHECKBOX_LABEL = `I agree to ${PRODUCT_NAME} storing my mobile number and my activity with the brands I scan, as described in the privacy notice.`;

/**
 * The fuller notice, rendered at /legal/privacy and linked from the tick
 * box. Each point describes something the code genuinely does — if a claim
 * here stops being true, the code changed and this list is now a lie.
 */
export const CONSENT_POINTS: { heading: string; body: string }[] = [
  {
    heading: "What we keep",
    body: `Your mobile number, and a record of every scan, reward and redemption you make with brands on ${PRODUCT_NAME}. Your number is stored encrypted, and is used to sign you in and to send you one-time codes.`,
  },
  {
    heading: "What brands can see",
    body: "A brand can see your activity with that brand only — the scans you made, the rewards you earned and what you have spent with them. A brand cannot see your activity with any other brand, or that you use any other brand at all.",
  },
  {
    heading: "Who operates it",
    body: `${PRODUCT_NAME} is operated by ${OPERATOR_NAME}, who holds this information on behalf of the brands you interact with and uses it to run the rewards programme.`,
  },
  {
    heading: "Your balances",
    body: "Points, stamps and wallet value are earned with one brand and can only be used with that brand. They are not money, cannot be transferred between brands, and cannot be exchanged for cash.",
  },
  {
    heading: "Your choices",
    body: `You can ask us for a copy of what we hold about you, ask us to correct it, or ask us to delete your account and its history. Contact ${OPERATOR_NAME} and we will action it.`,
  },
  {
    heading: "Marketing",
    body: "We will send you the one-time codes you ask for. We will not send you marketing messages on the strength of this agreement alone — if a brand wants to market to you, you will be asked separately.",
  },
];
