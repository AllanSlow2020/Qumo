"use server";

import { cookies } from "next/headers";
import { signInStaff, LOGIN_FAILED } from "@/lib/staff/login";
import { STAFF_SESSION_COOKIE } from "@/lib/staff/session-cookie";
import { loginAttemptAllowed, TOO_MANY_ATTEMPTS } from "@/lib/security/login-guard";

export type LoginState = {
  /**
   * Explicit, and not inferred from "error is null".
   *
   * The form used to treat a null error as success. The second-factor
   * prompt is also a null error - the password was right and nothing has
   * gone wrong - so without this flag asking for a code would have been
   * read as a successful sign-in and navigated straight to the console.
   */
  ok?: boolean;
  error: string | null;
  /**
   * The password was accepted and a code is wanted. The form keeps the
   * password in component state rather than a hidden input - it is a client
   * component, so the value never renders into the HTML - and sends all
   * three on the next attempt.
   */
  secondFactorRequired?: boolean;
};

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  // Ahead of signInStaff, so a machine guessing passwords is stopped
  // before it costs a scrypt verification each time - the work factor that
  // makes the hash strong also makes an unlimited guess rate expensive for
  // us rather than for them.
  if (!(await loginAttemptAllowed("staff"))) {
    return { error: TOO_MANY_ATTEMPTS };
  }

  const result = await signInStaff(email, password, code || undefined);
  if (!result.ok) {
    if (result.secondFactorRequired) {
      return { error: result.error, secondFactorRequired: true };
    }
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
    // authority - a cookie outliving it just means one wasted round trip -
    // but a cookie that outlives it by weeks is a token sitting on a shared
    // desktop long after it stopped working, and there is no reason to keep
    // one.
    maxAge: 12 * 60 * 60,
  });

  return { ok: true, error: null };
}
