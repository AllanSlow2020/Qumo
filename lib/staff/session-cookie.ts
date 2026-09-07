/**
 * The staff session cookie's name, alone in its own module for the same
 * reason CONSUMER_SESSION_COOKIE is: proxy.ts runs in the Edge runtime,
 * where node:crypto is unavailable, and importing it from session.ts would
 * drag createHash into the edge bundle.
 *
 * A different name from the shopper's, on a different host, verified against
 * a different table. Three separations for one boundary, because this is the
 * boundary where a mistake promotes a customer to an administrator.
 */
export const STAFF_SESSION_COOKIE = "qumo_staff";
