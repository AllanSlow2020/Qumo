import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ForbiddenError } from "@/lib/auth/rbac";
import {
  CampaignError,
  createCampaignForSession,
  listCampaignsForConsole,
  setCampaignLimitsForSession,
  setCampaignStatusForSession,
} from "@/lib/campaigns/manage";
import { setSpendRuleForSession } from "@/lib/stores/manage";
import { setEarnRuleForSession } from "@/lib/packs/earn-rule";

describe("running a promotion from the console", () => {
  const suffix = Date.now();

  let brand: Brand;
  let otherBrand: Brand;

  const owner = (brandId: string) => ({ user: { id: `${brandId}-owner`, brandId, role: "OWNER", name: "Test Owner" } });
  const marketing = (brandId: string) => ({ user: { id: `${brandId}-marketing`, brandId, role: "MARKETING", name: "Test Marketing" } });

  function form(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  async function newCampaign(name: string) {
    return createCampaignForSession(owner(brand.id), form({ name }));
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Licken", slug: `camp-a-${suffix}` } });
    otherBrand = await prisma.brand.create({ data: { name: "Campari", slug: `camp-b-${suffix}` } });
  });

  afterAll(async () => {
    for (const b of [brand, otherBrand]) {
      await prisma.pointsTransaction.deleteMany({ where: { brandId: b.id } });
      await prisma.brandMembership.deleteMany({ where: { brandId: b.id } });
      await prisma.earnRule.deleteMany({ where: { brandId: b.id } });
      await prisma.campaign.deleteMany({ where: { brandId: b.id } });
      await prisma.brand.delete({ where: { id: b.id } });
    }
  });

  it("creates a promotion switched off", async () => {
    // Never live on creation. A campaign with no rule and no ceilings that
    // is active from the moment it is named is one mis-click from paying
    // out without a bound.
    const campaign = await newCampaign(`Draft ${suffix}`);
    expect(campaign.status).toBe("DRAFT");
  });

  it("refuses to switch on a promotion that awards nothing", async () => {
    const campaign = await newCampaign(`Empty ${suffix}`);
    await expect(setCampaignStatusForSession(owner(brand.id), campaign.id, "ACTIVE")).rejects.toThrow(CampaignError);
  });

  it("switches on once it has a rule, and off again", async () => {
    const campaign = await newCampaign(`Stamps ${suffix}`);
    await setEarnRuleForSession(owner(brand.id), form({ campaignId: campaign.id, unit: "STAMPS", amount: "1" }));

    await setCampaignStatusForSession(owner(brand.id), campaign.id, "ACTIVE");
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).status).toBe("ACTIVE");

    await setCampaignStatusForSession(owner(brand.id), campaign.id, "PAUSED");
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).status).toBe("PAUSED");
  });

  it("refuses a second live spend-based promotion — including by the back door", async () => {
    // The hole this test exists for.
    //
    // setSpendRuleForSession refuses when another campaign is *already
    // active* with a spend rule, which blocks the obvious sequence. It does
    // not block this one: configure both while both are paused — neither
    // conflicts, because neither is live — and then switch them on one after
    // the other. Nothing checked activation, so the second one went live
    // beside the first.
    //
    // Two live percent-of-spend campaigns make a scanned slip worth
    // whichever row the database returns first, so the same purchase pays
    // differently depending on nothing at all.
    const first = await newCampaign(`Spend one ${suffix}`);
    const second = await newCampaign(`Spend two ${suffix}`);
    await setSpendRuleForSession(owner(brand.id), form({ campaignId: first.id, unit: "CENTS", basisPoints: "500" }));
    await setSpendRuleForSession(owner(brand.id), form({ campaignId: second.id, unit: "CENTS", basisPoints: "900" }));

    await setCampaignStatusForSession(owner(brand.id), first.id, "ACTIVE");
    // Activation is the only place left to catch it.
    await expect(setCampaignStatusForSession(owner(brand.id), second.id, "ACTIVE")).rejects.toThrow(CampaignError);

    const live = await prisma.campaign.count({
      where: { brandId: brand.id, status: "ACTIVE", earnRule: { type: "PERCENT_OF_SPEND" } },
    });
    expect(live).toBe(1);

    // Pause the first and the second is allowed, which is the whole point of
    // refusing rather than silently picking one.
    await setCampaignStatusForSession(owner(brand.id), first.id, "PAUSED");
    await setCampaignStatusForSession(owner(brand.id), second.id, "ACTIVE");
    await setCampaignStatusForSession(owner(brand.id), second.id, "PAUSED");
  });

  it("lets two stamp promotions run at once", async () => {
    // The restriction is specific to spend-based rules, because only those
    // are resolved from a till slip with nothing else to disambiguate them.
    const a = await newCampaign(`Stamp A ${suffix}`);
    const b = await newCampaign(`Stamp B ${suffix}`);
    for (const c of [a, b]) {
      await setEarnRuleForSession(owner(brand.id), form({ campaignId: c.id, unit: "POINTS", amount: "10" }));
      await setCampaignStatusForSession(owner(brand.id), c.id, "ACTIVE");
    }
    const live = await prisma.campaign.count({ where: { brandId: brand.id, status: "ACTIVE" } });
    expect(live).toBeGreaterThanOrEqual(2);
  });

  it("sets the three ceilings, and clears them when asked", async () => {
    const campaign = await newCampaign(`Capped ${suffix}`);
    await setEarnRuleForSession(owner(brand.id), form({ campaignId: campaign.id, unit: "CENTS", amount: "100" }));

    await setCampaignLimitsForSession(
      owner(brand.id),
      form({
        campaignId: campaign.id,
        maxPerPersonPerDay: "5000",
        maxScansPerPersonPerDay: "5",
        maxTotalAmount: "500000",
      }),
    );

    let rule = await prisma.earnRule.findUniqueOrThrow({ where: { campaignId: campaign.id } });
    expect(rule.maxPerPersonPerDay).toBe(5_000);
    expect(rule.maxScansPerPersonPerDay).toBe(5);
    expect(rule.maxTotalAmount).toBe(500_000);

    // Submitting empty boxes must actually clear them. Leaving the old
    // ceiling in place while the form shows an empty field is the worst of
    // both — the brand believes there is no cap and there is, or believes
    // there is one and there isn't.
    await setCampaignLimitsForSession(owner(brand.id), form({ campaignId: campaign.id }));
    rule = await prisma.earnRule.findUniqueOrThrow({ where: { campaignId: campaign.id } });
    expect(rule.maxPerPersonPerDay).toBeNull();
    expect(rule.maxTotalAmount).toBeNull();
  });

  it("refuses a ceiling on a promotion that awards nothing yet", async () => {
    const campaign = await newCampaign(`No rule ${suffix}`);
    await expect(
      setCampaignLimitsForSession(owner(brand.id), form({ campaignId: campaign.id, maxTotalAmount: "1000" })),
    ).rejects.toThrow(CampaignError);
  });

  it("reports what a promotion has issued, ignoring what came back", async () => {
    const campaign = await newCampaign(`Burn ${suffix}`);
    await setEarnRuleForSession(owner(brand.id), form({ campaignId: campaign.id, unit: "CENTS", amount: "100" }));
    await setCampaignLimitsForSession(owner(brand.id), form({ campaignId: campaign.id, maxTotalAmount: "10000" }));

    const person = await prisma.person.create({
      data: { phoneHash: `camp-${suffix}`, phoneEncrypted: "x", firstName: "T" },
    });
    const membership = await prisma.brandMembership.create({
      data: { brandId: brand.id, personId: person.id },
    });
    await prisma.pointsTransaction.createMany({
      data: [
        { brandId: brand.id, brandMembershipId: membership.id, campaignId: campaign.id, amount: 400, unit: "CENTS", reason: "PURCHASE_ACCRUAL" },
        { brandId: brand.id, brandMembershipId: membership.id, campaignId: campaign.id, amount: -150, unit: "CENTS", reason: "WALLET_SPENT" },
      ],
    });

    const listed = (await listCampaignsForConsole(brand.id)).find((c) => c.id === campaign.id);
    // 400, not 250. maxTotalAmount caps what may be *issued*, so a
    // redemption does not buy back headroom — and the number a brand reads
    // has to be the one the ceiling actually measures.
    expect(listed?.issued).toBe(400);
    expect(listed?.rule?.maxTotalAmount).toBe(10_000);

    await prisma.pointsTransaction.deleteMany({ where: { brandMembershipId: membership.id } });
    await prisma.brandMembership.delete({ where: { id: membership.id } });
    await prisma.person.delete({ where: { id: person.id } });
  });

  it("refuses a role that can't change what a promotion costs", async () => {
    await expect(createCampaignForSession(marketing(brand.id), form({ name: "Nope" }))).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("refuses to touch another brand's promotion", async () => {
    const campaign = await newCampaign(`Ours ${suffix}`);
    await expect(
      setCampaignStatusForSession(owner(otherBrand.id), campaign.id, "ACTIVE"),
    ).rejects.toThrow(CampaignError);
    expect((await listCampaignsForConsole(otherBrand.id)).length).toBe(0);
  });
});
