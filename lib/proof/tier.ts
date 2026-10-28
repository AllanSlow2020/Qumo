/**
 * How well a purchase was proved, as an ordered scale.
 *
 * ── Why this is a scale and not a boolean ────────────────────────────────
 *
 * It used to be one: `PurchaseScan.wasSigned`, recorded per scan with a
 * comment explaining that a store signed today may have been unsigned when
 * a given slip was scanned, and that a fraud investigation needs to know
 * which. That reasoning was right and the boolean was one value short.
 *
 * `lib/stores/receipt.ts` names three defences and is explicit that only
 * two of them are always available:
 *
 *   1. the signature, which stops a shopper editing the total, and needs
 *      the store to hold a signing secret;
 *   2. the unique constraint on (store, transaction id), which stops one
 *      slip earning twice;
 *   3. the freshness window, which stops a hoard of old slips being
 *      scanned the day a promotion launches.
 *
 * A photographed slip has neither a signature nor a guarantee that we read
 * the store, slip number and date correctly, so defences 2 and 3 hold only
 * as well as the read does. That is a third position on the same scale
 * rather than a different kind of thing, which is the whole reason this is
 * a scale: a brand can say how much proof it wants and the same comparison
 * answers every case.
 *
 * ── The order is strongest first, and the numbers are not stored ─────────
 *
 * RANK exists to compare, never to persist. The database stores the name,
 * so inserting a tier later does not silently re-grade every scan already
 * recorded.
 */

/** Mirrors the ProofTier enum in schema.prisma. */
export type ProofTier = "SIGNED" | "UNSIGNED" | "PHOTO";

/** Strongest to weakest. Lower is stronger. */
const RANK: Record<ProofTier, number> = {
  SIGNED: 0,
  UNSIGNED: 1,
  PHOTO: 2,
};

/** Weakest first, for a form where the brand is choosing how much to accept. */
export const PROOF_TIERS: ProofTier[] = ["SIGNED", "UNSIGNED", "PHOTO"];

/**
 * Whether a scan proved enough for a promotion that demands `floor`.
 *
 * Reads as "at least as strong as", so a signed slip satisfies a promotion
 * that would have accepted a photograph. The reverse never holds.
 */
export function meetsProofTier(scanned: ProofTier, floor: ProofTier): boolean {
  return RANK[scanned] <= RANK[floor];
}

/** The weaker of two tiers, for describing a combination. */
export function weakestTier(a: ProofTier, b: ProofTier): ProofTier {
  return RANK[a] >= RANK[b] ? a : b;
}

/**
 * What a brand is agreeing to, said in the console beside the choice.
 *
 * `gives` is what the tier still guarantees; `costs` is what it gives up.
 * Both are written to be true of the code rather than reassuring: a brand
 * choosing the weakest option should be able to see exactly what they have
 * traded away, because the ceilings are the only thing standing behind it.
 */
export const TIER_COPY: Record<ProofTier, { label: string; gives: string; costs: string }> = {
  SIGNED: {
    label: "Only slips signed by the till",
    gives:
      "The strongest proof there is. The total is signed by the store, so it cannot be edited between the till and the scan.",
    costs:
      "Every store has to hold a signing secret and print it on the slip. A store whose till cannot do that earns nothing.",
  },
  UNSIGNED: {
    label: "Any slip carrying a Qumo code",
    gives:
      "Each slip still earns once and only once, and only if it is recent. Both are enforced by the database rather than by a check that can be skipped.",
    costs:
      "A shopper who edits the total on their own receipt before scanning it will be believed. The till still has to print a Qumo code.",
  },
  PHOTO: {
    label: "A photograph of any till slip",
    gives:
      "Nothing has to change at the till, so any store can take part from the day the brand says so.",
    costs:
      "No signature, and the slip earns once only as reliably as the store, slip number and date are read off the picture. A misread either robs an honest shopper or pays a dishonest one. Set a total budget and a daily ceiling before using this.",
  },
};

/**
 * The sentence a shopper sees when their scan proved less than the
 * promotion asks for.
 *
 * Written to be about the promotion rather than about them: somebody
 * photographing a slip at a brand that only takes signed slips has done
 * nothing wrong, and telling them their evidence was rejected invites them
 * to try harder at the thing that will not work.
 */
export function tierRefusal(floor: ProofTier): string {
  if (floor === "SIGNED") {
    return "This promotion only accepts slips signed by the till. Scan the code printed on the slip itself.";
  }
  return "This promotion only accepts the code printed on the slip. Scan that instead of photographing it.";
}
