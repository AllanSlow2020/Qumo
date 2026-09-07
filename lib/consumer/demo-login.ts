import { timingSafeEqual } from "node:crypto";
import { normaliseSaPhone } from "./phone";

/**
 * A fixed passcode, for numbers you name, while there is no SMS account.
 *
 * The honest framing: this is a hole in the front door, deliberately cut,
 * and its whole design is about how small it is.
 *
 * ── Why it exists ────────────────────────────────────────────────────────
 *
 * Shopper login is a passcode over SMS, and with no aggregator account the
 * passcode is written to the server log instead. That is fine for a
 * developer and useless for anybody else — you cannot demonstrate a
 * product by reading a log to a room. So a listed number can sign in with
 * a code you choose.
 *
 * ── Why it is a list and a fixed code, not "any code" ────────────────────
 *
 * "Accept any code" and "accept this code for these numbers" are the same
 * amount of typing at a demo and nothing like the same exposure. The first
 * hands anyone who finds the address the ability to sign in as any phone
 * number in the country and read whatever that person has — a real
 * shopper's history included, once there are any. The second is limited to
 * handsets you have written down, which are yours.
 *
 * ── Off unless both are set ──────────────────────────────────────────────
 *
 * DEMO_LOGIN_PHONES and DEMO_LOGIN_CODE. Either one missing and this does
 * nothing at all, so a deployment that never mentions them cannot have it
 * switched on by accident, and the failure direction of a typo is "the
 * bypass stopped working" rather than "the bypass got wider".
 *
 * Delete both the day SMS is connected. scripts/preflight.mjs warns on
 * every build while they are set, because the thing about a temporary
 * bypass is that it is only temporary if somebody is reminded of it.
 */

/** Six digits, like a real one — so nothing downstream has to special-case its shape. */
const CODE_SHAPE = /^[0-9]{6}$/;

type DemoLogin = { phones: Set<string>; code: string };

function read(): DemoLogin | null {
  const rawPhones = process.env.DEMO_LOGIN_PHONES?.trim();
  const code = process.env.DEMO_LOGIN_CODE?.trim();
  if (!rawPhones || !code || !CODE_SHAPE.test(code)) {
    return null;
  }

  const phones = new Set<string>();
  for (const entry of rawPhones.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    try {
      // Normalised on the way in, so the list can be written however it is
      // easiest to type — 082 123 4567, 0821234567, +27821234567 — and
      // still match the E.164 form the login produces.
      phones.add(normaliseSaPhone(trimmed));
    } catch {
      // One unusable entry does not disable the rest. It also does not
      // silently widen anything: an entry we cannot parse matches nothing.
    }
  }

  return phones.size > 0 ? { phones, code } : null;
}

/** True when the feature is configured at all. For the preflight warning and the tests. */
export function demoLoginEnabled(): boolean {
  return read() !== null;
}

/** True when this number is one of the listed ones. Used to skip an SMS that would go nowhere. */
export function isDemoPhone(phoneE164: string): boolean {
  return read()?.phones.has(phoneE164) ?? false;
}

/**
 * True when this number is listed *and* this is the code.
 *
 * Constant time on the comparison, like every other secret compare in this
 * repo. It matters less here than elsewhere and costs nothing, and the
 * inconsistency would be the thing worth commenting on.
 */
export function isDemoLogin(phoneE164: string, submittedCode: string): boolean {
  const config = read();
  if (!config || !config.phones.has(phoneE164)) {
    return false;
  }
  const a = Buffer.from(submittedCode);
  const b = Buffer.from(config.code);
  return a.length === b.length && timingSafeEqual(a, b);
}
