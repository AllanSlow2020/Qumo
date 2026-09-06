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

/**
 * The operating company, named in the consent copy, the privacy notice and
 * the terms.
 *
 * Qumo, which is the name lodged with CIPC as first preference — see
 * docs/qumo-architecture.md for the tracking number and the fallbacks. It
 * used to name a different entity, inherited from before Qumo was its own
 * product, and leaving it there would have made the privacy notice say a
 * company holds your phone number when a different one does.
 *
 * One caveat, and it is worth knowing rather than discovering: a name that
 * is lodged is not yet a registered company, so this names the business
 * rather than a legal person. If registration lands under one of the
 * fallbacks, this line and WEB_CONSENT_VERSION move together — a rendered
 * consent string that changed without its version bumping is precisely the
 * question the version exists to answer.
 */
export const OPERATOR_NAME = "Qumo";
