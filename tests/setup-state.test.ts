import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getSetupFacts, setupSteps, type SetupFacts } from "@/lib/console/setup-state";

const NOTHING: SetupFacts = {
  campaigns: 0,
  campaignsWithRule: 0,
  campaignsWithBudget: 0,
  activeCampaigns: 0,
  packBatches: 0,
  signingStores: 0,
  everAwarded: false,
};

const facts = (over: Partial<SetupFacts> = {}): SetupFacts => ({ ...NOTHING, ...over });
const doneIds = (f: SetupFacts) => setupSteps(f).filter((s) => s.done).map((s) => s.id);

describe("what a brand still has to do", () => {
  it("starts with nothing done, and says so in order", () => {
    const steps = setupSteps(NOTHING);
    expect(steps.map((s) => s.id)).toEqual(["promotion", "rule", "ceiling", "codes", "live", "scan"]);
    expect(steps.every((s) => !s.done)).toBe(true);
  });

  it("ticks each step off its own fact and nothing else", () => {
    // One at a time, because a checklist where any fact ticks the wrong box
    // is worse than no checklist: it tells somebody they have done
    // something they have not.
    expect(doneIds(facts({ campaigns: 1 }))).toEqual(["promotion"]);
    expect(doneIds(facts({ campaignsWithRule: 1 }))).toEqual(["rule"]);
    expect(doneIds(facts({ campaignsWithBudget: 1 }))).toEqual(["ceiling"]);
    expect(doneIds(facts({ activeCampaigns: 1 }))).toEqual(["live"]);
    expect(doneIds(facts({ everAwarded: true }))).toEqual(["scan"]);
  });

  it("accepts either way of giving somebody a code", () => {
    // Pack codes under a label and a till that signs its slips are two
    // routes to the same thing. A brand that has done one has done this
    // step, and a checklist that insisted on both would be wrong.
    expect(doneIds(facts({ packBatches: 1 }))).toEqual(["codes"]);
    expect(doneIds(facts({ signingStores: 1 }))).toEqual(["codes"]);
    expect(doneIds(facts({ packBatches: 2, signingStores: 3 }))).toEqual(["codes"]);
  });

  it("is complete only when somebody has actually earned something", () => {
    // Five of six is a brand that has configured everything and proved
    // nothing. The last step is the only one that says the whole chain
    // works end to end.
    const configured = facts({
      campaigns: 1,
      campaignsWithRule: 1,
      campaignsWithBudget: 1,
      activeCampaigns: 1,
      packBatches: 1,
    });
    expect(setupSteps(configured).filter((s) => s.done)).toHaveLength(5);
    expect(setupSteps({ ...configured, everAwarded: true }).every((s) => s.done)).toBe(true);
  });

  it("gives every step somewhere to go", () => {
    for (const step of setupSteps(NOTHING)) {
      expect(step.href.startsWith("/")).toBe(true);
      expect(step.cta.length).toBeGreaterThan(0);
      expect(step.detail.length).toBeGreaterThan(0);
    }
  });
});

describe("reading that state off the database", () => {
  const suffix = Date.now();
  let brand: Brand;
  let otherBrand: Brand;

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Harbour", slug: `setup-a-${suffix}` } });
    otherBrand = await prisma.brand.create({ data: { name: "Other", slug: `setup-b-${suffix}` } });
  });

  afterAll(async () => {
    for (const b of [brand, otherBrand]) {
      await prisma.pointsTransaction.deleteMany({ where: { brandId: b.id } });
      await prisma.brandMembership.deleteMany({ where: { brandId: b.id } });
      await prisma.packCode.deleteMany({ where: { brandId: b.id } });
      await prisma.packBatch.deleteMany({ where: { brandId: b.id } });
      await prisma.earnRule.deleteMany({ where: { brandId: b.id } });
      await prisma.campaign.deleteMany({ where: { brandId: b.id } });
      await prisma.store.deleteMany({ where: { brandId: b.id } });
      await prisma.brand.delete({ where: { id: b.id } });
    }
  });

  it("reads a brand-new brand as having done nothing", async () => {
    expect(await getSetupFacts(brand.id)).toEqual(NOTHING);
  });

  it("counts a promotion, its rule and its ceiling separately", async () => {
    const campaign = await prisma.campaign.create({ data: { brandId: brand.id, name: "C", status: "DRAFT" } });
    expect(await getSetupFacts(brand.id)).toMatchObject({ campaigns: 1, campaignsWithRule: 0, campaignsWithBudget: 0 });

    await prisma.earnRule.create({
      data: { brandId: brand.id, campaignId: campaign.id, type: "FLAT_PER_SCAN", unit: "STAMPS", amount: 1 },
    });
    expect(await getSetupFacts(brand.id)).toMatchObject({ campaignsWithRule: 1, campaignsWithBudget: 0 });

    await prisma.earnRule.update({ where: { campaignId: campaign.id }, data: { maxTotalAmount: 5000 } });
    expect(await getSetupFacts(brand.id)).toMatchObject({ campaignsWithBudget: 1, activeCampaigns: 0 });

    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "ACTIVE" } });
    expect(await getSetupFacts(brand.id)).toMatchObject({ activeCampaigns: 1 });
  });

  it("does not count a store that cannot sign its slips", async () => {
    // An unsigned till is not a way to give somebody a code - it is the
    // hole the whole forgery suite is about. Counting it would tick the
    // step off for a brand that has not done it.
    await prisma.store.create({
      data: { brandId: brand.id, name: "Unsigned", code: `US-${suffix}`.slice(0, 12), isActive: true },
    });
    expect(await getSetupFacts(brand.id)).toMatchObject({ signingStores: 0 });

    await prisma.store.create({
      data: {
        brandId: brand.id,
        name: "Signed",
        code: `SG-${suffix}`.slice(0, 12),
        isActive: true,
        signingSecretEncrypted: "x",
      },
    });
    expect(await getSetupFacts(brand.id)).toMatchObject({ signingStores: 1 });
  });

  it("counts an award, and only a positive one", async () => {
    const campaign = await prisma.campaign.findFirstOrThrow({ where: { brandId: brand.id } });
    const person = await prisma.person.create({
      data: { phoneHash: `setup-${suffix}`, phoneEncrypted: "x" },
    });
    const membership = await prisma.brandMembership.create({ data: { brandId: brand.id, personId: person.id } });

    // A redemption is not evidence the programme works.
    await prisma.pointsTransaction.create({
      data: {
        brandId: brand.id,
        brandMembershipId: membership.id,
        campaignId: campaign.id,
        amount: -100,
        unit: "CENTS",
        reason: "WALLET_SPENT",
      },
    });
    expect((await getSetupFacts(brand.id)).everAwarded).toBe(false);

    await prisma.pointsTransaction.create({
      data: {
        brandId: brand.id,
        brandMembershipId: membership.id,
        campaignId: campaign.id,
        amount: 100,
        unit: "CENTS",
        reason: "PACK_SCAN_AWARDED",
      },
    });
    expect((await getSetupFacts(brand.id)).everAwarded).toBe(true);

    await prisma.pointsTransaction.deleteMany({ where: { brandMembershipId: membership.id } });
    await prisma.brandMembership.delete({ where: { id: membership.id } });
    await prisma.person.delete({ where: { id: person.id } });
  });

  it("never reads another brand's progress as this one's", async () => {
    expect(await getSetupFacts(otherBrand.id)).toEqual(NOTHING);
  });
});
