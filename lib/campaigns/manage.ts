import { z } from "zod";
import type { CampaignStatus, EarnRuleType, LedgerUnit, Role } from "@prisma/client";
import { forBrand } from "@/lib/db/tenant";
import { prisma } from "@/lib/db/client";
import { record } from "@/lib/audit/record";
import { requireRole } from "@/lib/auth/rbac";
import type { Actor } from "@/lib/staff/actor";

/**
 * Creating a promotion, switching it on and off, and putting a ceiling on
 * what it can cost.
 *
 * The two rule-setting functions already existed (lib/stores/manage.ts for
 * percent-of-spend, lib/packs/earn-rule.ts for flat-per-scan). What did not
 * exist was any way to make a campaign at all, to activate one, or to set
 * the three ceilings - which meant the only thing standing between a brand
 * and unbounded liability could be configured by a seed script and nothing
 * else. That is what this file is for.
 */

/**
 * Deliberately tighter than MANAGE_EARN_RULE_ROLES, which lets MARKETING set
 * what a scan is worth. Everything here decides what a promotion can *cost*
 * - its ceilings, and whether it is live - and that is a finance decision
 * rather than a marketing one.
 *
 * Worth noting the inconsistency rather than quietly papering over it: a
 * MARKETING user can currently set "1,000,000 points per scan" but not the
 * ceiling on it. Tightening that existing permission is a call for the
 * business, not a side effect of this file.
 */
export const MANAGE_CAMPAIGN_ROLES: Role[] = ["OWNER", "ADMIN"];

export class CampaignError extends Error {}

export type SessionLike = Actor;

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});

/**
 * A new promotion, always created paused.
 *
 * Never ACTIVE on creation, and that is the point: a campaign with no earn
 * rule and no ceilings that is live from the moment it is named is one
 * mis-click away from paying out without a bound. Configure, then switch on.
 */
export async function createCampaignForSession(session: SessionLike, formData: FormData) {
  requireRole(session.user.role as Role, MANAGE_CAMPAIGN_ROLES);

  const parsed = createSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  const campaign = await forBrand(session.user.brandId).campaign.create({
    data: {
      brandId: session.user.brandId,
      name: parsed.name,
      description: parsed.description ?? null,
      status: "DRAFT",
    },
  });

  await record(prisma, session.user, {
    action: "campaign.created",
    targetId: campaign.id,
    targetLabel: campaign.name,
  });

  return campaign;
}

/**
 * Switches a promotion on or off.
 *
 * Activation carries the same "only one spend-based rule at a time" check
 * that setting the rule does, and it has to.
 *
 * setSpendRuleForSession refuses when another campaign is *already active*
 * with a spend rule, which blocks the obvious sequence. It does not block
 * this one: configure two campaigns while both are paused - neither
 * conflicts, because neither is live - then switch them on one after the
 * other. Until this check existed, the second went live beside the first,
 * and a scanned slip became worth whichever row the database returned
 * first: the same purchase paying differently depending on nothing at all.
 */
export async function setCampaignStatusForSession(
  session: SessionLike,
  campaignId: string,
  status: CampaignStatus,
): Promise<void> {
  requireRole(session.user.role as Role, MANAGE_CAMPAIGN_ROLES);

  const scoped = forBrand(session.user.brandId);
  const campaign = await scoped.campaign.findFirst({
    where: { id: campaignId },
    include: { earnRule: { select: { type: true, maxTotalAmount: true } } },
  });
  if (!campaign) {
    throw new CampaignError("That promotion doesn't exist.");
  }

  if (status === "ACTIVE") {
    if (!campaign.earnRule) {
      throw new CampaignError("Set what this promotion awards before switching it on.");
    }

    if (campaign.earnRule.type === "PERCENT_OF_SPEND") {
      const conflicting = await scoped.campaign.findFirst({
        where: { status: "ACTIVE", id: { not: campaign.id }, earnRule: { type: "PERCENT_OF_SPEND" } },
      });
      if (conflicting) {
        throw new CampaignError(
          `"${conflicting.name}" is already running a spend-based promotion. Pause it first, so a till slip can only ever be worth one thing.`,
        );
      }
    }
  }

  await scoped.campaign.update({ where: { id: campaign.id }, data: { status } });

  // The status change is the event a brand asks about when their liability
  // moves, so the previous status is recorded beside the new one - "who
  // switched this on" is only half an answer without "from what".
  await record(prisma, session.user, {
    action: `campaign.${status.toLowerCase()}`,
    targetId: campaign.id,
    targetLabel: campaign.name,
    detail: { from: campaign.status, to: status },
  });
}

const limitsSchema = z.object({
  campaignId: z.string().trim().min(1),
  // Empty means "no ceiling", which is a real choice and a bad one. The UI
  // says so; the engine records what it is told.
  maxPerPersonPerDay: z.coerce.number().int().min(1).max(100_000_000).optional(),
  maxScansPerPersonPerDay: z.coerce.number().int().min(1).max(1_000).optional(),
  maxTotalAmount: z.coerce.number().int().min(1).max(1_000_000_000).optional(),
  completesAt: z.coerce.number().int().min(1).max(1_000).optional(),
});

/**
 * The three ceilings, plus the stamp-card size.
 *
 * These are what the forgery suite exists to justify: at a store whose till
 * cannot sign a slip, the shopper controls every field of the payload, and
 * the unique constraint on (storeId, externalTxnId) stops a slip being
 * *reused*, not invented. With the ceilings disabled the suite mints R1,000
 * from twenty fabricated slips and drains a R200 campaign twice over. They
 * are the bound, and until now only a seed script could set them.
 */
export async function setCampaignLimitsForSession(session: SessionLike, formData: FormData): Promise<void> {
  requireRole(session.user.role as Role, MANAGE_CAMPAIGN_ROLES);

  const raw = {
    campaignId: formData.get("campaignId"),
    maxPerPersonPerDay: formData.get("maxPerPersonPerDay") || undefined,
    maxScansPerPersonPerDay: formData.get("maxScansPerPersonPerDay") || undefined,
    maxTotalAmount: formData.get("maxTotalAmount") || undefined,
    completesAt: formData.get("completesAt") || undefined,
  };
  const parsed = limitsSchema.parse(raw);

  const scoped = forBrand(session.user.brandId);
  const campaign = await scoped.campaign.findFirst({
    where: { id: parsed.campaignId },
    include: { earnRule: { select: { id: true } } },
  });
  if (!campaign) {
    throw new CampaignError("That promotion doesn't exist.");
  }
  if (!campaign.earnRule) {
    throw new CampaignError("Set what this promotion awards before putting a ceiling on it.");
  }

  const limits = {
    // null rather than undefined, so clearing a field actually clears it.
    // undefined would leave the old ceiling in place while the form that
    // submitted it showed an empty box - the worst of both.
    maxPerPersonPerDay: parsed.maxPerPersonPerDay ?? null,
    maxScansPerPersonPerDay: parsed.maxScansPerPersonPerDay ?? null,
    maxTotalAmount: parsed.maxTotalAmount ?? null,
    completesAt: parsed.completesAt ?? null,
  };

  await scoped.earnRule.update({ where: { campaignId: campaign.id }, data: limits });

  // The ceilings are the bound on what a forged slip can mint, so removing
  // one is among the most consequential things anyone can do in the
  // console. Recorded with the actual numbers, not just "limits changed".
  await record(prisma, session.user, {
    action: "campaign.limits_changed",
    targetId: campaign.id,
    targetLabel: campaign.name,
    detail: limits,
  });
}

export type ConsoleCampaign = {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  rule: {
    type: EarnRuleType;
    unit: LedgerUnit;
    amount: number;
    basisPoints: number | null;
    minSpendCents: number | null;
    completesAt: number | null;
    maxPerPersonPerDay: number | null;
    maxScansPerPersonPerDay: number | null;
    maxTotalAmount: number | null;
  } | null;
  /**
   * Credits issued by this campaign so far, in the rule's own unit.
   *
   * Positive rows only: against maxTotalAmount, which is a cap on what may
   * be *issued*, a redemption does not buy back headroom. It is the same
   * sum applyAccrual checks, so what a brand reads here is what the ceiling
   * is actually measuring.
   */
  issued: number;
};

export async function listCampaignsForConsole(brandId: string): Promise<ConsoleCampaign[]> {
  const scoped = forBrand(brandId);

  const campaigns = await scoped.campaign.findMany({
    include: {
      earnRule: {
        select: {
          type: true,
          unit: true,
          amount: true,
          basisPoints: true,
          minSpendCents: true,
          completesAt: true,
          maxPerPersonPerDay: true,
          maxScansPerPersonPerDay: true,
          maxTotalAmount: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  if (campaigns.length === 0) return [];

  const issued = await scoped.pointsTransaction.groupBy({
    by: ["campaignId"],
    where: { amount: { gt: 0 } },
    _sum: { amount: true },
  });
  const issuedBy = new Map(issued.map((row) => [row.campaignId, row._sum.amount ?? 0]));

  return campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    rule: campaign.earnRule,
    issued: issuedBy.get(campaign.id) ?? 0,
  }));
}
