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
import { getBrandOverview } from "@/lib/console/overview";

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

/**
 * The ceilings exist and default to nothing, so a brand can switch on five
 * percent cashback with no bound at all. The console warned about unsigned
 * stores and said nothing about this — and worse, that warning told them
 * their ceilings bounded the cost, which is true only if they set one. A
 * warning that promises a limit nobody set is worse than no warning.
 */
describe("the overview counts what is unbounded", () => {
  const suffix = `${Date.now()}-uncapped`;
  let brand: Brand;

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: `Uncapped ${suffix}`, slug: `uncapped-${suffix}` } });
  });

  afterAll(async () => {
    await prisma.earnRule.deleteMany({ where: { brandId: brand.id } });
    await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
    await prisma.brand.delete({ where: { id: brand.id } });
  });

  async function liveCampaign(name: string, limits: { maxTotalAmount?: number; maxPerPersonPerDay?: number } = {}) {
    const campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name, status: "ACTIVE" },
    });
    await prisma.earnRule.create({
      data: {
        brandId: brand.id,
        campaignId: campaign.id,
        type: "FLAT_PER_SCAN",
        unit: "POINTS",
        amount: 10,
        maxTotalAmount: limits.maxTotalAmount ?? null,
        maxPerPersonPerDay: limits.maxPerPersonPerDay ?? null,
      },
    });
    return campaign;
  }

  it("counts a live promotion with no total ceiling", async () => {
    await liveCampaign("No ceiling");

    const overview = await getBrandOverview(brand.id);
    expect(overview.uncappedCampaigns).toBe(1);
    expect(overview.uncappedPerPerson).toBe(1);
  });

  it("stops counting one once a ceiling is set", async () => {
    const campaign = await prisma.campaign.findFirstOrThrow({
      where: { brandId: brand.id, name: "No ceiling" },
    });
    await prisma.earnRule.update({
      where: { campaignId: campaign.id },
      data: { maxTotalAmount: 50_000, maxPerPersonPerDay: 500 },
    });

    const overview = await getBrandOverview(brand.id);
    expect(overview.uncappedCampaigns).toBe(0);
    expect(overview.uncappedPerPerson).toBe(0);
  });

  it("counts the two ceilings separately, because they answer different questions", async () => {
    // A total budget but no per-person limit: the campaign cannot cost more
    // than the budget, but one shopper can take all of it in an afternoon.
    await liveCampaign("Budget but no per-person", { maxTotalAmount: 100_000 });

    const overview = await getBrandOverview(brand.id);
    expect(overview.uncappedCampaigns).toBe(0);
    expect(overview.uncappedPerPerson).toBe(1);
  });

  it("ignores a promotion that is not live", async () => {
    const campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Draft, no ceiling", status: "DRAFT" },
    });
    await prisma.earnRule.create({
      data: { brandId: brand.id, campaignId: campaign.id, type: "FLAT_PER_SCAN", unit: "POINTS", amount: 10 },
    });

    // A draft awards nothing, so it has nothing to bound. Counting it would
    // train people to ignore the warning, which is how a real one gets
    // missed.
    const overview = await getBrandOverview(brand.id);
    expect(overview.uncappedCampaigns).toBe(0);
  });
});

/**
 * The seven-day scan series behind the overview's sparkline.
 *
 * A chart drawn from a number rather than from data is decoration, and
 * decoration on a console page is worse than nothing: it implies a shape
 * that was never measured.
 */
describe("the seven-day scan series", () => {
  const suffix = `${Date.now()}-series`;
  let brand: Brand;
  let store: { id: string };
  let membership: { id: string };
  let campaign: { id: string };

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: `Series ${suffix}`, slug: `series-${suffix}` } });
    store = await prisma.store.create({
      data: { brandId: brand.id, name: "Sea Point", code: `SP-${suffix}`.slice(0, 40) },
    });
    const person = await prisma.person.create({
      data: { phoneHash: `series-${suffix}`, phoneEncrypted: "x" },
    });
    membership = await prisma.brandMembership.create({
      data: { brandId: brand.id, personId: person.id },
    });
    campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Cashback", status: "ACTIVE" },
    });
  });

  afterAll(async () => {
    await prisma.purchaseScan.deleteMany({ where: { brandId: brand.id } });
    await prisma.brandMembership.deleteMany({ where: { brandId: brand.id } });
    await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
    await prisma.store.deleteMany({ where: { brandId: brand.id } });
    await prisma.brand.delete({ where: { id: brand.id } });
  });

  async function scanAt(daysAgo: number, externalTxnId: string) {
    await prisma.purchaseScan.create({
      data: {
        brandId: brand.id,
        storeId: store.id,
        brandMembershipId: membership.id,
        campaignId: campaign.id,
        externalTxnId,
        amountCents: 10_000,
        wasSigned: true,
        purchasedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
        scannedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
      },
    });
  }

  it("always returns seven days, even with no scans at all", async () => {
    const { scansByDay } = await getBrandOverview(brand.id);
    expect(scansByDay).toHaveLength(7);
    expect(scansByDay.every((d) => d.count === 0)).toBe(true);
  });

  it("is oldest first, so the last bar is today", async () => {
    const { scansByDay } = await getBrandOverview(brand.id);
    const times = scansByDay.map((d) => d.day.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("counts each scan into its own day", async () => {
    await scanAt(0, `t-today-1-${suffix}`);
    await scanAt(0, `t-today-2-${suffix}`);
    await scanAt(3, `t-three-${suffix}`);

    const { scansByDay, scansLast7Days } = await getBrandOverview(brand.id);
    expect(scansByDay.at(-1)!.count).toBe(2);
    expect(scansByDay.reduce((sum, d) => sum + d.count, 0)).toBe(3);
    // And it agrees with the total shown above it, which is the one way a
    // chart can quietly lie about a number printed next to it.
    expect(scansLast7Days).toBe(3);
  });

  it("ignores a scan older than the window rather than adding an eighth bar", async () => {
    await scanAt(30, `t-old-${suffix}`);
    const { scansByDay } = await getBrandOverview(brand.id);
    expect(scansByDay).toHaveLength(7);
    expect(scansByDay.reduce((sum, d) => sum + d.count, 0)).toBe(3);
  });
});
