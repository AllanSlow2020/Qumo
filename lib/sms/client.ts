import { logger } from "@/lib/security/logger";
import { isPreviewDeployment } from "@/lib/env/deployment";

/**
 * Outbound SMS, used only for shopper login one-time passcodes.
 *
 * Written as an interface with a logging fallback for the same reason
 * EmailClient and WhatsAppClient are: the provider account is not something
 * this build can create, and the whole login flow has to be runnable and
 * testable before it exists. With no credentials set, the passcode is
 * logged instead of sent and the flow works end to end locally.
 */
export interface SmsClient {
  sendSms(toE164: string, message: string): Promise<void>;
}

/**
 * A send the provider refused.
 *
 * Carries Twilio's numeric error code when there was one, because the HTTP
 * status alone cannot tell a wrong credential from a region that was never
 * switched on, and those need entirely different fixes. The code is a
 * category rather than content - it names no number and quotes no message
 * body - so it is safe to log and safe to print at a terminal. The message
 * a shopper sees is written by lib/consumer/otp.ts and never this one.
 */
export class SmsSendError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: number,
  ) {
    super(message);
  }
}

/**
 * What it takes to authenticate one send.
 *
 * Twilio accepts two different basic-auth identities against the same
 * account, and the distinction is worth spelling out because both are
 * pairs of opaque strings and only one of them is safe to deploy:
 *
 *   - Account SID and Auth Token. The auth token is the master credential
 *     for the entire account. It can buy numbers, spend money, read every
 *     message ever sent, and create the API keys below. It cannot be
 *     scoped, and there is exactly one, so rotating it breaks every other
 *     thing holding it at the same instant.
 *   - An API key SID (`SK...`) and its secret. Revocable on its own,
 *     restrictable to the permissions it actually needs, and issuable one
 *     per consumer so rotating one touches nothing else.
 *
 * The second is what belongs in a deployed application, and it is what
 * this prefers. The first stays supported because it is what a brand new
 * trial account hands you on its dashboard, and refusing it would mean the
 * gap between "signed up" and "a passcode arrives" needs a detour through
 * key management.
 *
 * The account SID is required either way: it identifies the account in the
 * request URL, and an API key authenticates *against* an account rather
 * than replacing it. Supplying the key without the account SID is a
 * configuration that cannot work, which is why resolve() treats it as
 * unconfigured rather than half-configured.
 */
export type TwilioCredentials = {
  /** Always the `AC...` account SID: it addresses the account in the URL. */
  accountSid: string;
  /** The `SK...` API key SID when one is configured, otherwise the account SID. */
  username: string;
  /** The API key secret, or the account auth token. */
  password: string;
  fromNumber: string;
  /** Which of the two identities the username is, for logs and the preflight. */
  kind: "api-key" | "auth-token";
};

/**
 * Reads credentials out of the environment, or returns null if there is no
 * complete set.
 *
 * Split out from getSmsClient() and taking its environment as an argument
 * so the precedence below is testable without reaching for a module cache
 * or mutating process.env: the rules are the interesting part, and they
 * were previously expressed as one long boolean nobody could assert on.
 */
export function resolveTwilioCredentials(
  env: Record<string, string | undefined> = process.env,
): TwilioCredentials | null {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const fromNumber = env.TWILIO_FROM_NUMBER?.trim();
  const keySid = env.TWILIO_API_KEY_SID?.trim();
  const keySecret = env.TWILIO_API_KEY_SECRET?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();

  if (!accountSid || !fromNumber) return null;

  // The API key wins whenever it is complete. A half-set key is not quietly
  // downgraded to the auth token: somebody who has set one of the two
  // meant to use it, and silently sending on the master credential instead
  // is the opposite of what they asked for.
  if (keySid || keySecret) {
    if (!keySid || !keySecret) return null;
    return { accountSid, username: keySid, password: keySecret, fromNumber, kind: "api-key" };
  }

  if (!authToken) return null;
  return { accountSid, username: accountSid, password: authToken, fromNumber, kind: "auth-token" };
}

/**
 * Twilio's Messages API over plain fetch - no SDK, since one POST with
 * basic auth does not justify the dependency.
 *
 * Note this is Twilio *Messaging*, not Twilio *Verify*. Verify would own
 * code generation, expiry and attempt-counting itself, which sounds
 * appealing until you notice it puts the security properties of shopper
 * login inside a vendor we cannot test against and cannot audit. Keeping
 * the code lifecycle in lib/consumer/otp.ts - with its own hashing,
 * expiry, attempt cap and single-use guarantee - means the rules are in
 * this repository, covered by tests, and identical whichever provider ends
 * up sending the message. Switching to a South African aggregator is then
 * one class here, not a rewrite of the login flow.
 */
export class TwilioSmsClient implements SmsClient {
  constructor(private readonly credentials: TwilioCredentials) {}

  /** Exposed for the preflight and the sms:test script, never for a send. */
  get describes(): { accountSid: string; fromNumber: string; kind: TwilioCredentials["kind"] } {
    const { accountSid, fromNumber, kind } = this.credentials;
    return { accountSid, fromNumber, kind };
  }

  async sendSms(toE164: string, message: string): Promise<void> {
    const { accountSid, username, password, fromNumber } = this.credentials;
    const body = new URLSearchParams({ To: toE164, From: fromNumber, Body: message });
    const auth = Buffer.from(`${username}:${password}`).toString("base64");

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      // The provider's own error text can carry the destination number, so
      // it is deliberately not echoed into the thrown message - the status
      // is enough to diagnose, and the caller turns this into a generic
      // "we couldn't send that code" for the shopper anyway. The status is
      // logged with Twilio's own error code, which names the cause far
      // better than the status alone: 21408 is a region that has not been
      // enabled, 20003 is a credential that is wrong or unpermitted.
      const code = await twilioErrorCode(response);
      logger.error("sms send rejected", { status: response.status, code });
      throw new SmsSendError(`SMS provider rejected the send (HTTP ${response.status})`, response.status, code);
    }
  }
}

/**
 * Twilio's numeric error code out of a failed response, when there is one.
 *
 * Worth the extra few lines because the HTTP status is nearly useless on
 * its own here: a wrong credential, an unverified recipient and a country
 * that was never switched on all arrive as a 4xx, and they need three
 * completely different fixes. Failure to parse is not itself an error -
 * this only ever decorates a log line on a path that is already failing.
 */
async function twilioErrorCode(response: Response): Promise<number | undefined> {
  try {
    const body = (await response.json()) as { code?: unknown };
    return typeof body.code === "number" ? body.code : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Stands in whenever no SMS credentials are configured. Logs the passcode
 * rather than sending it, so `pnpm dev` can complete a login by reading
 * the console - the same role LoggingEmailClient plays for reset links,
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
    const credentials = isPreviewDeployment() ? null : resolveTwilioCredentials();
    cachedClient = credentials ? new TwilioSmsClient(credentials) : new LoggingSmsClient();
  }
  return cachedClient;
}
