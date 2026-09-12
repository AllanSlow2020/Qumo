import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { brandOrigin, CONSOLE_SUBDOMAIN, RESERVED_SUBDOMAINS } from "@/lib/brand/host";
import { generatePackCode } from "@/lib/packs/code";
import { labelSheet, LABELS_PER_SHEET } from "@/lib/packs/export";

/**
 * The sheet that turns a print run into something a phone can read.
 *
 * The interesting cases are not "does it render a QR". They are the two
 * ways a label is worse than useless: one that points at a host naming no
 * brand, so a shopper's first contact with the programme is a broken page;
 * and one that reached across a tenant boundary, which on this route means
 * handing a brand every unredeemed code belonging to another.
 */
describe("printable label sheets", () => {
  const suffix = Date.now();
  let brand: Brand;
  let otherBrand: Brand;
  let campaign: Campaign;
  let batchId: string;
  let otherBatchId: string;

  async function makeBatch(b: Brand, c: Campaign, quantity: number): Promise<string> {
    const batch = await prisma.packBatch.create({
      data: { brandId: b.id, campaignId: c.id, label: `run-${suffix}-${quantity}`, quantity },
    });
    await prisma.packCode.createMany({
      data: Array.from({ length: quantity }, () => ({
        brandId: b.id,
        campaignId: c.id,
        batchId: batch.id,
        code: generatePackCode(),
        status: "UNSCANNED" as const,
      })),
    });
    return batch.id;
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Labelled", slug: `labelled-${suffix}` } });
    otherBrand = await prisma.brand.create({ data: { name: "Rival", slug: `rival-${suffix}` } });
    campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "On-pack code", status: "ACTIVE" },
    });
    const otherCampaign = await prisma.campaign.create({
      data: { brandId: otherBrand.id, name: "Theirs", status: "ACTIVE" },
    });

    // Deliberately not a round number of sheets, so the last page is short
    // and the paging arithmetic has something to get wrong.
    batchId = await makeBatch(brand, campaign, LABELS_PER_SHEET + 3);
    otherBatchId = await makeBatch(otherBrand, otherCampaign, 2);
  });

  afterAll(async () => {
    const brandIds = [brand.id, otherBrand.id];
    await prisma.packCode.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.packBatch.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.campaign.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.brand.deleteMany({ where: { id: { in: brandIds } } });
  });

  describe("what ends up on the label", () => {
    it("points at the brand's own host, not the console's and not the apex", async () => {
      const origin = brandOrigin(brand.slug);
      const sheet = await labelSheet(brand.id, batchId, origin, 1);

      expect(sheet).not.toBeNull();
      const label = sheet!.labels[0]!;
      expect(label.url).toBe(`${origin}/s/${label.code}`);
      expect(label.url).toContain(`${brand.slug}.`);
      // The failure that would be printed onto fifty thousand stickers
      // before anybody noticed.
      expect(label.url).not.toContain(`${CONSOLE_SUBDOMAIN}.`);
    });

    it("puts the URL inside the QR, so scanning it goes somewhere", async () => {
      const sheet = await labelSheet(brand.id, batchId, brandOrigin(brand.slug), 1);
      const label = sheet!.labels[0]!;

      expect(label.qr).toContain("<svg");
      expect(label.qr.length).toBeGreaterThan(200);

      // As far as this suite can honestly go. A QR is not readable from its
      // markup, so what is checked here is that the encoder was handed the
      // URL - not that a phone can read the result.
      //
      // That was checked by hand instead, and it is worth writing down what
      // it proved: the sheet was rendered in a browser, one cell screenshot
      // at the size it actually prints (28mm, 106 CSS px), and the pixels
      // decoded with jsQR, which is the algorithm a phone camera runs. It
      // came back with this exact URL, and following it awarded R5.00 and
      // moved the wallet from R45.01 to R50.01.
      //
      // Not kept as a test because it needs a browser and a decoder, and the
      // suite runs against Postgres alone. Redo it by hand if the QR size,
      // the error-correction level or the print stylesheet changes, since
      // those are the three things that decide whether a label scans.
    });

    it("prints the code in readable groups beside it", async () => {
      const sheet = await labelSheet(brand.id, batchId, brandOrigin(brand.slug), 1);
      const label = sheet!.labels[0]!;

      // What a shopper reads out when the label is scuffed, and what they
      // text in when they have no data.
      expect(label.printedAs).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
      expect(label.printedAs.replace(/-/g, "")).toBe(label.code);
    });
  });

  describe("paging", () => {
    it("fills a page, then leaves the remainder on the last one", async () => {
      const origin = brandOrigin(brand.slug);
      const first = await labelSheet(brand.id, batchId, origin, 1);
      const last = await labelSheet(brand.id, batchId, origin, 2);

      expect(first!.labels).toHaveLength(LABELS_PER_SHEET);
      expect(last!.labels).toHaveLength(3);
      expect(first!.pageCount).toBe(2);
      expect(first!.total).toBe(LABELS_PER_SHEET + 3);
    });

    it("never repeats a code across pages", async () => {
      const origin = brandOrigin(brand.slug);
      const first = await labelSheet(brand.id, batchId, origin, 1);
      const second = await labelSheet(brand.id, batchId, origin, 2);
      const codes = [...first!.labels, ...second!.labels].map((l) => l.code);

      // Two labels carrying the same code means one of them is worthless
      // the moment the other is scanned, and nobody would find out until a
      // shopper complained.
      expect(new Set(codes).size).toBe(codes.length);
    });

    it("clamps a page nobody asked for rather than rendering nothing", async () => {
      const origin = brandOrigin(brand.slug);
      // A hand-edited URL, a stale bookmark, a paging bug elsewhere.
      for (const page of [0, -5, 999, Number.NaN]) {
        const sheet = await labelSheet(brand.id, batchId, origin, page);
        expect(sheet!.labels.length).toBeGreaterThan(0);
        expect(sheet!.page).toBeGreaterThanOrEqual(1);
        expect(sheet!.page).toBeLessThanOrEqual(sheet!.pageCount);
      }
    });
  });

  describe("the tenant boundary", () => {
    it("does not find another brand's batch", async () => {
      // Not "returns an empty sheet". A batch id in a URL must not be a way
      // to learn that another brand's print run exists, let alone read it.
      expect(await labelSheet(brand.id, otherBatchId, brandOrigin(brand.slug), 1)).toBeNull();
    });
  });

  describe("the console's own subdomain", () => {
    it("is reserved, so no brand can be sold the host staff sign in on", async () => {
      // This held by construction while the value was hardcoded, and stopped
      // holding the moment it came from an environment variable.
      expect(RESERVED_SUBDOMAINS.has(CONSOLE_SUBDOMAIN)).toBe(true);
    });
  });
});
