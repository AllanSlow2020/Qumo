/**
 * Reading a photographed till slip, and deciding whether the read is good
 * enough to award on.
 *
 * ── What this file does and does not contain ─────────────────────────────
 *
 * It contains the contract: what a reader must return, and when a return
 * is too thin to use. It deliberately contains no reader. Choosing one is
 * a decision with a price, an accuracy figure and a list of South African
 * retailers whose slip layouts it actually handles, and none of those are
 * things the code can pick for itself. Until one is configured the feature
 * is inert and says so, the same way the dormancy sweep and redemption
 * are: the mechanism is built, the policy is somebody's to set.
 *
 * ── Why the photograph is never stored ───────────────────────────────────
 *
 * A picture of somebody's till slip is personal information about what
 * they bought and where they were. Keeping it would create a second store
 * of exactly the kind docs/popia.md spends its length arguing we hold as
 * little of as possible, and it would be the only place in this system
 * holding a shopper's basket contents rather than a total.
 *
 * So the image is read and discarded inside one request. Nothing writes it
 * to disk, to the database or to a bucket. What survives is what survives
 * a QR scan: the store, the slip number, the total, the time, and now the
 * tier that says how it was established.
 *
 * The cost of that is real and should not be glossed. A shopper whose slip
 * is misread cannot be shown the picture afterwards, because we no longer
 * have it, so there is no appeal that consists of a human re-reading it.
 * The failure reasons below exist to make the alternative work instead:
 * tell them precisely what could not be read, while they are still holding
 * the slip, so they can retake it or use the printed code.
 */

import type { ProofTier } from "@/lib/proof/tier";

/**
 * What a reader gives back.
 *
 * Every field is nullable because a real read of a creased, shadowed,
 * half-thermal slip genuinely does come back with holes, and a type that
 * pretends otherwise moves the lie one layer up.
 */
export type SlipRead = {
  /** The store's own code as printed, matched against Store.code. */
  storeCode: string | null;
  /** The till's transaction number. The only thing making this slip unique. */
  externalTxnId: string | null;
  /** The basket total, in cents. */
  amountCents: number | null;
  /** When the till says the sale happened. */
  purchasedAt: Date | null;
  /**
   * The reader's own confidence in the whole read, from 0 to 1.
   *
   * On the whole read rather than per field, because the failure that
   * matters is a confident misread of one character in a total, and a
   * reader that reports four high per-field scores for a slip it has
   * largely invented is reporting the wrong thing.
   */
  confidence: number;
};

export type SlipReader = {
  /** Named so a scan can be investigated against the reader that made it. */
  readonly name: string;
  read(image: Uint8Array): Promise<SlipRead>;
};

/**
 * Why a read could not be used.
 *
 * Each one names a defence that would have been missing, which is why
 * these are refusals rather than warnings. See lib/stores/receipt.ts for
 * the three defences themselves.
 */
export type ReadFailure =
  | "NO_READER"
  | "NO_STORE"
  | "NO_SLIP_NUMBER"
  | "NO_DATE"
  | "NO_TOTAL"
  | "LOW_CONFIDENCE";

/**
 * What a shopper is told, while they are still holding the slip.
 *
 * Specific on purpose. "We couldn't read that" invites the same photograph
 * again; naming the part that failed invites a better one.
 */
export const READ_FAILURE_MESSAGES: Record<ReadFailure, string> = {
  NO_READER: "Photographing a slip isn't switched on yet. Scan the code printed on the slip instead.",
  NO_STORE: "We couldn't make out which store this is from. Try again with the top of the slip in frame.",
  NO_SLIP_NUMBER: "We couldn't make out the slip number, and we need it to be sure this slip is only used once.",
  NO_DATE: "We couldn't make out the date on this slip.",
  NO_TOTAL: "We couldn't make out the total.",
  LOW_CONFIDENCE: "That photo came out too unclear to trust. Try again in better light, with the whole slip flat in frame.",
};

/**
 * How sure a reader has to be before we award money on its answer.
 *
 * Set high deliberately. The asymmetry is not symmetric: a refused read
 * costs an honest shopper one retake while they are still at the counter,
 * and an accepted misread either pays out on a total that was never spent
 * or burns a slip number that belonged to a different sale. One of those
 * is an inconvenience and the other is in the ledger for ever.
 *
 * It is a constant rather than a per-brand setting because a brand has no
 * way to judge it. If it ever becomes one it belongs beside the ceilings,
 * where the other numbers that bound a payout live.
 */
export const MIN_READ_CONFIDENCE = 0.85;

/** A read that passed, in the shape the redemption path already speaks. */
export type SlipFacts = {
  storeCode: string;
  externalTxnId: string;
  amountCents: number;
  purchasedAt: Date;
};

/**
 * Turns a read into facts, or says which defence would have been missing.
 *
 * Order matters here and is not alphabetical. The fields are checked in the
 * order a person photographing a slip can act on: which store, then the
 * number, then the date, then the total. Confidence is checked last,
 * because "that photo was too blurry" is useless advice when the real
 * problem is that they photographed the middle of the slip.
 */
export function factsFromRead(read: SlipRead): { ok: true; facts: SlipFacts } | { ok: false; reason: ReadFailure } {
  if (!read.storeCode?.trim()) return { ok: false, reason: "NO_STORE" };
  if (!read.externalTxnId?.trim()) return { ok: false, reason: "NO_SLIP_NUMBER" };
  if (!read.purchasedAt || Number.isNaN(read.purchasedAt.getTime())) return { ok: false, reason: "NO_DATE" };
  // Zero is not a usable total: a percent of nothing is nothing, and a
  // slip that reads as R0.00 is a misread rather than a free basket.
  if (read.amountCents == null || !Number.isFinite(read.amountCents) || read.amountCents <= 0) {
    return { ok: false, reason: "NO_TOTAL" };
  }
  if (!Number.isFinite(read.confidence) || read.confidence < MIN_READ_CONFIDENCE) {
    return { ok: false, reason: "LOW_CONFIDENCE" };
  }

  return {
    ok: true,
    facts: {
      storeCode: read.storeCode.trim(),
      externalTxnId: read.externalTxnId.trim(),
      amountCents: Math.round(read.amountCents),
      purchasedAt: read.purchasedAt,
    },
  };
}

/** Everything a photographed slip can ever be worth, whatever the store. */
export const PHOTO_TIER: ProofTier = "PHOTO";

/**
 * The configured reader, or null.
 *
 * Null is the shipped state. `QUMO_SLIP_READER` names a reader once one
 * exists; naming an unknown one is a refusal rather than a silent fallback
 * to no reader at all, because a typo in a deploy variable should not
 * quietly turn a feature off and leave the console still offering it.
 */
export function slipReader(): SlipReader | null {
  const name = process.env.QUMO_SLIP_READER?.trim();
  if (!name) return null;
  throw new Error(
    `QUMO_SLIP_READER is set to "${name}" and no reader by that name is built. Unset it, or build the reader.`,
  );
}

/** Whether a brand can be offered the photograph tier at all. */
export function photoCaptureConfigured(): boolean {
  try {
    return slipReader() !== null;
  } catch {
    return false;
  }
}
