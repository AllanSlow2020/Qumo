/**
 * A shopper who scans a code before logging in has to be sent to the login
 * screen and then back to the code they scanned - otherwise the scan is
 * lost and, since pack codes are single-use, they have to find another
 * pack. That round trip means putting a destination in a query parameter,
 * and a destination in a query parameter is an open redirect waiting to
 * happen: anyone can send `?next=https://not-us.example/login`, and a
 * shopper who has just been asked for a passcode is exactly the person
 * least likely to notice the domain changed.
 *
 * So nothing is trusted here. A destination is accepted only if it is a
 * path on this site, and anything else falls back to the wallet.
 */

export const SHOPPER_HOME = "/wallet";

const CONTROL_CHAR_MAX = 0x1f;
const DELETE_CHAR = 0x7f;

export function safeShopperRedirect(next: string | undefined | null): string {
  if (!next) {
    return SHOPPER_HOME;
  }

  // Must be a rooted path. "//evil.example" is protocol-relative and would
  // navigate off-site despite starting with a slash, and a backslash is
  // read as a slash by some browsers - both are rejected rather than
  // patched up into something that looks safe.
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return SHOPPER_HOME;
  }

  // A path carrying a scheme or whitespace is not something this app
  // generates.
  if (next.includes("://") || /\s/.test(next)) {
    return SHOPPER_HOME;
  }

  // Control characters matter beyond being unexpected: on some stacks a
  // newline in a redirect target can smuggle a second header.
  for (const char of next) {
    const code = char.charCodeAt(0);
    if (code <= CONTROL_CHAR_MAX || code === DELETE_CHAR) {
      return SHOPPER_HOME;
    }
  }

  return next;
}
