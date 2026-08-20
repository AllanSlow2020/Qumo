import { z } from "zod";
import type { LedgerUnit, Role } from "@prisma/client";
import { forBrand } from "@/lib/db/tenant";
import { requireRole } from "@/lib/auth/rbac";

export const MANAGE_EARN_RULE_ROLES: Role[] = ["OWNER", "ADMIN", "MARKETING"];

export class EarnRuleError extends Error {}

export type SessionLike = { user: { brandId: string; role: string } };

const setEarnRuleSchema = z.object({
  campaignId: z.string().trim().min(1),
  unit: z.enum(["POINTS", "CENTS", "STAMPS"]),
  amount: z.coerce.number().int().min(1).max(1_000_000),
});

/**
 * What one scan of this campaign is worth. Separate from Reward, which
 * describes what a member is handed once they cross a threshold — this is
 * what each scan contributes on the way there.
 *
 * Upserted rather than created: a campaign has at most one earn rule
 * (enforced by a unique constraint on campaignId), and a brand adjusting
 * "50 points" to "60 points" is editing the same rule, not adding a second.
 * Codes already printed keep working and simply start awarding the new
 * amount, which is the behaviour a brand expects from a live campaign.
 */
export async function setEarnRuleForSession(session: SessionLike, formData: FormData) {
  requireRole(session.user.role as Role, MANAGE_EARN_RULE_ROLES);

  const parsed = setEarnRuleSchema.parse({
    campaignId: formData.get("campaignId"),
    unit: formData.get("unit"),
    amount: formData.get("amount"),
  });

  const scoped = forBrand(session.user.brandId);

  const campaign = await scoped.campaign.findFirst({ where: { id: parsed.campaignId } });
  if (!campaign) {
    throw new EarnRuleError("That campaign doesn't exist.");
  }

  return scoped.earnRule.upsert({
    where: { campaignId: campaign.id },
    update: { unit: parsed.unit as LedgerUnit, amount: parsed.amount },
    create: {
      brandId: session.user.brandId,
      campaignId: campaign.id,
      type: "FLAT_PER_SCAN",
      unit: parsed.unit as LedgerUnit,
      amount: parsed.amount,
    },
  });
}

export type CampaignEarnRule = {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  unit: LedgerUnit | null;
  amount: number | null;
};

/** Every campaign and what it currently awards per scan, for the packs screen. */
export async function listCampaignEarnRules(brandId: string): Promise<CampaignEarnRule[]> {
  const scoped = forBrand(brandId);

  const campaigns = await scoped.campaign.findMany({
    include: { earnRule: { select: { unit: true, amount: true } } },
    orderBy: { createdAt: "desc" },
  });

  return campaigns.map((campaign) => ({
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignStatus: campaign.status,
    unit: campaign.earnRule?.unit ?? null,
    amount: campaign.earnRule?.amount ?? null,
  }));
}
