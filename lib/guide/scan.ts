import { percentOfSpend } from "@/lib/ledger/percent";
import { formatPercent, formatRand } from "@/lib/guide/cost";

/**
 * What happens when somebody scans each kind of code: the demonstration on
 * the console's How it works page, as a pure function so it can be tested.
 *
 * ── What it is held to ───────────────────────────────────────────────────
 *
 * Every outcome here restates a rule the engine enforces, and none of them is
 * invented to make the page more interesting:
 *
 *   - a poster code never awards, so scanning it, or scanning a photograph of
 *     it, earns nothing;
 *   - a pack code works once, ever, so the second scan adds nothing and only
 *     says what it was worth;
 *   - a till slip carries the basket total and the till's signature over it,
 *     so a changed total is refused, and the amount a good one earns is
 *     rounded the way the ledger rounds it (`percentOfSpend`).
 *
 * The amounts are examples. The page says so. The rules are not.
 */

export type ScanCode = "poster" | "pack" | "slip";

/** What the reader can do to the code in front of them. */
export type ScanAction = "scan" | "photo" | "edit";

export type OutcomeTone = "none" | "earned" | "used" | "refused";

export interface ScanOutcome {
  tone: OutcomeTone;
  /** The result, in a line. */
  line: string;
  /** Why, in a sentence. */
  detail: string;
}

/** What a pack code is worth in the example. */
export const PACK_CENTS = 500;
/** The basket on the example receipt, and the share it earns. */
export const SLIP_BASKET_CENTS = 18_450;
export const SLIP_BASIS_POINTS = 500;
/** What a customer changes the total to, to see the signature refuse it. */
export const SLIP_EDITED_CENTS = 184_500;

/** The actions each code offers, in the order the buttons appear. */
export const ACTIONS: Record<ScanCode, { action: ScanAction; label: string }[]> = {
  poster: [
    { action: "scan", label: "Scan it" },
    { action: "photo", label: "Scan a photo of it" },
  ],
  pack: [{ action: "scan", label: "Scan it" }],
  slip: [
    { action: "scan", label: "Scan it" },
    { action: "edit", label: "Edit the total" },
  ],
};

/** 922.5 cents as "R9.225", for showing the part of a cent the ledger drops. */
function exactRand(cents: number): string {
  return `R${Number((cents / 100).toFixed(4))}`;
}

/**
 * `alreadyEarned` is whether this code has paid out yet in the demonstration.
 * A code that has paid is spent, which is the whole of "each code earns once".
 */
export function scanOutcome(code: ScanCode, action: ScanAction, alreadyEarned: boolean): ScanOutcome {
  if (code === "poster") {
    return action === "photo"
      ? {
          tone: "none",
          line: "Scanned a photo of it. Nothing earned.",
          detail: "A photograph of a poster is as good as the poster, which is why a poster code never awards anything.",
        }
      : {
          tone: "none",
          line: "Scanned. Nothing earned.",
          detail: "Anybody could have scanned this, so scanning it proves nothing. It explains the promotion and takes a sign-up.",
        };
  }

  if (code === "slip" && action === "edit") {
    return {
      tone: "refused",
      line: `Refused. The total was changed to ${formatRand(SLIP_EDITED_CENTS)}.`,
      detail:
        "The till signed this slip with a secret only it holds. Change the total and the signature no longer matches, so nothing is awarded.",
    };
  }

  if (alreadyEarned) {
    return {
      tone: "used",
      line: "Already used. Nothing added.",
      detail:
        code === "pack"
          ? "Each pack code works once, ever. A second scan only tells the customer what it was worth."
          : "Each till slip code works once, ever. A second scan only tells the customer what it was worth.",
    };
  }

  if (code === "pack") {
    return {
      tone: "earned",
      line: `Earned ${formatRand(PACK_CENTS)}.`,
      detail: "A pack code proves the item was bought. It has paid out, and it is spent now.",
    };
  }

  const exactCents = (SLIP_BASKET_CENTS * SLIP_BASIS_POINTS) / 10_000;
  const paidCents = percentOfSpend(SLIP_BASKET_CENTS, SLIP_BASIS_POINTS);
  const fractional = exactCents !== paidCents;
  return {
    tone: "earned",
    line: `Earned ${formatRand(paidCents)}.`,
    detail: fractional
      ? `${formatPercent(SLIP_BASIS_POINTS)} of ${formatRand(SLIP_BASKET_CENTS)} comes to ${exactRand(exactCents)}. The ledger never pays part of a cent, so it rounds down to ${formatRand(paidCents)}.`
      : `${formatPercent(SLIP_BASIS_POINTS)} of ${formatRand(SLIP_BASKET_CENTS)} is exactly ${formatRand(paidCents)}.`,
  };
}
