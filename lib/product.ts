/**
 * The consumer-facing product name, in one place.
 *
 * Every shopper-visible use of it goes through here - the wordmark, page
 * metadata and the outbound SMS body - so the name is a constant rather
 * than a string scattered across pages. That was written when the name was
 * still a working title, and it earned its keep: the rename from the
 * working title to Qumo was this line.
 *
 * Deliberately not used inside comments or component names: those are read
 * by developers, and churning them adds diff noise without helping anyone.
 */
export const PRODUCT_NAME = "Qumo";

/**
 * The operating company as a shopper reads it in prose.
 *
 * Short on purpose. "QUMO-APP (PTY) LTD answers for your account" is
 * correct and nobody finishes the sentence, so the legal person is named
 * once, exactly, in OPERATOR_LEGAL_NAME below, and the prose uses this.
 *
 * The caveat this comment used to carry is resolved: the name is no longer
 * merely lodged with CIPC. It is a registered company, and the two
 * constants under this one are what a privacy notice has to carry to
 * identify a responsible party rather than gesture at one.
 */
export const OPERATOR_NAME = "Qumo";

/**
 * The legal person behind the product, named where identification is the
 * point rather than readability: the foot of the privacy notice and the
 * terms, and the page that tells a shopper how to reach us.
 *
 * POPIA expects a data subject to be told who holds their information, by
 * a name they could take to the Regulator. "Qumo" is not that name.
 *
 * Taken from the footer published on qumo.co.za and recorded in
 * docs/legal-engagement.md, which also carries the standing instruction
 * attached to it: confirm the number against the CIPC certificate before
 * anything is filed on it.
 */
export const OPERATOR_LEGAL_NAME = "QUMO-APP (PTY) LTD";
export const OPERATOR_REGISTRATION = "2026/858757/07";

/**
 * Where a shopper reaches Qumo rather than the brand they scanned.
 *
 * ── Why this constant is load-bearing ────────────────────────────────────
 *
 * Until it existed there was no route at all. Every path to us ran through
 * whichever brand a shopper happened to scan, which is fine for an
 * operator acting on a brand's instructions and not fine for a responsible
 * party: the account, the mobile number, the age confirmation and this
 * agreement are ours, held once across every brand, and a brand cannot
 * answer for a record it has never seen. A shopper with a question about
 * their number was being sent to the one party that does not hold it.
 *
 * ── The thing to check before a pilot ────────────────────────────────────
 *
 * A published address that bounces is worse than the silence it replaced.
 * This has to deliver somewhere a person actually reads before the first
 * real shopper is shown it. It is an open item in docs/open-items.md for
 * exactly that reason, and it is not something the code can verify.
 */
export const SHOPPER_SUPPORT_EMAIL = "help@qumo.co.za";
