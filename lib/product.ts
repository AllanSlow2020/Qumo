/**
 * The consumer-facing product name, in one place.
 *
 * Every shopper-visible use of it goes through here — the wordmark, page
 * metadata and the outbound SMS body — so the name is a constant rather
 * than a string scattered across pages. That was written when the name was
 * still a working title, and it earned its keep: the rename from the
 * working title to Qumo was this line.
 *
 * Deliberately not used inside comments or component names: those are read
 * by developers, and churning them adds diff noise without helping anyone.
 */
export const PRODUCT_NAME = "Qumo";

/** The operating company, named in consent copy and the privacy notice. */
export const OPERATOR_NAME = "Nexus Prime International";
