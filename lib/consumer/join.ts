import type { EarnRuleType, LedgerUnit } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { forBrand } from "@/lib/db/tenant";
import { forPerson } from "./scope";

/**
 * Joining a brand's programme from a poster, and the rule that makes a
 * poster safe.
 *
 * A poster is one static code. Everyone who walks past can scan it, nobody
 * has to buy anything first, and a photograph of it works from the other
 * side of the country. It therefore proves *nothing*, and nothing in this
 * file awards value. That is not a limitation to be worked around later; it
 * is the distinction that lets a poster exist at all. A poster that pays out
 * is a poster that pays out to everyone who walks past it.
 *
 * What it can do is what a poster is actually for: explain the promotion and
 * let somebody opt in. Earning starts at the next till slip.
 *
 * (The plan allows a capped welcome bonus here. Deliberately not built: it
 * would make this the one unproven carrier that can move the ledger, and the
 * cap would then be the only thing standing between a printed poster and a
 * payout. If it is ever wanted, it belongs behind the same ceilings in
 * applyAccrual as everything else, not as a special case here.)
 */

export type Offer = {
  campaignId: string;
  campaignName: string;
  /** One line a shopper reads on a poster, in their terms rather than ours. */
  headline: string;
  /** The qualifying condition, when there is one. */
  condition: string | null;
};

function rands(cents: number): string {
  return cents % 100 === 0 ? `R${cents / 100}` : `R${(cents / 100).toFixed(2)}`;
}

function unitWord(amount: number, unit: LedgerUnit): string {
  switch (unit) {
    case "CENTS":
      return rands(amount);
    case "STAMPS":
      return `${amount} stamp${amount === 1 ? "" : "s"}`;
    case "POINTS":
    default:
      return `${amount} point${amount === 1 ? "" : "s"}`;
  }
}

/**
 * Turns an earn rule into the sentence a shopper reads.
 *
 * Exported because it is the same sentence the console should show a brand
 * when they configure a promotion — a brand ought to see the words their
 * customers will, not the basis points.
 */
export function describeEarnRule(rule: {
  type: EarnRuleType;
  unit: LedgerUnit;
  amount: number;
  basisPoints: number | null;
  minSpendCents: number | null;
  completesAt: number | null;
}): { headline: string; condition: string | null } {
  const condition = rule.minSpendCents ? `On purchases of ${rands(rule.minSpendCents)} or more.` : null;

  if (rule.type === "PERCENT_OF_SPEND" && rule.basisPoints) {
    // Basis points to a percentage, trimmed: 500 reads as "5%", 250 as
    // "2.5%", and neither should read as "5.00%".
    const percent = String(Number((rule.basisPoints / 100).toFixed(2)));
    return { headline: `Get ${percent}% of every purchase back`, condition };
  }

  if (rule.completesAt) {
    return {
      headline: `Collect ${unitWord(rule.amount, rule.unit)} per purchase — ${rule.completesAt} earns a reward`,
      condition,
    };
  }

  return { headline: `Earn ${unitWord(rule.amount, rule.unit)} on every purchase`, condition };
}

/** What this brand is currently offering, for the poster page to explain. */
export async function listOffers(brandId: string): Promise<Offer[]> {
  const campaigns = await forBrand(brandId).campaign.findMany({
    where: { status: "ACTIVE", earnRule: { isNot: null } },
    select: {
      id: true,
      name: true,
      earnRule: {
        select: { type: true, unit: true, amount: true, basisPoints: true, minSpendCents: true, completesAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return campaigns.flatMap((campaign) => {
    if (!campaign.earnRule) return [];
    const { headline, condition } = describeEarnRule(campaign.earnRule);
    return [{ campaignId: campaign.id, campaignName: campaign.name, headline, condition }];
  });
}

export type MembershipStatus = { joined: boolean; optedOut: boolean };

/** Where this shopper stands with this brand, for the page to decide what to say. */
export async function getMembershipStatus(personId: string, brandId: string): Promise<MembershipStatus> {
  const membership = await forPerson(personId).brandMembership.findFirst({
    where: { brandId },
    select: { optedOutAt: true },
  });
  if (!membership) return { joined: false, optedOut: false };
  return { joined: membership.optedOutAt === null, optedOut: membership.optedOutAt !== null };
}

/**
 * Opts a shopper in. Idempotent, and safe to call for somebody who left.
 *
 * An upsert rather than a find-then-create: two taps on a slow connection
 * are the ordinary case here, not the exotic one, and the unique constraint
 * on (brandId, personId) is what makes the second one harmless.
 *
 * Rejoining clears the opt-out stamp, because arriving at this page and
 * pressing the button is exactly the affirmative act that withdrawal was the
 * opposite of. Their ledger is untouched either way — someone who left and
 * came back finds their balance where they put it.
 */
export async function joinBrand(personId: string, brandId: string): Promise<void> {
  await prisma.brandMembership.upsert({
    where: { brandId_personId: { brandId, personId } },
    update: { optedOutAt: null },
    create: { brandId, personId },
  });
}
