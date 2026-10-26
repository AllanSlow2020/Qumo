import { forBrand } from "@/lib/db/tenant";

/**
 * What a brand still has to do before a customer can earn anything.
 *
 * The console's landing page was a row of five metrics, and for a brand on
 * their first day every one of them reads "-" or "0". That is not a quiet
 * dashboard, it is a dead end: nothing on the screen says what Qumo does,
 * what to do next, or that anything is missing at all. One tile even said
 * "All signing their slips" under a count of zero stores, which reads as
 * reassurance about something that does not exist.
 *
 * So the page asks the database what is actually missing and says so. Not a
 * tour and not a tooltip - every line here is a fact about this brand that
 * the console already knew and was not telling anybody.
 *
 * It ends by itself. The moment a real scan lands the guide is replaced by
 * the metrics, because at that point the metrics have something to say.
 */

export type SetupFacts = {
  campaigns: number;
  /** Campaigns that say what they award. Without one, nothing can go live. */
  campaignsWithRule: number;
  /** Campaigns with a ceiling on what they may ever issue. */
  campaignsWithBudget: number;
  activeCampaigns: number;
  /** Printed runs of pack codes. One of the two ways a customer gets a code. */
  packBatches: number;
  /** Stores whose point of sale can sign a slip. The other way. */
  signingStores: number;
  /**
   * Whether anybody has ever earned anything here.
   *
   * Positive ledger rows only. A redemption is not evidence that the
   * programme works, and a brand with one scan and one spend has still had
   * its first scan.
   */
  everAwarded: boolean;
};

export type SetupStep = {
  id: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  done: boolean;
};

/**
 * The six steps, in the order the engine enforces them.
 *
 * Pure, so the wording and the ordering can be tested without a database -
 * and the wording is the part of this that can be wrong in a way somebody
 * notices on their first morning.
 */
export function setupSteps(f: SetupFacts): SetupStep[] {
  return [
    {
      id: "promotion",
      title: "Create a promotion",
      detail: "Give it a name you will recognise. It starts switched off, so nothing can happen by accident.",
      href: "/promotions",
      cta: "Go to promotions",
      done: f.campaigns > 0,
    },
    {
      id: "rule",
      title: "Say what it awards",
      detail:
        "A share of what they spend, a fixed amount per scan, or a stamp toward a card. This is the offer your customer reads.",
      href: "/promotions",
      cta: "Set what it awards",
      done: f.campaignsWithRule > 0,
    },
    {
      id: "ceiling",
      title: "Put a ceiling on what it can cost",
      detail:
        "The most this promotion may ever issue. Nothing else bounds it - not the engine, not your plan - so this number is the answer when somebody asks what it can cost.",
      href: "/promotions",
      cta: "Set a ceiling",
      done: f.campaignsWithBudget > 0,
    },
    {
      id: "codes",
      title: "Give customers something to scan",
      detail:
        "Print a run of pack codes to go under a label, or add the stores whose till slips will carry a code. Each one works once, which is what makes it proof of a purchase.",
      href: "/codes",
      cta: "Print pack codes",
      done: f.packBatches > 0 || f.signingStores > 0,
    },
    {
      id: "live",
      title: "Switch it on",
      detail: "Until you do, a code scans and earns nothing. Your customer sees a page that says so.",
      href: "/promotions",
      cta: "Switch it on",
      done: f.activeCampaigns > 0,
    },
    {
      id: "scan",
      title: "Scan one yourself",
      detail:
        "Open a code on your own phone and watch it land. It is the only step that proves the other five, and it costs you one code.",
      href: "/codes",
      cta: "See your codes",
      done: f.everAwarded,
    },
  ];
}

export async function getSetupFacts(brandId: string): Promise<SetupFacts> {
  const scoped = forBrand(brandId);

  // Counted in one round trip. A landing page that takes seven sequential
  // queries to say "you have done nothing yet" is a slow way to say it.
  const [campaigns, campaignsWithRule, campaignsWithBudget, activeCampaigns, packBatches, signingStores, awarded] =
    await Promise.all([
      scoped.campaign.count(),
      scoped.campaign.count({ where: { earnRule: { isNot: null } } }),
      scoped.campaign.count({ where: { earnRule: { is: { maxTotalAmount: { not: null } } } } }),
      scoped.campaign.count({ where: { status: "ACTIVE" } }),
      scoped.packBatch.count(),
      scoped.store.count({ where: { isActive: true, signingSecretEncrypted: { not: null } } }),
      scoped.pointsTransaction.count({ where: { amount: { gt: 0 } }, take: 1 }),
    ]);

  return {
    campaigns,
    campaignsWithRule,
    campaignsWithBudget,
    activeCampaigns,
    packBatches,
    signingStores,
    everAwarded: awarded > 0,
  };
}
