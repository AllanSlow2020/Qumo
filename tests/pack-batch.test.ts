import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, User } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { createPackBatchForSession, listPackBatches, PackBatchError } from "@/lib/packs/batch";
import { setEarnRuleForSession } from "@/lib/packs/earn-rule";
import { ForbiddenError } from "@/lib/auth/rbac";
import { looksLikePackCode } from "@/lib/packs/code";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("lib/packs/batch", () => {
  const suffix = Date.now();
  let brand: Brand;
  let rival: Brand;
  let campaign: Campaign;
  let rivalCampaign: Campaign;
  let brandOwner: User;
  let rivalOwner: User;

  // PackBatch.createdByUserId is a real foreign key - a print run records
  // who ordered it - so these have to be real staff rows, not stand-ins.
  const owner = (brandId: string, userId: string) => ({ user: { id: userId, brandId, role: "OWNER", name: "Test Owner" } });

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Batch Brand", slug: `batch-brand-${suffix}` } });
    rival = await prisma.brand.create({ data: { name: "Rival Brand", slug: `batch-rival-${suffix}` } });

    brandOwner = await prisma.user.create({
      data: { brandId: brand.id, email: `batch-owner-${suffix}@test.dev`, name: "Batch Owner", role: "OWNER", passwordHash: "x" },
    });
    rivalOwner = await prisma.user.create({
      data: { brandId: rival.id, email: `rival-owner-${suffix}@test.dev`, name: "Rival Owner", role: "OWNER", passwordHash: "x" },
    });

    campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Batch Campaign", status: "ACTIVE" },
    });
    rivalCampaign = await prisma.campaign.create({
      data: { brandId: rival.id, name: "Rival Campaign", status: "ACTIVE" },
    });

    await setEarnRuleForSession(
      owner(brand.id, brandOwner.id),
      formData({ campaignId: campaign.id, unit: "POINTS", amount: "50" }),
    );
  });

  afterAll(async () => {
    const brandIds = [brand.id, rival.id];
    await prisma.packCode.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.packBatch.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.earnRule.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.campaign.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.user.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.brand.deleteMany({ where: { id: { in: brandIds } } });
  });

  it("generates exactly the requested number of unique codes", async () => {
    const batch = await createPackBatchForSession(
      owner(brand.id, brandOwner.id),
      formData({ campaignId: campaign.id, label: "Run A", quantity: "250" }),
    );

    const codes = await prisma.packCode.findMany({ where: { batchId: batch.id }, select: { code: true } });
    expect(codes).toHaveLength(250);
    expect(new Set(codes.map((c) => c.code)).size).toBe(250);
    expect(codes.every((c) => looksLikePackCode(c.code))).toBe(true);
  });

  it("starts every code unscanned", async () => {
    const batch = await createPackBatchForSession(
      owner(brand.id, brandOwner.id),
      formData({ campaignId: campaign.id, label: "Run B", quantity: "10" }),
    );
    const scanned = await prisma.packCode.count({ where: { batchId: batch.id, status: { not: "UNSCANNED" } } });
    expect(scanned).toBe(0);
  });

  it("refuses to print codes for a campaign that awards nothing", async () => {
    // Single-use codes on a campaign with no earn rule means permanent
    // disappointment for every shopper who scans one.
    const unset = await prisma.campaign.create({
      data: { brandId: brand.id, name: "No rule yet", status: "ACTIVE" },
    });
    await expect(
      createPackBatchForSession(owner(brand.id, brandOwner.id), formData({ campaignId: unset.id, label: "X", quantity: "5" })),
    ).rejects.toThrow(PackBatchError);
  });

  it("refuses to print another brand's campaign onto this brand's labels", async () => {
    await expect(
      createPackBatchForSession(
        owner(brand.id, brandOwner.id),
        formData({ campaignId: rivalCampaign.id, label: "Sneaky", quantity: "5" }),
      ),
    ).rejects.toThrow(PackBatchError);
  });

  it("enforces role permissions at the function, not just in the UI", async () => {
    // This is reachable as a real network endpoint through the server
    // action - hiding the button is not the boundary.
    await expect(
      createPackBatchForSession(
        { user: { id: "u1", brandId: brand.id, role: "QUALITY", name: "Test Quality" } },
        formData({ campaignId: campaign.id, label: "Nope", quantity: "5" }),
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects a quantity beyond the print cap", async () => {
    await expect(
      createPackBatchForSession(
        owner(brand.id, brandOwner.id),
        formData({ campaignId: campaign.id, label: "Huge", quantity: "100001" }),
      ),
    ).rejects.toThrow();
  });

  it("rejects a zero or negative quantity", async () => {
    for (const quantity of ["0", "-5"]) {
      await expect(
        createPackBatchForSession(owner(brand.id, brandOwner.id), formData({ campaignId: campaign.id, label: "Bad", quantity })),
      ).rejects.toThrow();
    }
  });

  it("reports how much of each batch has been claimed", async () => {
    const batch = await createPackBatchForSession(
      owner(brand.id, brandOwner.id),
      formData({ campaignId: campaign.id, label: "Counted", quantity: "4" }),
    );
    const codes = await prisma.packCode.findMany({ where: { batchId: batch.id }, take: 2 });
    await prisma.packCode.updateMany({
      where: { id: { in: codes.map((c) => c.id) } },
      data: { status: "SCANNED" },
    });

    const summary = (await listPackBatches(brand.id)).find((b) => b.id === batch.id);
    expect(summary?.quantity).toBe(4);
    expect(summary?.scanned).toBe(2);
  });

  it("never shows one brand another brand's batches", async () => {
    await setEarnRuleForSession(
      owner(rival.id, rivalOwner.id),
      formData({ campaignId: rivalCampaign.id, unit: "STAMPS", amount: "1" }),
    );
    await createPackBatchForSession(
      owner(rival.id, rivalOwner.id),
      formData({ campaignId: rivalCampaign.id, label: "Rival run", quantity: "3" }),
    );

    const mine = await listPackBatches(brand.id);
    expect(mine.some((b) => b.label === "Rival run")).toBe(false);

    const theirs = await listPackBatches(rival.id);
    expect(theirs.every((b) => b.label === "Rival run")).toBe(true);
  });
});

describe("lib/packs/earn-rule", () => {
  const suffix = Date.now();
  let brand: Brand;
  let campaign: Campaign;

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Rule Brand", slug: `rule-brand-${suffix}` } });
    campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Rule Campaign", status: "ACTIVE" },
    });
  });

  afterAll(async () => {
    await prisma.earnRule.deleteMany({ where: { brandId: brand.id } });
    await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
    await prisma.brand.delete({ where: { id: brand.id } });
  });

  it("edits the existing rule rather than adding a second", async () => {
    const session = { user: { id: "test-owner", brandId: brand.id, role: "OWNER", name: "Test Owner" } };
    await setEarnRuleForSession(session, formData({ campaignId: campaign.id, unit: "POINTS", amount: "50" }));
    await setEarnRuleForSession(session, formData({ campaignId: campaign.id, unit: "POINTS", amount: "60" }));

    const rules = await prisma.earnRule.findMany({ where: { campaignId: campaign.id } });
    expect(rules).toHaveLength(1);
    // Codes already printed keep working and start awarding the new amount.
    expect(rules[0]?.amount).toBe(60);
  });

  it("enforces role permissions", async () => {
    await expect(
      setEarnRuleForSession(
        { user: { id: "test-quality", brandId: brand.id, role: "QUALITY", name: "Test Quality" } },
        formData({ campaignId: campaign.id, unit: "POINTS", amount: "10" }),
      ),
    ).rejects.toThrow(ForbiddenError);
  });
});
