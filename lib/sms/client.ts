import { logger } from "@/lib/security/logger";
import { isPreviewDeployment } from "@/lib/env/deployment";

/**
 * Outbound SMS, used only for shopper login one-time passcodes.
 *
 * Written as an interface with a logging fallback for the same reason
 * EmailClient and WhatsAppClient are: the provider account (Twilio Verify
 * or Clickatell — still to be provisioned) is not something this build can
 * create, and the whole login flow has to be runnable and testable before
 * it exists. With no credentials set, the passcode is logged instead of
 * sent and the flow works end to end locally.
 */
export interface SmsClient {
  sendSms(toE164: string, message: string): Promise<void>;
}

export class SmsSendError extends Error {}

/**
 * Twilio's Messages API over plain fetch — no SDK, since one POST with
 * basic auth does not justify the dependency.
 *
 * Note this is Twilio *Messaging*, not Twilio *Verify*. Verify would own
 * code generation, expiry and attempt-counting itself, which sounds
 * appealing until you notice it puts the security properties of shopper
 * login inside a vendor we cannot test against and cannot audit. Keeping
 * the code lifecycle in lib/consumer/otp.ts — with its own hashing,
 * expiry, attempt cap and single-use guarantee — means the rules are in
 * this repository, covered by tests, and identical whichever provider ends
 * up sending the message. Switching to Clickatell is then one class here,
 * not a rewrite of the login flow.
 */
export class TwilioSmsClient implements SmsClient {
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber: string,
  ) {}

  async sendSms(toE164: string, message: string): Promise<void> {
    const body = new URLSearchParams({ To: toE164, From: this.fromNumber, Body: message });
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      // The provider's own error text can carry the destination number, so
      // it is deliberately not echoed into the thrown message — the status
      // is enough to diagnose, and the caller turns this into a generic
      // "we couldn't send that code" for the shopper anyway.
      throw new SmsSendError(`SMS provider rejected the send (HTTP ${response.status})`);
    }
  }
}

/**
 * Stands in whenever no SMS credentials are configured. Logs the passcode
 * rather than sending it, so `pnpm dev` can complete a login by reading
 * the console — the same role LoggingEmailClient plays for reset links,
 * and held to the same standard: dev-only console output, never a path
 * that runs in production with real credentials absent by accident.
 */
export class LoggingSmsClient implements SmsClient {
  async sendSms(toE164: string, message: string): Promise<void> {
    logger.info("sms (simulated) send", { toE164, message });
  }
}

let cachedClient: SmsClient | undefined;

export function getSmsClient(): SmsClient {
  if (!cachedClient) {
    // Same reasoning as getEmailClient(): Preview deployments share
    // Production's credentials, so a preview build must never put a real
    // SMS on a real phone (or spend real money doing it).
    const accountSid = isPreviewDeployment() ? undefined : process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    cachedClient =
      accountSid && authToken && fromNumber
        ? new TwilioSmsClient(accountSid, authToken, fromNumber)
        : new LoggingSmsClient();
  }
  return cachedClient;
}
