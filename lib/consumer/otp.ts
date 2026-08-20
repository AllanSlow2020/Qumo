import { randomInt } from "node:crypto";
import type { Person } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { encryptPhone, hashOtpCode, hashPhone } from "@/lib/security/crypto";
import { rateLimit } from "@/lib/security/rate-limit";
import { getSmsClient, SmsSendError, type SmsClient } from "@/lib/sms/client";
import { normaliseSaPhone } from "./phone";
import { WEB_CONSENT_VERSION } from "./consent";
import { PRODUCT_NAME } from "@/lib/product";

/**
 * Shopper login: one phone number, one Qumo account, no password.
 *
 * The security properties live here rather than in a provider (see the
 * note on TwilioSmsClient) and there are four of them, each defeating a
 * different attack:
 *   - the stored code is a keyed hash, so a database dump is not a list of
 *     valid passcodes (lib/security/crypto.ts#hashOtpCode);
 *   - each code carries an attempt cap, so a million-value keyspace cannot
 *     be walked one guess at a time;
 *   - requesting a new code kills every older one, so a code read over a
 *     shoulder yesterday is not still live today;
 *   - verification is a compare-and-swap, so the same code cannot be
 *     redeemed twice by two concurrent requests.
 *
 * Registration and login are deliberately the same call. There is no
 * "account exists" signal anywhere in this flow: asking for a code always
 * behaves identically, so this endpoint cannot be used to test whether a
 * given person shops with any Qumo brand.
 */

export class OtpError extends Error {}

const CODE_DIGITS = 6;
const CODE_TTL_MS = 10 * 60 * 1000;
/** Wrong guesses allowed against a single code before it is dead. */
const MAX_ATTEMPTS = 5;

// Deliberately two limits, because they stop different things. The send
// limit stops someone using our SMS spend to harass a phone number they do
// not own; the verify limit stops guessing continuing past a dead code by
// simply requesting a fresh one and trying five more times.
const SEND_LIMIT = 3;
const SEND_WINDOW_MS = 15 * 60 * 1000;
const VERIFY_LIMIT = 10;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;

/**
 * randomInt, not Math.random: this is a credential. Math.random is
 * seeded predictably enough that a determined attacker who sees a few
 * codes can narrow the next one, and it costs nothing to avoid.
 * Zero-padded so every code is exactly six digits — "004821" is a valid
 * code, and trimming it to "4821" would quietly shrink the keyspace.
 */
function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_DIGITS)).padStart(CODE_DIGITS, "0");
}

export type OtpRequestResult = {
  /** The normalised number the code went to, for echoing back so a shopper can spot a typo. */
  phoneE164: string;
};

/**
 * Issues a passcode and sends it. Throws OtpError for anything the shopper
 * can act on (bad number, too many requests, provider down) — every one of
 * those messages is safe to render.
 */
export async function requestOtp(rawPhone: string, smsClient: SmsClient = getSmsClient()): Promise<OtpRequestResult> {
  // normaliseSaPhone throws InvalidPhoneNumberError, whose message is
  // already written for a shopper — let it through rather than flattening
  // it into a vaguer one here.
  const phoneE164 = normaliseSaPhone(rawPhone);
  const phoneHash = hashPhone(phoneE164);

  // Keyed on the phone hash rather than an IP: the thing being protected is
  // a specific person's handset (and our SMS bill), and an attacker rotating
  // IPs should not get a fresh allowance for the same target.
  const { allowed } = rateLimit(`otp:send:${phoneHash}`, SEND_LIMIT, SEND_WINDOW_MS);
  if (!allowed) {
    throw new OtpError("Too many codes requested. Wait a few minutes and try again.");
  }

  const code = generateCode();
  const now = new Date();

  // Kill outstanding codes before issuing the replacement, so there is only
  // ever one live code per number. Done first: if the send below fails, the
  // old code stays dead, which is the safe direction to fail in.
  await prisma.phoneOtp.updateMany({
    where: { phoneHash, consumedAt: null },
    data: { consumedAt: now },
  });

  await prisma.phoneOtp.create({
    data: {
      phoneHash,
      codeHash: hashOtpCode(phoneHash, code),
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    },
  });

  try {
    await smsClient.sendSms(phoneE164, `${code} is your ${PRODUCT_NAME} code. It expires in 10 minutes.`);
  } catch (err) {
    // A provider outage is not the shopper's fault and not something they
    // can fix by retyping — say so plainly. The underlying error keeps its
    // own detail for the logs; only this sentence reaches the screen.
    if (err instanceof SmsSendError) {
      throw new OtpError("We couldn't send your code right now. Please try again in a moment.");
    }
    throw err;
  }

  return { phoneE164 };
}

/**
 * Verifies a passcode and returns the Person it belongs to, creating that
 * Person on a first-ever login. A shopper's first successful code *is*
 * their registration — there is no separate sign-up step to abandon.
 *
 * Every failure returns the same message. Distinguishing "no code
 * outstanding" from "wrong code" from "expired" would tell an attacker
 * which phone numbers currently have a login in progress.
 */
export async function verifyOtp(rawPhone: string, code: string, consented: boolean): Promise<Person> {
  // Required of everyone, new and returning alike, and checked before the
  // code is even looked at.
  //
  // Requiring it only of new accounts would be friendlier and would leak:
  // "you must accept the terms" arriving for one number and not another
  // tells an attacker which numbers already have accounts, which is exactly
  // the signal the rest of this module is built to withhold. So a returning
  // shopper re-affirms, and findOrCreatePerson() below records that.
  if (!consented) {
    throw new OtpError("Please accept the terms to continue.");
  }

  const phoneE164 = normaliseSaPhone(rawPhone);
  const phoneHash = hashPhone(phoneE164);

  const { allowed } = rateLimit(`otp:verify:${phoneHash}`, VERIFY_LIMIT, VERIFY_WINDOW_MS);
  if (!allowed) {
    throw new OtpError("Too many attempts. Wait a few minutes and try again.");
  }

  const submitted = code.trim();
  const now = new Date();

  // The compare-and-swap that is the actual enforcement — the same idiom
  // consumePasswordResetToken() and transitionCoupon() use. Matching and
  // consuming in one statement is what makes a code single-use even when
  // two requests arrive together; a findFirst-then-update would let both
  // through.
  const consumed = await prisma.phoneOtp.updateMany({
    where: {
      phoneHash,
      codeHash: hashOtpCode(phoneHash, submitted),
      consumedAt: null,
      expiresAt: { gt: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    data: { consumedAt: now },
  });

  if (consumed.count !== 1) {
    // A wrong guess has to cost something, or the attempt cap protects
    // nothing. Charged against the live code for this number, so five
    // wrong guesses kill it regardless of which value was tried.
    await prisma.phoneOtp.updateMany({
      where: { phoneHash, consumedAt: null, expiresAt: { gt: now } },
      data: { attempts: { increment: 1 } },
    });
    throw new OtpError("That code isn't right, or it has expired. Request a new one.");
  }

  return findOrCreatePerson(phoneE164, phoneHash);
}

/**
 * Person is platform-wide, not brand-scoped — one phone number is one
 * account no matter how many brands it later touches — so this is read and
 * written directly rather than through forBrand(), exactly as the schema
 * comment on Person describes. No BrandMembership is created here: a
 * shopper who has logged in but not yet scanned anything belongs to no
 * brand, and inventing a membership would leak them into a brand's member
 * list before they ever interacted with it.
 *
 * Consent is stamped on creation, and re-stamped for a returning shopper
 * whose recorded version is behind the current one — they have just
 * re-affirmed against today's wording, and the record should say so. A
 * shopper already on the current version is left untouched, so
 * consentGivenAt keeps meaning "when they agreed to this text" rather than
 * drifting forward on every sign-in.
 */
async function findOrCreatePerson(phoneE164: string, phoneHash: string): Promise<Person> {
  const existing = await prisma.person.findUnique({ where: { phoneHash } });
  if (existing) {
    if (existing.consentVersion === WEB_CONSENT_VERSION) {
      return existing;
    }
    return prisma.person.update({
      where: { id: existing.id },
      data: { consentGivenAt: new Date(), consentVersion: WEB_CONSENT_VERSION },
    });
  }

  return prisma.person.create({
    data: {
      phoneHash,
      phoneEncrypted: encryptPhone(phoneE164),
      // Ticking the box and completing an OTP together are the consent
      // moment for a web signup, the same way finishing the profile
      // questions is on WhatsApp. Stamped with a shared version so both
      // doors are auditable against the same wording.
      consentGivenAt: new Date(),
      consentVersion: WEB_CONSENT_VERSION,
    },
  });
}
