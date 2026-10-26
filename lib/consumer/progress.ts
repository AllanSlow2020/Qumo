import type { LedgerUnit } from "@prisma/client";
import { forBrand } from "@/lib/db/tenant";

/**
 * How far along a stamp card somebody is.
 *
 * Split out from wallet.ts because the two answer different questions. A
 * wallet says what a shopper holds; this says what they are working toward,
 * and that lives on the campaign rather than on the ledger - the balance
 * alone cannot tell you whether five stamps is nearly a card or barely a
 * start.
 *
 * It is the one number the shopper surface was missing. A stamp card's whole
 * appeal is watching the gaps fill, and until now the wallet rendered it as
 * "5 stamps" in a monospace font: a true statement that removes the only
 * reason anybody collects stamps.
 */

export type CardTarget = {
  campaignId: string;
  campaignName: string;
  unit: LedgerUnit;
  /** How much of `unit` completes one card. */
  completesAt: number;
  /**
   * What the brand calls the thing at the end, or null when they have not
   * said. Null is the common case rather than an edge one - see the note on
   * cardStanding() about why that changes what the screen may promise.
   */
  rewardName: string | null;
};

export type CardStanding = {
  target: CardTarget;
  /** Marks to draw filled, never more than the card holds. */
  filled: number;
  total: number;
  remaining: number;
  /** The sentence under the marks. */
  line: string;
};

function unitWord(amount: number, unit: LedgerUnit): string {
  const one = unit === "STAMPS" ? "stamp" : "point";
  return `${one}${amount === 1 ? "" : "s"}`;
}

/**
 * The standing, and the line that goes under it.
 *
 * Pure, so the wording can be tested without a database - which matters,
 * because the wording is the part that can be wrong in a way a shopper
 * notices.
 *
 * Two things it will not do:
 *
 * It will not promise a reward the brand has not named. A campaign can carry
 * completesAt with no Reward row behind it, and in that state the engine
 * issues nothing on completion (lib/ledger/accrue.ts: `completesAt != null
 * && reward`). Writing "2 more and you've earned it" over a card that cannot
 * complete would be the screen lying about the one thing it exists to say.
 *
 * It will not draw more marks than the card holds. Completion deducts a
 * card's worth as a ledger row, so a balance normally sits below the target
 * - but a card with no reward behind it never completes, and the balance
 * climbs straight past it. Clamping is what stops eleven stamps rendering as
 * a row of ten plus one orphan.
 */
export function cardStanding(target: CardTarget, have: number): CardStanding {
  const total = target.completesAt;
  const filled = Math.min(Math.max(have, 0), total);
  const remaining = total - filled;

  const line =
    remaining === 0
      ? target.rewardName
        ? `Your card is full. ${target.rewardName} is waiting at the till.`
        : "Your card is full."
      : target.rewardName
        ? `${remaining} more ${unitWord(remaining, target.unit)} and ${target.rewardName} is yours.`
        : `${remaining} more ${unitWord(remaining, target.unit)} to complete this card.`;

  return { target, filled, total, remaining, line };
}

/**
 * The card this brand is currently running, if it is running one.
 *
 * The first active campaign with a completion threshold, matching how
 * listOffers() leads with the first offer: a brand may run more than one
 * thing, and the wallet shows the card rather than every card. If that ever
 * stops being enough it is a list, not a different query.
 */
export async function getCardTarget(brandId: string): Promise<CardTarget | null> {
  const campaign = await forBrand(brandId).campaign.findFirst({
    // `is` rather than `isNot: null` plus a field filter: the relation
    // filter and the field filter are the same condition here, and Prisma
    // only accepts them nested this way round.
    where: { status: "ACTIVE", earnRule: { is: { completesAt: { not: null } } } },
    select: {
      id: true,
      name: true,
      earnRule: { select: { unit: true, completesAt: true } },
      reward: { select: { rewardName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const completesAt = campaign?.earnRule?.completesAt;
  if (!campaign || !campaign.earnRule || !completesAt) return null;

  // Empty string, not just null: rewardName defaults to "" in the schema, so
  // a Reward row that nobody filled in is indistinguishable from no row at
  // all as far as the shopper is concerned - and both have to produce the
  // quieter sentence rather than "and  is yours".
  const rewardName = campaign.reward?.rewardName?.trim();

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    unit: campaign.earnRule.unit,
    completesAt,
    rewardName: rewardName ? rewardName : null,
  };
}
