"use server";

import { clearConsumerSession, getConsumerSession, revokeAllSessions } from "@/lib/consumer/session";

/**
 * These end a session and then return. They do not redirect, and that is a
 * decision rather than an omission.
 *
 * `redirect()` inside a server action is resolved against the dev server's
 * own origin rather than the host the request arrived on, so on
 * chicken-licken.qumo.co.za it fetched the next page from the apex and
 * rendered "this link needs a brand" under a perfectly correct URL. Making
 * the redirect absolute did not help: the Location was right and the
 * router's data fetch still went to the wrong origin.
 *
 * So navigation happens on the client, where the browser resolves it against
 * the page it is already on and the subdomain cannot be lost. It is the same
 * shape the login form has always used. See the sign-out button component.
 *
 * This shipped broken in Phase D — signing out landed a shopper on the
 * no-brand page — because the test asserted the session row was revoked,
 * which it was, and never looked at the resulting screen.
 */

export async function signOut(): Promise<void> {
  await clearConsumerSession();
}

/**
 * Ends every session this person has, including this one.
 *
 * The personId comes from the verified session rather than a form field,
 * because a form field would let anyone post someone else's id and sign
 * them out of everything — a denial of service that needs no stolen
 * credential at all.
 */
export async function signOutEverywhere(): Promise<void> {
  const personId = await getConsumerSession();
  if (personId) {
    await revokeAllSessions(personId);
  }
  // Clears this device's cookie too. revokeAllSessions already killed the
  // row, so this is only tidying up a cookie that no longer verifies.
  await clearConsumerSession();
}
