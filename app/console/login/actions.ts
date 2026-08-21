"use server";

import { cookies } from "next/headers";
import { signInStaff, LOGIN_FAILED } from "@/lib/staff/login";
import { STAFF_SESSION_COOKIE } from "@/lib/staff/session-cookie";

export type LoginState = { error: string | null };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const result = await signInStaff(email, password);
  if (!result.ok) {
    return { error: result.error || LOGIN_FAILED };
  }

  (await cookies()).set(STAFF_SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    // Off on http://app.localhost so the console can be developed; on for
    // anything else. A cookie carrying a staff session must not travel in
    // clear over a real network.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Twelve hours, matching the session row's own expiry. The row is the
    // authority — a cookie outliving it just means one wasted round trip —
    // but a cookie that outlives it by weeks is a token sitting on a shared
    // desktop long after it stopped working, and there is no reason to keep
    // one.
    maxAge: 12 * 60 * 60,
  });

  return { error: null };
}
