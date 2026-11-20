/**
 * What a basket is worth under a percent-of-spend rule, in the rule's unit.
 *
 * Rounds down. A shopper who is short a cent on a rounding boundary never
 * notices; a brand paying out a cent more than the rule says on every one
 * of a million transactions eventually does. Basis points rather than a
 * float percentage for the same reason the ledger is integer cents: 5% of
 * 8500 has to be exactly 425 every time, on every machine.
 *
 * ── Why this is its own file ─────────────────────────────────────────────
 *
 * It lived in lib/ledger/accrue.ts, which imports the coupon issuer and the
 * subscription state and so, through them, the database. A function this
 * small and this pure is also what the console's How it works page needs in
 * the browser, to let a brand see the rounding for itself, and a client
 * component cannot import a file that reaches the database. Splitting it out
 * means the guide runs the very function the ledger runs rather than a copy
 * of it, which is the property that makes the demonstration worth anything.
 * accrue.ts re-exports it, so every existing import is unchanged.
 */
export function percentOfSpend(amountCents: number, basisPoints: number): number {
  return Math.floor((amountCents * basisPoints) / 10_000);
}
