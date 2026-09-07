import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Staff passwords, hashed with scrypt out of node:crypto.
 *
 * No bcrypt, no argon2, no dependency. scrypt is memory-hard, it is in the
 * standard library, and the alternative here was a native module that has to
 * compile on every machine and every deploy target for a function this file
 * implements in forty lines. OWASP lists scrypt as an acceptable choice
 * where argon2id is unavailable, and a pure-JS bcrypt — the usual way people
 * dodge the native build — is markedly slower per unit of security, which
 * means it gets tuned down until it is worse than this.
 *
 * Shopper accounts have no password at all: they authenticate with a phone
 * and a one-time code. This exists only for brand staff, who sign in from a
 * desk rather than at a till.
 */

/**
 * Cost parameters. N is the work factor and dominates both time and memory:
 * memory is roughly 128 × N × r bytes, so N=2^15 and r=8 is about 32 MB per
 * hash, and takes something on the order of 100 ms on a small server.
 *
 * That is deliberately slow. A login is a once-a-day event for a staff
 * member and an unbounded loop for anybody working through a stolen dump,
 * and the asymmetry is the entire mechanism. maxmem has to be raised
 * explicitly because Node's default cap is 32 MB and these parameters sit
 * right on it.
 *
 * Recorded in the stored string rather than read from here at verify time,
 * so raising them later does not lock out everyone hashed under the old
 * ones.
 */
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * N * R * 2;

const SALT_BYTES = 16;

/**
 * `scrypt$N$r$p$salt$hash`, base64url for the two binary fields.
 *
 * Self-describing on purpose. A bare hash is a hash that can never have its
 * parameters changed, because nothing records what the old ones were.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64url"), derived.toString("base64url")].join("$");
}

/**
 * Constant-time, and false rather than throwing on anything malformed.
 *
 * A stored string that cannot be parsed is a corrupt row or a hash from some
 * other scheme; either way the answer to "is this the right password" is no,
 * and an exception here would turn a bad row into a 500 that distinguishes
 * it from a wrong password.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  // Bound the parameters read out of the database. They are ours today, but
  // this function's whole job is to be handed untrusted-shaped input, and
  // an N of 2^40 out of a corrupted row would be a memory exhaustion rather
  // than a failed login.
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (n < 2 ** 12 || n > 2 ** 20 || r < 1 || r > 32 || p < 1 || p > 16) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4]!, "base64url");
    expected = Buffer.from(parts[5]!, "base64url");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
    N: n,
    r,
    p,
    maxmem: 128 * n * r * 2,
  });

  // Equal lengths by construction — derived is asked for expected.length —
  // but timingSafeEqual throws rather than returning false on a mismatch, so
  // the guard stays.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
