import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords, to RFC 6238.
 *
 * ── Why this and not SMS ─────────────────────────────────────────────────
 *
 * A second factor for staff was the gap: an account that can generate value
 * and export member data was protected by a password alone. SMS would have
 * been the obvious choice given we already send passcodes to shoppers, and
 * it is the wrong one here — it costs money per login, it depends on an
 * aggregator account that does not exist yet, and SIM swap is a live and
 * well-documented attack in this market. TOTP costs nothing per use, works
 * offline, and every authenticator app already implements it.
 *
 * ── Why it is written out rather than installed ──────────────────────────
 *
 * The algorithm is forty lines and completely specified, and the same
 * reasoning that put scrypt and the receipt HMAC in this repo applies: a
 * dependency in the authentication path is a supply chain in the
 * authentication path. It is verified against the published RFC 6238 test
 * vectors rather than against itself, which is the only reason writing it
 * out is defensible at all.
 */

// SHA-1 is correct here rather than a compromise. RFC 6238 defines it, every
// authenticator app implements it, and the security of a TOTP does not rest
// on collision resistance — it rests on the shared secret and a thirty
// second window. Choosing SHA-256 would be stronger on paper and unreadable
// by the apps people actually have.
const ALGORITHM = "sha1";
const STEP_SECONDS = 30;
const DIGITS = 6;

/**
 * How far either side of now a code is accepted, in steps.
 *
 * One step, so a code is good for the thirty seconds it belongs to plus the
 * thirty before and after. That covers a phone whose clock has drifted and
 * a person who starts typing at the twenty-ninth second, which is most of
 * the support burden of a second factor. Wider would be kinder and would
 * also widen the window an intercepted code stays useful in.
 */
const WINDOW_STEPS = 1;

// RFC 4648 base32, which is what every authenticator app expects a secret in.
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

export function base32Decode(input: string): Buffer {
  // Padding and spacing are stripped: people retype secrets off a screen,
  // and a secret that fails because somebody kept the spaces we printed for
  // them is a self-inflicted support ticket.
  const clean = input.toUpperCase().replace(/[=\s-]/g, "");

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Not a valid base32 secret");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160 bits, matching the HMAC-SHA1 block the RFC assumes. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Which thirty-second step a moment falls in. Exported for replay checks. */
export function totpStep(at: Date): number {
  return Math.floor(at.getTime() / 1000 / STEP_SECONDS);
}

/**
 * The code for one step. `digits` is a parameter only so the RFC's own
 * eight-digit test vectors can be checked against this function rather than
 * against a reimplementation of it in a test.
 */
export function totpCodeForStep(secretBase32: string, step: number, digits: number = DIGITS): string {
  const key = base32Decode(secretBase32);

  // The counter is eight bytes, big-endian. writeBigUInt64BE rather than
  // arithmetic, because a step number will exceed 2^32 in 2106 and a bug
  // that surfaces then is a bug nobody alive here will enjoy finding.
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const digest = createHmac(ALGORITHM, key).update(counter).digest();

  // Dynamic truncation, RFC 4226 §5.3: the low nibble of the last byte
  // picks where to read four bytes from, and the top bit is masked off so
  // the result is positive on platforms that would read it as signed.
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function totpCode(secretBase32: string, at: Date = new Date()): string {
  return totpCodeForStep(secretBase32, totpStep(at));
}

export type TotpVerification = { ok: false } | { ok: true; step: number };

/**
 * Checks a code and says which step it belonged to.
 *
 * The step comes back rather than a bare boolean so the caller can refuse a
 * replay: a code is valid for up to ninety seconds across the accepted
 * window, and without recording the step it was used at, anyone who sees it
 * over a shoulder can use it again inside that window. Storing the last
 * accepted step and refusing anything at or below it closes that, and the
 * check belongs to the caller because it is the caller that owns the user
 * row.
 */
export function verifyTotp(secretBase32: string, code: string, at: Date = new Date()): TotpVerification {
  const supplied = code.trim().replace(/\s/g, "");
  if (!/^\d{6}$/.test(supplied)) {
    return { ok: false };
  }

  const current = totpStep(at);
  for (let offset = -WINDOW_STEPS; offset <= WINDOW_STEPS; offset += 1) {
    const step = current + offset;
    const expected = Buffer.from(totpCodeForStep(secretBase32, step));
    const given = Buffer.from(supplied);

    // Constant time, like every other comparison of a secret in this repo.
    // The window makes a timing signal less useful than usual, and "less
    // useful" is not a reason to hand one over.
    if (expected.length === given.length && timingSafeEqual(expected, given)) {
      return { ok: true, step };
    }
  }
  return { ok: false };
}

/**
 * The otpauth:// URI an authenticator app reads.
 *
 * The issuer appears twice — once as a label prefix and once as a parameter
 * — which looks redundant and is what the apps actually expect: older ones
 * read the prefix, newer ones the parameter, and getting it wrong means an
 * entry in somebody's phone labelled with an email address and no hint of
 * what it unlocks.
 */
export function otpauthUrl(secretBase32: string, accountEmail: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Grouped in fours, for someone typing it off a screen into a phone. */
export function formatSecretForDisplay(secretBase32: string): string {
  return secretBase32.replace(/(.{4})/g, "$1 ").trim();
}
