import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, User } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { createPackBatchForSession, PackBatchError } from "@/lib/packs/batch";
import { exportBatchCodes, toCsv } from "@/lib/packs/export";
import { normalisePackCode } from "@/lib/packs/code";
import { redeemPackCode } from "@/lib/packs/scan";
import { encryptPhone, hashPhone } from "@/lib/security/crypto";
import { hashPassword } from "@/lib/staff/password";

/**
 * Getting a print run out again.
 *
 * The half that was missing: generating a batch put rows in a table nothing
 * could read back, so a brand could order 50,000 stickers and have no way to
 * send them anywhere.
 */
describe("exporting a print run", () => {
  const suffix = Date.now();

  let brand: Brand;
  let otherBrand: Brand;
  let campaign: Campaign;
  let staff: User;
  let batchId: string;

  // A real row: PackBatch.createdByUserId is a foreign key, so a placeholder
  // id fails the insert rather than being ignored - which is the schema
  // doing its job, and worth the two extra lines here.
  const session = (brandId: string) => ({ user: { id: staff.id, brandId, role: "MARKETING", name: "Test Staff" } });

  function form(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Campari", slug: `exp-a-${suffix}` } });
    otherBrand = await prisma.brand.create({ data: { name: "Licken", slug: `exp-b-${suffix}` } });

    staff = await prisma.user.create({
      data: {
        brandId: brand.id,
        email: `printer-${suffix}@x.invalid`,
        name: "Printer",
        role: "MARKETING",
        passwordHash: await hashPassword("a-long-enough-test-password"),
      },
    });

    campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Neck tags", status: "ACTIVE" },
    });
    await prisma.earnRule.create({
      data: { brandId: brand.id, campaignId: campaign.id, type: "FLAT_PER_SCAN", unit: "POINTS", amount: 50 },
    });

    const batch = await createPackBatchForSession(
      session(brand.id),
      form({ campaignId: campaign.id, label: "March 750ml", quantity: "25" }),
    );
    batchId = batch.id;
  });

  afterAll(async () => {
    for (const b of [brand, otherBrand]) {
      await prisma.packCode.deleteMany({ where: { brandId: b.id } });
      await prisma.packBatch.deleteMany({ where: { brandId: b.id } });
      await prisma.user.deleteMany({ where: { brandId: b.id } });
      await prisma.earnRule.deleteMany({ where: { brandId: b.id } });
      await prisma.campaign.deleteMany({ where: { brandId: b.id } });
      await prisma.brand.delete({ where: { id: b.id } });
    }
  });

  it("returns every code that was ordered", async () => {
    const data = await exportBatchCodes(brand.id, batchId);
    expect(data?.rows).toHaveLength(25);
    expect(data?.quantity).toBe(25);
    expect(data?.label).toBe("March 750ml");
    expect(new Set(data!.rows.map((r) => r.code)).size).toBe(25);
  });

  it("refuses to hand another brand's print run over", async () => {
    // An id in a URL must not reach across brands, and this route hands out
    // an entire print run.
    expect(await exportBatchCodes(otherBrand.id, batchId)).toBeNull();
  });

  it("builds URLs on the brand's own address", async () => {
    const data = await exportBatchCodes(brand.id, batchId);
    const csv = toCsv(data!, "https://campari.qumo.co.za");
    const [header, first] = csv.split("\n");

    expect(header).toBe("code,printed_as,url,status");
    const [code, printedAs, url, status] = first!.split(",");
    // A code scanned at the apex lands on the no-brand page, so the address
    // in the CSV is the thing that decides whether a printed sticker works.
    expect(url).toBe(`https://campari.qumo.co.za/s/${code}`);
    expect(status).toBe("UNSCANNED");
    // The readable form is the same code, so somebody typing it off a
    // scuffed label reaches the same place the QR would have.
    expect(normalisePackCode(printedAs!)).toBe(code);
  });

  it("has a row for every code and nothing else", async () => {
    const data = await exportBatchCodes(brand.id, batchId);
    const csv = toCsv(data!, "https://campari.qumo.co.za");
    expect(csv.split("\n")).toHaveLength(26);
  });

  it("shows which codes have been used", async () => {
    const one = await prisma.packCode.findFirstOrThrow({ where: { batchId } });
    await prisma.packCode.update({ where: { id: one.id }, data: { status: "SCANNED" } });

    const data = await exportBatchCodes(brand.id, batchId);
    expect(data!.rows.filter((r) => r.status === "SCANNED")).toHaveLength(1);

    await prisma.packCode.update({ where: { id: one.id }, data: { status: "UNSCANNED" } });
  });

  it("won't print codes for a promotion that awards nothing", async () => {
    // The refusal that saves a brand printing 50,000 stickers which
    // disappoint everyone who scans them - and the codes are single-use, so
    // that disappointment is permanent.
    const bare = await prisma.campaign.create({
      data: { brandId: brand.id, name: "Nothing yet", status: "DRAFT" },
    });
    await expect(
      createPackBatchForSession(session(brand.id), form({ campaignId: bare.id, label: "x", quantity: "10" })),
    ).rejects.toThrow(PackBatchError);
  });

  it("won't print codes against another brand's promotion", async () => {
    await expect(
      createPackBatchForSession(session(otherBrand.id), form({ campaignId: campaign.id, label: "x", quantity: "10" })),
    ).rejects.toThrow(PackBatchError);
  });
});

/**
 * The gap that driving the console turned up: nothing stopped a brand
 * printing pack codes against a share-of-spend promotion.
 *
 * setSpendRuleForSession zeroes `amount` for such a rule, because a share of
 * a basket is meaningless without a basket. A pack code carries no basket,
 * so those codes scanned successfully, awarded 0, and were consumed doing
 * it - the shopper was told they had earned R0.00 and the sticker was gone.
 * Confirmed by running it before either guard existed.
 */
describe("pack codes and share-of-spend promotions don't mix", () => {
  const suffix = Date.now();
  let brand: Brand;
  let staff: User;
  let spendCampaign: Campaign;
  let scanCampaign: Campaign;

  const session = () => ({ user: { id: staff.id, brandId: brand.id, role: "OWNER", name: "Test Staff" } });

  function form(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Mixed", slug: `mix-${suffix}` } });
    staff = await prisma.user.create({
      data: {
        brandId: brand.id,
        email: `mix-${suffix}@x.invalid`,
        name: "M",
        role: "OWNER",
        passwordHash: await hashPassword("a-long-enough-test-password"),
      },
    });

    spendCampaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "5% back", status: "ACTIVE" },
    });
    await prisma.earnRule.create({
      data: {
        brandId: brand.id,
        campaignId: spendCampaign.id,
        type: "PERCENT_OF_SPEND",
        unit: "CENTS",
        // Exactly what setSpendRuleForSession writes.
        amount: 0,
        basisPoints: 500,
      },
    });

    scanCampaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "50 points a pack", status: "ACTIVE" },
    });
    await prisma.earnRule.create({
      data: { brandId: brand.id, campaignId: scanCampaign.id, type: "FLAT_PER_SCAN", unit: "POINTS", amount: 50 },
    });
  });

  afterAll(async () => {
    await prisma.pointsTransaction.deleteMany({ where: { brandId: brand.id } });
    await prisma.brandMembership.deleteMany({ where: { brandId: brand.id } });
    await prisma.packCode.deleteMany({ where: { brandId: brand.id } });
    await prisma.packBatch.deleteMany({ where: { brandId: brand.id } });
    await prisma.user.deleteMany({ where: { brandId: brand.id } });
    await prisma.earnRule.deleteMany({ where: { brandId: brand.id } });
    await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
    await prisma.brand.delete({ where: { id: brand.id } });
  });

  it("refuses to print them at all", async () => {
    await expect(
      createPackBatchForSession(session(), form({ campaignId: spendCampaign.id, label: "no", quantity: "10" })),
    ).rejects.toThrow(PackBatchError);
  });

  it("still prints for a fixed-per-scan promotion", async () => {
    const batch = await createPackBatchForSession(
      session(),
      form({ campaignId: scanCampaign.id, label: "yes", quantity: "3" }),
    );
    expect((await exportBatchCodes(brand.id, batch.id))?.rows).toHaveLength(3);
  });

  it("refuses at the scan too, and without burning the code", async () => {
    // Reachable even with the print-time guard: a brand can print
    // flat-per-scan codes and later switch that same campaign to a share of
    // spend, at which point every sticker on a shelf would scan for zero.
    const batch = await createPackBatchForSession(
      session(),
      form({ campaignId: scanCampaign.id, label: "switched", quantity: "1" }),
    );
    const code = await prisma.packCode.findFirstOrThrow({ where: { batchId: batch.id } });

    await prisma.earnRule.update({
      where: { campaignId: scanCampaign.id },
      data: { type: "PERCENT_OF_SPEND", amount: 0, basisPoints: 500 },
    });

    const phone = `+2789${String(suffix).slice(-7)}`;
    const person = await prisma.person.create({
      data: { phoneHash: hashPhone(phone), phoneEncrypted: encryptPhone(phone), firstName: "A" },
    });

    const result = await redeemPackCode(code.code, person.id);
    expect(result).toEqual({ ok: false, reason: "NOT_A_SCAN_PROMOTION" });

    // Not burned. Switching the rule back has to make the sticker work
    // again - a shopper should not lose a code to a brand's configuration
    // change.
    expect((await prisma.packCode.findUniqueOrThrow({ where: { id: code.id } })).status).toBe("UNSCANNED");

    await prisma.earnRule.update({
      where: { campaignId: scanCampaign.id },
      data: { type: "FLAT_PER_SCAN", amount: 50, basisPoints: null },
    });
    const second = await redeemPackCode(code.code, person.id);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.amount).toBe(50);

    await prisma.pointsTransaction.deleteMany({ where: { brandId: brand.id } });
    await prisma.brandMembership.deleteMany({ where: { personId: person.id } });
    await prisma.person.delete({ where: { id: person.id } });
  });
});
