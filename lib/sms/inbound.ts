import type { Person } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { SMS_CONSENT_VERSION, SMS_JOIN_TERMS, SMS_TERMS_BODY } from "@/lib/consumer/consent";
import { InvalidPhoneNumberError, normaliseSaPhone } from "@/lib/consumer/phone";
import { formatLedgerAmount, getWallet } from "@/lib/consumer/wallet";
import { normalisePackCode } from "@/lib/packs/code";
import { redeemPackCode, type ScanFailureReason } from "@/lib/packs/scan";
import { encryptPhone, hashPhone } from "@/lib/security/crypto";
import { logger } from "@/lib/security/logger";
import { rateLimit } from "@/lib/security/rate-limit";
import { PRODUCT_NAME } from "@/lib/product";

/**
 * The no-data door: what happens when somebody texts the short code.
 *
 * A shopper with no airtime bundle cannot open a web page, so for a large
 * part of this market the web wallet answers the second visit and never the
 * first. This module is the same product reached by text message.
 *
 * ── One engine, three adapters ───────────────────────────────────────────
 *
 * Nothing here decides what anything is worth, whether a code is valid, or
 * what a balance is. Every one of those questions is answered by the call
 * the web already makes - redeemPackCode(), getWallet() - so a rule fixed
 * once is fixed for the web, for SMS, and for whatever comes next. This file
 * is a parser and a phrasebook, and the moment it starts holding rules of
 * its own the two channels will disagree and only one of them will be right.
 *
 * ── What this channel is allowed to do ───────────────────────────────────
 *
 * The network hands us the sender's MSISDN. That is a strong identifier and
 * it is not proof of consent: sender IDs are spoofable on some routes, and a
 * handset is often shared or borrowed. So the channel can do three things
 * and refuses a fourth:
 *
 *   - report a balance, because the person asking is almost always the
 *     person who owns it, and the harm if they are not is bounded;
 *   - earn from a code, because possessing a single-use code is the proof,
 *     and a spoofer gains nothing by crediting somebody else's account;
 *   - join, because an affirmative reply is the consent record.
 *
 * It cannot spend, opt out, or change anything about an account. Those are
 * the operations where a spoofed MSISDN takes something away, and none of
 * them is worth the convenience over a channel that cannot authenticate.
 * See handleStop() for the one place that rule bites in a way people will
 * not expect.
 */

/** What the sender asked for, named so a caller can log or bill by shape. */
export type InboundCommand = "BALANCE" | "CODE" | "JOIN" | "TERMS" | "HELP" | "STOP" | "UNREADABLE" | "THROTTLED";

export type InboundSms = {
  /** As the network supplied it. Normalised here, not by the caller. */
  from: string;
  text: string;
};

export type InboundReply = {
  command: InboundCommand;
  reply: string;
};

/**
 * One GSM-7 segment. Replies are held under this because the brand pays per
 * segment on every one of them, and a channel whose running cost doubles on
 * a stray adjective is a channel somebody switches off.
 *
 * SMS_JOIN_TERMS and SMS_TERMS_BODY are the deliberate exceptions - see the
 * notes on each.
 */
const SEGMENT = 160;

const SEND_LIMIT = 8;
const SEND_WINDOW_MS = 10 * 60 * 1000;

/**
 * Keywords are matched on the first word only, so "BALANCE PLEASE" and a
 * trailing signature both work. Everything else is tried as a code, which
 * is what an unprompted message from somebody holding a bottle usually is.
 */
const KEYWORDS = {
  BALANCE: new Set(["BALANCE", "BAL", "B"]),
  JOIN: new Set(["YES", "JOIN", "Y"]),
  TERMS: new Set(["TERMS", "T", "PRIVACY"]),
  HELP: new Set(["HELP", "H", "INFO", "?"]),
  STOP: new Set(["STOP", "END", "CANCEL", "UNSUBSCRIBE", "OPTOUT"]),
} as const;

function firstWord(text: string): string {
  return text.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
}

/** Everything after the keyword, or the whole message when there was none. */
function remainder(text: string): string {
  return text.trim().split(/\s+/).slice(1).join(" ");
}

function fit(reply: string): string {
  return reply.length <= SEGMENT ? reply : `${reply.slice(0, SEGMENT - 1).trimEnd()}.`;
}

/**
 * Why a code did not earn, in words a person can act on.
 *
 * Deliberately not the web copy: lib/packs/scan.ts writes for a screen that
 * can afford a paragraph and a button. Here every reason has to say what
 * happened and what to do next inside one segment, and several of them
 * collapse to the same advice - a shopper does not need to know whether the
 * campaign ended or never started, only that this code is not earning and
 * their own code was not spent finding out.
 */
export const SCAN_FAILURE_REPLY: Record<ScanFailureReason, string> = {
  UNKNOWN_CODE: "We don't recognise that code. Check it and send it again. Nothing has been used.",
  WRONG_BRAND: "We don't recognise that code. Check it and send it again. Nothing has been used.",
  ALREADY_SCANNED: "That code has already been used. Each one only counts once.",
  VOID: "That code isn't valid. Nothing has been used, so keep it if you want to query it.",
  CAMPAIGN_NOT_ACTIVE: "That promotion isn't running right now. Hold on to the code, it hasn't been used.",
  CAMPAIGN_ENDED: "That promotion has ended. Your code hasn't been used.",
  CAMPAIGN_NOT_STARTED: "That promotion hasn't started yet. Hold on to the code, it hasn't been used.",
  NO_EARN_RULE: "That promotion isn't running right now. Hold on to the code, it hasn't been used.",
  NOT_A_SCAN_PROMOTION: "That code isn't part of the promotion running now. Hold on to it, it hasn't been used.",
  PROGRAMME_CLOSED: "That rewards programme has closed. Your code hasn't been used.",
  DAILY_LIMIT: "You've reached today's limit for this brand. Try again tomorrow. Your code hasn't been used.",
  DAILY_SCAN_LIMIT: "You've reached today's limit for this brand. Try again tomorrow. Your code hasn't been used.",
  CAMPAIGN_EXHAUSTED: "This promotion has given out everything it had. Your code hasn't been used.",
  OPTED_OUT: "You've left this brand's programme. Rejoin on their site and send the code again.",
};

/**
 * The whole channel. Returns the text to send back; the caller decides how
 * to put it on the wire, because that part is the aggregator's shape and
 * this part is not.
 */
export async function handleInboundSms(message: InboundSms, now: Date = new Date()): Promise<InboundReply> {
  let phoneE164: string;
  try {
    phoneE164 = normaliseSaPhone(message.from);
  } catch (error) {
    if (!(error instanceof InvalidPhoneNumberError)) throw error;
    // A number the network delivered but we cannot place. Roaming, a short
    // code replying to itself, or a provider posting something malformed.
    // Answered rather than dropped, because silence to a real person is
    // indistinguishable from the service being broken.
    return {
      command: "UNREADABLE",
      reply: fit(`${PRODUCT_NAME} works with South African mobile numbers. We couldn't read yours.`),
    };
  }

  const phoneHash = hashPhone(phoneE164);

  // Before anything else, because every branch below ends in a message the
  // brand pays for. The limit is on replies rather than on lookups: this is
  // a spend control first and an abuse control second.
  const allowed = await rateLimit(`sms-inbound:${phoneHash}`, SEND_LIMIT, SEND_WINDOW_MS, now);
  if (!allowed.allowed) {
    // Silence, not an apology. A throttle that answers every message has not
    // throttled anything - it has doubled the traffic and kept paying.
    logger.info("inbound sms throttled", { phoneHash });
    return { command: "THROTTLED", reply: "" };
  }

  const person = await prisma.person.findUnique({ where: { phoneHash } });
  const keyword = firstWord(message.text);

  if (KEYWORDS.HELP.has(keyword)) {
    return { command: "HELP", reply: helpReply(person) };
  }
  if (KEYWORDS.TERMS.has(keyword)) {
    return { command: "TERMS", reply: SMS_TERMS_BODY };
  }
  if (KEYWORDS.STOP.has(keyword)) {
    return { command: "STOP", reply: handleStop() };
  }
  if (KEYWORDS.JOIN.has(keyword)) {
    return { command: "JOIN", reply: await handleJoin(phoneE164, phoneHash, person, now) };
  }

  // Everything from here needs an account. An unknown number is told how to
  // get one and nothing is created for it: a silently created account is a
  // consent record nobody gave, and this channel is exactly the one where a
  // number can arrive without its owner having done anything at all.
  if (!person) {
    return { command: KEYWORDS.BALANCE.has(keyword) ? "BALANCE" : "CODE", reply: SMS_JOIN_TERMS };
  }

  if (KEYWORDS.BALANCE.has(keyword)) {
    return { command: "BALANCE", reply: await handleBalance(person) };
  }

  return { command: "CODE", reply: await handleCode(codeFrom(message.text, keyword), person, now) };
}

/**
 * A code sent bare, or after a keyword we do not know. Both happen: posters
 * say "SMS your code to 33xxx" and people write "CODE 7XQP928KM3RT" anyway.
 */
function codeFrom(text: string, keyword: string): string {
  const rest = remainder(text);
  return rest && keyword === "CODE" ? rest : text;
}

function helpReply(person: Person | null): string {
  return fit(
    person
      ? `${PRODUCT_NAME}: send a code from a pack to earn, BALANCE to check what you have, TERMS for the privacy notice.`
      : `${PRODUCT_NAME}: reply YES to join, then send a code from a pack to earn. TERMS for the privacy notice.`,
  );
}

/**
 * STOP, and why it does not do what STOP usually does.
 *
 * The convention is that STOP ends the messaging relationship, and ignoring
 * it would be wrong. Honouring it literally would be worse: the only
 * messages this system sends unprompted are the one-time codes somebody
 * needs to sign in, so suppressing them locks a person out of their own
 * balance - and it does it on the say-so of a channel we have just finished
 * saying cannot be authenticated. A spoofed STOP would be a denial of
 * service against a stranger's account, for free.
 *
 * So it is acknowledged, the thing it is usually asked for is explained, and
 * nothing is changed. Leaving a programme is a real thing a person can do,
 * and it happens on the web where they have proved who they are.
 */
function handleStop(): string {
  return fit(
    `${PRODUCT_NAME} only texts you codes you asked for, so there is nothing to unsubscribe from. To leave a brand's programme, use their site.`,
  );
}

async function handleJoin(
  phoneE164: string,
  phoneHash: string,
  person: Person | null,
  now: Date,
): Promise<string> {
  if (person) {
    // Already joined, possibly on the web. Re-stamping consent here would
    // overwrite the record of what they actually read with a version they
    // did not, which is the one thing the version field exists to prevent.
    return fit(`You're already on ${PRODUCT_NAME}. Send a code from a pack to earn, or BALANCE to check what you have.`);
  }

  await prisma.person.create({
    data: {
      phoneHash,
      phoneEncrypted: encryptPhone(phoneE164),
      consentGivenAt: now,
      consentVersion: SMS_CONSENT_VERSION,
    },
  });
  logger.info("shopper joined by sms", { phoneHash, consentVersion: SMS_CONSENT_VERSION });

  return fit(`You're on ${PRODUCT_NAME}. Send a code from a pack to earn, or BALANCE to check what you have.`);
}

async function handleBalance(person: Person): Promise<string> {
  const wallets = await getWallet(person.id);

  if (wallets.length === 0) {
    return fit(`You haven't earned anything yet. Send a code from a pack and it will be added.`);
  }

  // Balance only, and no history, which is narrower than the web wallet
  // shows the same person.
  //
  // The difference is the medium rather than the entitlement. A wallet page
  // is behind a one-time code and closes when they leave it; an SMS sits in
  // an inbox on a handset that in this market is frequently shared,
  // borrowed or handed to a child. "R240 with Chicken Licken" tells a reader
  // an amount. A list of scans tells them which shops somebody used and
  // when, which is a movement record and not what was asked for. The full
  // history stays one authenticated tap away at /wallet.
  const lines = wallets.map((wallet) => {
    const amounts = wallet.balances
      .filter((balance) => balance.amount !== 0)
      .map((balance) => formatLedgerAmount(balance.amount, balance.unit));
    return `${wallet.brandName}: ${amounts.length > 0 ? amounts.join(", ") : "nothing yet"}`;
  });

  return fit(lines.join(". "));
}

async function handleCode(rawCode: string, person: Person, now: Date): Promise<string> {
  const normalised = normalisePackCode(rawCode);
  if (normalised.length === 0) {
    return helpReply(person);
  }

  // No expectedBrandId: an SMS arrives with a code and a phone number and no
  // host, which redeemPackCode() is already written for. The award follows
  // the code's own brand, as it does everywhere.
  const result = await redeemPackCode(normalised, person.id, now);

  if (!result.ok) {
    return fit(SCAN_FAILURE_REPLY[result.reason]);
  }

  const earned = formatLedgerAmount(result.amount, result.unit);
  const balance = formatLedgerAmount(result.newBalance, result.unit);

  if (result.alreadyEarned) {
    return fit(`You already earned ${earned} for that code. Your ${result.brandName} balance is ${balance}.`);
  }

  // A completed card leads, because it is the thing that changed. Burying
  // "you have earned a reward" behind a running total is how a person
  // misses the one message in the exchange that was worth paying for, and
  // the coupon code is what they have to quote at the counter.
  if (result.coupon) {
    return fit(`Card complete. You've earned ${result.coupon.name} at ${result.brandName}. Your code is ${result.coupon.code}.`);
  }

  return fit(`${earned} added. Your ${result.brandName} balance is now ${balance}.`);
}
