"use server";

import { redirect } from "next/navigation";
import { clearConsumerSession, getConsumerSession, revokeAllSessions } from "@/lib/consumer/session";

export async function signOut(): Promise<void> {
  await clearConsumerSession();
  redirect("/wallet/login");
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
  redirect("/wallet/login");
}
