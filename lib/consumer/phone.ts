/**
 * Normalising a typed-in phone number to E.164 before it is ever hashed.
 *
 * This matters more than it looks. hashPhone() is a deterministic HMAC, so
 * "082 123 4567", "0821234567" and "+27821234567" hash to three different
 * values and would become three different Qumo accounts for one person -
 * with their points split across all three and no way to merge them after
 * the fact. Every path that turns a human-supplied number into a phoneHash
 * goes through here first.
 *
 * Deliberately South Africa only for now. Accepting arbitrary international
 * input would mean guessing a country for a bare "0821234567", and guessing
 * wrong creates exactly the split-account problem above. When a second
 * country is actually needed, this takes a region argument rather than
 * growing a pile of prefix heuristics.
 */

export class InvalidPhoneNumberError extends Error {}

const SA_DIALLING_CODE = "27";
// SA mobile subscriber numbers are 9 digits after the leading 0 (e.g.
// 82 123 4567). Landlines are the same length; both are accepted, since a
// shopper reaching an OTP has to receive an SMS either way and the network
// is a better judge of deliverability than a prefix table we would have to
// maintain.
const SA_SUBSCRIBER_DIGITS = 9;

/**
 * Returns the number in E.164 (`+27821234567`), or throws. Accepts the
 * three forms South Africans actually type: local with a leading zero,
 * international with or without the plus.
 */
export function normaliseSaPhone(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new InvalidPhoneNumberError("Enter your mobile number.");
  }

  // Strip everything a person might use as a separator - spaces, brackets,
  // dots, hyphens - but keep a leading plus, which is meaningful.
  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");

  if (digits.length === 0) {
    throw new InvalidPhoneNumberError("That doesn't look like a mobile number.");
  }

  let subscriber: string;

  if (digits.startsWith(SA_DIALLING_CODE) && digits.length === SA_DIALLING_CODE.length + SA_SUBSCRIBER_DIGITS) {
    // 27821234567, with or without the plus.
    subscriber = digits.slice(SA_DIALLING_CODE.length);
  } else if (!hadPlus && digits.startsWith("0") && digits.length === SA_SUBSCRIBER_DIGITS + 1) {
    // 0821234567 - the form almost everyone types.
    subscriber = digits.slice(1);
  } else {
    throw new InvalidPhoneNumberError("Enter a South African mobile number, like 082 123 4567.");
  }

  // A subscriber number starting with 0 is not a real SA number and would
  // otherwise sail through the length checks above.
  if (subscriber.startsWith("0")) {
    throw new InvalidPhoneNumberError("Enter a South African mobile number, like 082 123 4567.");
  }

  return `+${SA_DIALLING_CODE}${subscriber}`;
}

/**
 * `+27821234567` -> `082 123 4567`. For showing someone the number an OTP
 * was just sent to, so they can spot a typo before waiting for an SMS that
 * was never going to arrive.
 */
export function formatSaPhoneForDisplay(e164: string): string {
  const digits = e164.replace(/[^0-9]/g, "");
  if (!digits.startsWith(SA_DIALLING_CODE) || digits.length !== SA_DIALLING_CODE.length + SA_SUBSCRIBER_DIGITS) {
    return e164;
  }
  const subscriber = digits.slice(SA_DIALLING_CODE.length);
  return `0${subscriber.slice(0, 2)} ${subscriber.slice(2, 5)} ${subscriber.slice(5)}`;
}
