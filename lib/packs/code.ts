import { randomBytes } from "node:crypto";

/**
 * Pack codes: one per physical unit, printed under a label.
 *
 * There are two forms of the same code and it matters which is which:
 *   - the **canonical** form, compact and upper-case ("7XQP928KM3RT"), is
 *     what PackCode.code stores and what every lookup compares against;
 *   - the **display** form, hyphenated ("7XQP-928K-M3RT"), is for labels,
 *     CSV exports and anywhere a human reads or types it.
 * Storing the display form would mean a code typed without hyphens missed
 * its own row, so nothing writes it to the database.
 */

// Same unambiguous alphabet as lib/coupons/code.ts - no 0/O or 1/I/L, so a
// code read off a label doesn't get mistyped.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const GROUP_LENGTH = 4;
// Three groups, where a coupon code uses two. Deliberately longer, because
// the two defend against different things: a coupon code is handed to one
// named member and checked by a cashier who can see them, while a pack code
// sits on a shelf in its millions and anyone who guesses one gets a free
// award with nobody watching. Three groups is 31^12 - roughly 7.9e17
// combinations - so even after ten million codes are in circulation, a
// blind guess lands under once in a billion attempts.
const GROUP_COUNT = 3;
const CODE_LENGTH = GROUP_LENGTH * GROUP_COUNT;

function randomGroup(): string {
  const bytes = randomBytes(GROUP_LENGTH);
  let out = "";
  for (let i = 0; i < GROUP_LENGTH; i += 1) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

/**
 * A new code in canonical form. Collisions are astronomically unlikely at
 * this size, but generation still runs against a unique constraint and
 * retries rather than assuming they cannot happen - see lib/packs/batch.ts.
 */
export function generatePackCode(): string {
  return Array.from({ length: GROUP_COUNT }, randomGroup).join("");
}

/**
 * Canonicalises anything a shopper or a URL might carry. Codes come back
 * lower-cased, with hyphens or spaces, or with neither - all of which have
 * to find the same row rather than tell someone their real code is invalid.
 */
export function normalisePackCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** Canonical -> "7XQP-928K-M3RT", for labels, exports and error messages. */
export function formatPackCode(canonical: string): string {
  const groups: string[] = [];
  for (let i = 0; i < canonical.length; i += GROUP_LENGTH) {
    groups.push(canonical.slice(i, i + GROUP_LENGTH));
  }
  return groups.join("-");
}

/**
 * A cheap shape check before touching the database. A scan URL is a public
 * endpoint anyone can hammer, and rejecting obviously malformed input here
 * keeps that traffic off the codes table entirely.
 */
export function looksLikePackCode(canonical: string): boolean {
  return canonical.length === CODE_LENGTH && [...canonical].every((char) => ALPHABET.includes(char));
}
