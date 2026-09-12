"use server";

import { completeReset } from "@/lib/staff/reset";
import { rateLimit } from "@/lib/security/rate-limit";

export type ResetResult = { ok: true } | { ok: false; error: string };

// On the token, not the person: the token is the only thing a caller has,
// and 32 random bytes is not guessable anyway. This is here to stop a
// broken client retrying forever, not to stop a search.
const LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function setNewPassword(formData: FormData): Promise<ResetResult> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) {
    return { ok: false, error: "Those two passwords don't match." };
  }

  const { allowed } = await rateLimit(`staff-reset-use:${token.slice(0, 16)}`, LIMIT, WINDOW_MS);
  if (!allowed) {
    return { ok: false, error: "Too many attempts. Wait a few minutes and try again." };
  }

  const outcome = await completeReset(token, password);
  if (outcome.ok) {
    return { ok: true };
  }

  return {
    ok: false,
    error:
      outcome.reason === "WEAK"
        ? "Use at least 12 characters."
        : "That link has expired or has already been used. Ask for a new one.",
  };
}
