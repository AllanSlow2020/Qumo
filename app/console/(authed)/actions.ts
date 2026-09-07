"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revokeStaffSessionByToken, revokeAllStaffSessions, getStaffSession } from "@/lib/staff/session";
import { STAFF_SESSION_COOKIE } from "@/lib/staff/session-cookie";

async function clearCookie() {
  (await cookies()).delete(STAFF_SESSION_COOKIE);
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(STAFF_SESSION_COOKIE)?.value;
  // Revoke the row before dropping the cookie. The other order leaves a live
  // session nobody holds a reference to - harmless until the token was
  // copied off the machine first, which is the case that matters.
  if (token) {
    await revokeStaffSessionByToken(token, "SIGNED_OUT");
  }
  await clearCookie();
  redirect("/login");
}

export async function signOutEverywhere(): Promise<void> {
  const session = await getStaffSession();
  if (session) {
    await revokeAllStaffSessions(session.userId, "SIGNED_OUT_EVERYWHERE");
  }
  await clearCookie();
  redirect("/login");
}
