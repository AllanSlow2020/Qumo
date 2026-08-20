/**
 * The consumer session cookie's name, alone in its own module.
 *
 * proxy.ts runs in the Edge runtime, where node:crypto is unavailable —
 * importing it from lib/consumer/session.ts would drag createHmac into the
 * edge bundle and break the build. Keeping the name here lets the proxy and
 * the verifier agree on it without the proxy pulling in any crypto.
 */
export const CONSUMER_SESSION_COOKIE = "qumo_shopper";
