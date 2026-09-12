"use server";

import { requestReset } from "@/lib/staff/reset";
import { rateLimit } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

/**
 * One outcome, always.
 *
 * There is no failure state a caller is allowed to see, because every one
 * of them would answer "does this address have an account". Even the rate
 * limit returns the same thing: a limiter that says "too many attempts" for
 * real addresses and nothing for others is the enumeration oracle with
 * extra steps.
 */
export type ForgotResult = { sent: true };

// Per address, so one person hammering it cannot stop everybody else
// resetting, and so an attacker walking a list gets one email each rather
// than a mailbox full for one victim.
const LIMIT = 3;
const WINDOW_MS = 15 * 60 * 1000;

export async function requestPasswordReset(formData: FormData): Promise<ForgotResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  const { allowed } = await rateLimit(`staff-reset:${email}`, LIMIT, WINDOW_MS);
  if (!allowed) {
    logger.info("password reset throttled");
    return { sent: true };
  }

  try {
    await requestReset(email);
  } catch (err) {
    // Logged, never shown. A send failure that reached the screen would say
    // "this address exists, we just could not reach it".
    logger.error("password reset request failed", { err: String(err) });
  }

  return { sent: true };
}
