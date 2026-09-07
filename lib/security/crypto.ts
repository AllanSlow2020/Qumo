import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

// Two separate secrets, two separate jobs:
//  - PHONE_HASH_SECRET produces a deterministic (same input -> same output)
//    HMAC, so we can find "the row for this phone number" via an index
//    without ever decrypting anything. It cannot be reversed to a phone number.
//  - ENCRYPTION_KEY produces reversible ciphertext (AES-256-GCM), used only
//    at the one point we actually need the real number back: sending a
//    WhatsApp message. Losing this key doesn't help an attacker guess a
//    specific person's number; losing the hash secret doesn't let them
//    recover any number either. Compromising the database alone (without
//    both secrets, which live only in the environment, never in the DB)
//    exposes neither.

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function hashPhone(e164Phone: string): string {
  const secret = getEnv("PHONE_HASH_SECRET");
  return createHmac("sha256", secret).update(e164Phone).digest("hex");
}

const ALGORITHM = "aes-256-gcm";

/**
 * Reversible encryption for any secret this app has to be able to read
 * back. Phone numbers were the first use; a store's receipt-signing key
 * (see prisma/schema.prisma, Store.signingSecretEncrypted) is the second.
 *
 * Generic rather than phone-shaped because the alternative is calling
 * decryptPhone() on something that is not a phone, which reads as a bug
 * every time anyone meets it and eventually becomes one when somebody
 * "corrects" it.
 */
export function encryptSecret(plaintext: string): string {
  const key = Buffer.from(getEnv("ENCRYPTION_KEY"), "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store iv + authTag + ciphertext together, base64, so one column round-trips cleanly.
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptSecret(encoded: string): string {
  const key = Buffer.from(getEnv("ENCRYPTION_KEY"), "base64");
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Named wrappers kept because the call sites read better for what they
 * are, and because "encryptPhone" at a Person write states the intent that
 * a bare encryptSecret would not.
 */
export function encryptPhone(e164Phone: string): string {
  return encryptSecret(e164Phone);
}

export function decryptPhone(encoded: string): string {
  return decryptSecret(encoded);
}

/**
 * Keyed hash for a one-time passcode, and deliberately not the unkeyed
 * sha256 that lib/auth/reset-token.ts uses. A reset token carries 256 bits
 * of entropy, so an unkeyed digest of it is already unguessable; a 6-digit
 * OTP has a keyspace of one million, and an unkeyed digest of one is
 * reversible by brute force in about the time it takes to read this
 * sentence. Keying it with a secret that never leaves the environment
 * means a database dump alone reveals nothing - the same reasoning that
 * put hashPhone() on an HMAC rather than a plain digest.
 *
 * phoneHash is mixed into the message so a stored code hash is bound to
 * one account: two people who happen to be issued the same six digits at
 * the same moment produce different hashes, and a hash lifted from one row
 * cannot be replayed against another.
 */
export function hashOtpCode(phoneHash: string, code: string): string {
  const secret = getEnv("PHONE_HASH_SECRET");
  return createHmac("sha256", secret).update(`otp:${phoneHash}:${code}`).digest("hex");
}
