import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The till-slip payload: what a point-of-sale prints into a QR, and how we
 * read it back.
 *
 * The format is chosen for who has to implement it. A receipt template in a
 * POS is usually a text-substitution engine - it can concatenate fields into
 * a string and, at best, call a hash function. It generally cannot build
 * JSON, base64-encode, or canonicalise anything. So the payload is a flat
 * query string with short keys, and the signed message is a plain
 * pipe-joined concatenation of the values in a fixed order. A vendor can
 * implement this in a template language; asking them for base64 of a JSON
 * document would get a "no" that has nothing to do with willingness.
 *
 *   https://qumo.app/r?s=CL04&t=884231&c=8500&d=1755512582&g=<hmac>
 *
 *   s  store code
 *   t  the till's own transaction id - opaque to us, must be unique per store
 *   c  basket total in cents
 *   d  unix seconds when the sale happened
 *   g  HMAC-SHA256 of "s|t|c|d" with the store's secret, hex, truncated
 *
 * `g` is optional, deliberately. See the note on Store.signingSecretEncrypted:
 * whether a given vendor can compute an HMAC inside a template is unknown
 * until they are asked, and a scheme that only works when the answer is yes
 * has nothing to offer a brand whose answer is no.
 */

export const RECEIPT_PARAM = {
  store: "s",
  txn: "t",
  cents: "c",
  at: "d",
  signature: "g",
} as const;

/**
 * 20 hex characters - 80 bits. Full SHA-256 hex is 64 characters, which on
 * a receipt QR is a real cost: more modules, denser code, worse scanning off
 * thermal paper that has been in a pocket. 80 bits is far beyond forging by
 * search, and the secret is per store, so the truncation is a size decision
 * rather than a security compromise.
 */
const SIGNATURE_LENGTH = 20;

export type ReceiptPayload = {
  storeCode: string;
  externalTxnId: string;
  amountCents: number;
  purchasedAt: Date;
  signature: string | null;
};

export type PayloadParseFailure =
  | "MISSING_FIELDS"
  | "BAD_AMOUNT"
  | "BAD_TIMESTAMP"
  | "BAD_FORMAT";

/**
 * The exact string a POS must sign, and that we re-derive to verify. Order
 * is fixed and documented because a vendor implements it from the spec, not
 * from this code - anything order-dependent or locale-dependent here would
 * be a bug they cannot see.
 */
export function signingMessage(fields: {
  storeCode: string;
  externalTxnId: string;
  amountCents: number;
  purchasedAtUnix: number;
}): string {
  return [fields.storeCode, fields.externalTxnId, String(fields.amountCents), String(fields.purchasedAtUnix)].join("|");
}

export function signReceipt(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex").slice(0, SIGNATURE_LENGTH);
}

/**
 * Parses the query parameters off a scanned URL. Returns a failure reason
 * rather than throwing - /r is a public endpoint and malformed input is an
 * ordinary event there, not an exception.
 */
export function parseReceiptPayload(params: URLSearchParams): ReceiptPayload | PayloadParseFailure {
  const storeCode = params.get(RECEIPT_PARAM.store)?.trim().toUpperCase();
  const externalTxnId = params.get(RECEIPT_PARAM.txn)?.trim();
  const rawCents = params.get(RECEIPT_PARAM.cents)?.trim();
  const rawAt = params.get(RECEIPT_PARAM.at)?.trim();
  const signature = params.get(RECEIPT_PARAM.signature)?.trim() ?? null;

  if (!storeCode || !externalTxnId || !rawCents || !rawAt) {
    return "MISSING_FIELDS";
  }
  // Bounded so a store code or transaction id cannot be used to push
  // unbounded strings into the database.
  if (storeCode.length > 40 || externalTxnId.length > 80) {
    return "BAD_FORMAT";
  }

  // Digits only: parseInt would happily read "85abc" as 85, and a basket
  // total that quietly loses its tail is exactly the bug that pays out
  // wrong amounts forever.
  if (!/^\d{1,10}$/.test(rawCents)) {
    return "BAD_AMOUNT";
  }
  const amountCents = Number(rawCents);
  if (amountCents <= 0) {
    return "BAD_AMOUNT";
  }

  if (!/^\d{1,12}$/.test(rawAt)) {
    return "BAD_TIMESTAMP";
  }
  const purchasedAt = new Date(Number(rawAt) * 1000);
  if (Number.isNaN(purchasedAt.getTime())) {
    return "BAD_TIMESTAMP";
  }

  if (signature !== null && !/^[0-9a-fA-F]{1,64}$/.test(signature)) {
    return "BAD_FORMAT";
  }

  return { storeCode, externalTxnId, amountCents, purchasedAt, signature };
}

/**
 * Constant-time comparison of a supplied signature against the expected
 * one. Length is checked first because timingSafeEqual throws on a
 * mismatch rather than returning false; that leaks only the length, which
 * is fixed and published in the spec above.
 */
export function verifySignature(secret: string, message: string, supplied: string): boolean {
  const expected = signReceipt(secret, message);
  const expectedBuf = Buffer.from(expected.toLowerCase());
  const suppliedBuf = Buffer.from(supplied.toLowerCase());
  if (expectedBuf.length !== suppliedBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, suppliedBuf);
}

/** Builds a scan URL - used by the dashboard's spec page and by tests. */
export function buildReceiptUrl(
  origin: string,
  fields: { storeCode: string; externalTxnId: string; amountCents: number; purchasedAt: Date },
  secret?: string | null,
): string {
  const purchasedAtUnix = Math.floor(fields.purchasedAt.getTime() / 1000);
  const params = new URLSearchParams({
    [RECEIPT_PARAM.store]: fields.storeCode,
    [RECEIPT_PARAM.txn]: fields.externalTxnId,
    [RECEIPT_PARAM.cents]: String(fields.amountCents),
    [RECEIPT_PARAM.at]: String(purchasedAtUnix),
  });
  if (secret) {
    const message = signingMessage({ ...fields, purchasedAtUnix });
    params.set(RECEIPT_PARAM.signature, signReceipt(secret, message));
  }
  return `${origin}/r?${params.toString()}`;
}
