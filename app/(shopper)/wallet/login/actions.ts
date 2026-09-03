"use server";

import { requestOtp, verifyOtp, OtpError } from "@/lib/consumer/otp";
import { InvalidPhoneNumberError } from "@/lib/consumer/phone";
import { setConsumerSession } from "@/lib/consumer/session";
import { logger } from "@/lib/security/logger";
import { loginAttemptAllowed, TOO_MANY_ATTEMPTS } from "@/lib/security/login-guard";

export type ActionResult = { ok: true; phoneE164?: string } | { ok: false; error: string };

/**
 * Both actions below funnel every error through here. OtpError and
 * InvalidPhoneNumberError carry messages written to be read by a shopper,
 * so those pass through unchanged; anything else is a bug or an outage and
 * gets a generic sentence, because the alternative is leaking a stack
 * trace or a Prisma error into someone's phone screen.
 */
function toResult(err: unknown, context: string): ActionResult {
  if (err instanceof OtpError || err instanceof InvalidPhoneNumberError) {
    return { ok: false, error: err.message };
  }
  logger.error(`consumer login failed (${context})`, { err: String(err) });
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function requestCode(phone: string): Promise<ActionResult> {
  try {
    // Before the phone number is even parsed: the per-number limits inside
    // requestOtp cannot see someone working through a list of numbers, and
    // this can.
    if (!(await loginAttemptAllowed("shopper"))) {
      return { ok: false, error: TOO_MANY_ATTEMPTS };
    }
    const { phoneE164 } = await requestOtp(phone);
    return { ok: true, phoneE164 };
  } catch (err) {
    return toResult(err, "request");
  }
}

export async function submitCode(phone: string, code: string, consented: boolean): Promise<ActionResult> {
  try {
    if (!(await loginAttemptAllowed("shopper"))) {
      return { ok: false, error: TOO_MANY_ATTEMPTS };
    }
    // Passed through rather than assumed from the client's own validation:
    // the checkbox being `required` in the markup stops an honest mistake,
    // not a crafted request, and the consent record has to mean something.
    const person = await verifyOtp(phone, code, consented);
    await setConsumerSession(person.id);
    return { ok: true };
  } catch (err) {
    return toResult(err, "verify");
  }
}
