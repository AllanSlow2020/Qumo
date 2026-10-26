import { config } from "dotenv";
config();
import { normaliseSaPhone } from "../lib/consumer/phone";
import { resolveTwilioCredentials, SmsSendError, TwilioSmsClient } from "../lib/sms/client";

/**
 * One message, end to end, so a passcode that never arrives can be
 * diagnosed instead of guessed at.
 *
 * The shopper login path touches six things before Twilio sees anything: a
 * phone parser, a rate limiter, a database write, an env var, a credential
 * and a region setting. When no SMS lands, every one of those is a
 * candidate, and the sign-in screen tells you nothing - by design, since it
 * must not reveal whether a number has an account. This bypasses all of it
 * and asks the provider directly.
 *
 * What the answer means:
 *   - It sends and the phone buzzes: the credential and the region are
 *     both fine, and anything still broken is in the app.
 *   - 20003: the credential is wrong, or it is a restricted API key
 *     without permission to send.
 *   - 21408: South Africa was never enabled under Messaging Geo
 *     Permissions. The most common one, and invisible everywhere else -
 *     the app records a successful request and no phone ever rings.
 *   - 21608: a trial account being asked to message a number nobody
 *     verified.
 *
 * Deliberately not a test file. It costs real money and needs credentials
 * that do not exist in CI, and a suite that sometimes reaches the internet
 * is a suite people stop trusting.
 */

/** Twilio's codes for the four ways this realistically fails. */
const EXPLANATIONS = new Map<number, string>([
  [20003, "The credential was refused. Wrong key or secret, or a restricted API key without the Messaging permission."],
  [21212, "Twilio would not accept the From number. Check TWILIO_FROM_NUMBER is one of yours, in +27... form."],
  [21408, "This account cannot message that country. Console, Messaging, Settings, Geo Permissions, and tick it."],
  [21608, "A trial account can only message verified numbers. Add this one under Verified Caller IDs."],
  [21610, "That number replied STOP and is on Twilio's opt-out list for this sender."],
]);

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: pnpm sms:test +27821234567");
    process.exit(1);
  }

  const credentials = resolveTwilioCredentials();
  if (!credentials) {
    console.error("\nNo usable Twilio credentials.\n");
    console.error("  Needed: TWILIO_ACCOUNT_SID, TWILIO_FROM_NUMBER, and either");
    console.error("          TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET (preferred)");
    console.error("          or TWILIO_AUTH_TOKEN.\n");
    console.error("  Without them the app logs passcodes instead of sending them,");
    console.error("  which is why a login can appear to work and no SMS arrive.\n");
    process.exit(1);
  }

  // normaliseSaPhone is the same parser the login screen uses, so a number
  // this rejects would never have reached Twilio anyway. Better to find
  // that out here than to conclude the provider is broken.
  let phoneE164: string;
  try {
    phoneE164 = normaliseSaPhone(target);
  } catch (err) {
    console.error(`\n  ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  console.log("");
  console.log(`  account   ${credentials.accountSid}`);
  console.log(`  auth      ${credentials.kind === "api-key" ? `API key ${credentials.username}` : "account auth token"}`);
  console.log(`  from      ${credentials.fromNumber}`);
  console.log(`  to        ${phoneE164}`);
  console.log("");

  const client = new TwilioSmsClient(credentials);
  const stamp = new Date().toISOString().slice(11, 19);

  try {
    await client.sendSms(phoneE164, `Qumo test message, sent ${stamp}. Nothing to do.`);
  } catch (err) {
    if (err instanceof SmsSendError) {
      console.error(`  refused   HTTP ${err.status ?? "?"}${err.code ? `, Twilio code ${err.code}` : ""}`);
      const explanation = err.code ? EXPLANATIONS.get(err.code) : undefined;
      console.error(`  meaning   ${explanation ?? "Look this code up in Twilio's error reference."}`);
      console.error("");
      process.exit(1);
    }
    throw err;
  }

  console.log("  accepted  Twilio took the message.");
  console.log("");
  // Accepted is not delivered, and the gap between them is where a
  // perfectly configured account still fails to reach a handset: carrier
  // filtering, a wrong number, a phone that is off. Saying "sent" here
  // would be the same overclaim the console's preview pane makes.
  console.log("  Accepted is not delivered. Check the handset, and check");
  console.log("  Monitor, Logs, Messaging for a status of `delivered`.");
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
