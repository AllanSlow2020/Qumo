/**
 * Writing a code to an NFC tag.
 *
 * ── Why there is almost nothing here ─────────────────────────────────────
 *
 * An NFC tag holds a URL. A pack code already *is* a URL, printed as a QR
 * on a label, and the phone that taps the tag opens exactly the page the
 * phone that scans the QR opens. So NFC is not a second mechanic and there
 * is no second scan path to build: the tag is a different way of carrying
 * the same address, the way a QR and a printed code are already two ways of
 * carrying it.
 *
 * What was actually missing was smaller and more annoying. Getting one URL
 * onto one tag meant downloading a CSV of fifty thousand and finding a row
 * in it, on a phone, standing next to the tags. Hence a screen, and hence
 * this file, which is the arithmetic that screen needs to tell the truth
 * about whether a URL fits.
 *
 * ── What a tag actually stores ───────────────────────────────────────────
 *
 * An NDEF message with one URI record, which costs a fixed amount of
 * overhead plus the URL, minus one saving worth knowing about: the URI
 * record starts with an identifier byte that stands in for a common prefix,
 * so "https://" costs one byte rather than eight.
 */

/**
 * Bytes of user memory on the tags somebody is likely to be holding.
 *
 * NTAG213 is what a bag of cheap stickers contains and what a pack run
 * would use, so it is the one that decides whether a URL fits. The larger
 * two are here because a tag bought for testing is often a 215.
 */
export const TAG_CAPACITY = [
  { name: "NTAG213", bytes: 144 },
  { name: "NTAG215", bytes: 504 },
  { name: "NTAG216", bytes: 888 },
] as const;

/**
 * The prefixes an NDEF URI record can abbreviate to a single byte.
 *
 * Only the two that matter here. The full table has thirty-odd entries for
 * things like tel: and ftp:, none of which a pack code will ever be.
 */
const ABBREVIATED = ["https://www.", "http://www.", "https://", "http://"];

/**
 * Bytes on the tag, for one URL.
 *
 * The overhead, counted once rather than guessed at:
 *   3  TLV wrapper - type, length, and the terminator byte
 *   4  record header, type length, payload length, and the type byte 'U'
 *   1  the URI identifier code that stands in for the prefix
 */
const NDEF_OVERHEAD = 8;

export function tagBytes(url: string): number {
  const prefix = ABBREVIATED.find((p) => url.startsWith(p));
  const body = prefix ? url.slice(prefix.length) : url;
  // Every character a pack code URL can contain is ASCII, so one byte each.
  // Worth saying rather than assuming: a brand slug is validated down to
  // lower-case letters, digits and hyphens, and a code comes from a fixed
  // alphabet, so there is no multi-byte character anywhere in this string.
  return NDEF_OVERHEAD + body.length;
}

/** The smallest tag this URL fits on, or null if it fits on none of them. */
export function smallestTagFor(url: string): (typeof TAG_CAPACITY)[number] | null {
  const needed = tagBytes(url);
  return TAG_CAPACITY.find((t) => t.bytes >= needed) ?? null;
}
