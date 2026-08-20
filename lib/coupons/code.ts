import { randomBytes } from "node:crypto";

// Unambiguous alphabet — no 0/O or 1/I/L, so a code read off a phone screen
// at a till doesn't get mistyped.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const GROUP_LENGTH = 4;
const GROUP_COUNT = 2;

function randomGroup(): string {
  const bytes = randomBytes(GROUP_LENGTH);
  let out = "";
  for (let i = 0; i < GROUP_LENGTH; i += 1) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

/** e.g. "7XQP-928K", or "FC-7XQP-928K" when a reward configures a
 * codePrefix. At this alphabet/length, collisions are astronomically
 * unlikely (31^8 combinations) — callers still retry on the rare unique
 * -constraint violation rather than assume it can't happen. */
export function generateCouponCode(prefix?: string): string {
  const code = Array.from({ length: GROUP_COUNT }, randomGroup).join("-");
  return prefix ? `${prefix}-${code}` : code;
}
