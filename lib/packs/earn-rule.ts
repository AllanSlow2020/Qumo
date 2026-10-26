import { z } from "zod";
import type { LedgerUnit, Role } from "@prisma/client";
import { forBrand } from "@/lib/db/tenant";
import { requireRole } from "@/lib/auth/rbac";
import type { Actor } from "@/lib/staff/actor";

export const MANAGE_EARN_RULE_ROLES: Role[] = ["OWNER", "ADMIN", "MARKETING"];

export class EarnRuleError extends Error {}

export type SessionLike = Actor;

const setEarnRuleSchema = z.object({
  campaignId: z.string().trim().min(1),
  unit: z.enum(["POINTS", "CENTS", "STAMPS"]),
  amount: z.coerce.number().int().min(1).max(1_000_000),
});

/**
 * What one scan of this campaign is worth. Separate from Reward, which
 * describes what a member is handed once they cross a threshold - this is
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
    update: {
      // `type` is set on the update and not only on the create, because a
      // promotion can be changed from one shape to the other and the row is
      // the same row. Leaving it out meant a spend rule switched to
      // per-scan kept type PERCENT_OF_SPEND while its amount changed: the
      // console saved, said so, and redrew the old kind, and a pack code
      // batch went on refusing to be created against a promotion that
      // looked correct on screen. The spend path has always done this - see
      // the mirror of it in lib/stores/manage.ts, which zeroes `amount`
      // for the same reason.
      type: "FLAT_PER_SCAN",
      unit: parsed.unit as LedgerUnit,
      amount: parsed.amount,
      // Cleared rather than left stale, so a rule switched back to
      // percent-of-spend cannot silently inherit a share nobody chose.
      basisPoints: null,
      minSpendCents: null,
    },
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
