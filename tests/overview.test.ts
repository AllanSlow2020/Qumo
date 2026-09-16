import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { getBrandOverview } from "@/lib/console/overview";

/**
 * The first screen a brand sees, which had no test at all.
 *
 * The case covered here is the one that was wrong: every scan figure
 * counted till slips only, so a brand whose codes are printed on the box -
 * which is the whole mechanism for the pilot - opened the console to a
 * zero and a flat chart on a week that had worked.
 */

const run = randomUUID().slice(0, 8);
const DAY = 24 * 60 * 60 * 1000;

let brand: { id: string };
let campaign: { id: string };
let store: { id: string };
let membership: { id: string };

beforeAll(async () => {
  brand = await prisma.brand.create({
    data: { name: `Overview ${run}`, slug: `overview-${run}` },
  });
  campaign = await prisma.campaign.create({
    data: { brandId: brand.id, name: "On pack", status: "ACTIVE" },
  });
  store = await prisma.store.create({
    data: { brandId: brand.id, name: "Sea Point", code: `OV-${run}` },
  });
  const person = await prisma.person.create({
    data: { phoneHash: `ov-${run}`, phoneEncrypted: "x" },
  });
  membership = await prisma.brandMembership.create({
    data: { brandId: brand.id, personId: person.id },
  });
});

afterAll(async () => {
  await prisma.brand.delete({ where: { id: brand.id } });
});

describe("a brand whose mechanism is a code on the box", () => {
  it("counts on-pack scans in the headline and on the chart", async () => {
    const empty = await getBrandOverview(brand.id);
    expect(empty.scansLast7Days).toBe(0);
    // Seven buckets even with nothing in them, so the chart has a shape to
    // be empty in rather than undefined to crash on.
    expect(empty.scansByDay).toHaveLength(7);

    const at = new Date(Date.now() - 2 * DAY);
    const batch = await prisma.packBatch.create({
      data: { brandId: brand.id, campaignId: campaign.id, label: `b-${run}`, quantity: 3 },
    });
    await prisma.packCode.createMany({
      data: [0, 1, 2].map((i) => ({
        brandId: brand.id,
        campaignId: campaign.id,
        batchId: batch.id,
        code: `OV-${run}-${i}`,
        // Only the first two are claimed. An unscanned code is stock, not
        // activity, and counting printed codes as scans would flatter every
        // brand by the size of its print run.
        status: i < 2 ? ("SCANNED" as const) : ("UNSCANNED" as const),
        scannedAt: i < 2 ? at : null,
      })),
    });

    const after = await getBrandOverview(brand.id);
    expect(after.scansLast7Days).toBe(2);

    const day = at.toISOString().slice(0, 10);
    const bar = after.scansByDay.find((d) => d.day.toISOString().slice(0, 10) === day);
    expect(bar?.count).toBe(2);
    expect(after.scansByDay.reduce((sum, d) => sum + d.count, 0)).toBe(2);
  });

  it("adds till slips to the same figure rather than replacing it", async () => {
    const at = new Date(Date.now() - 1 * DAY);
    await prisma.purchaseScan.create({
      data: {
        brandId: brand.id,
        storeId: store.id,
        brandMembershipId: membership.id,
        campaignId: campaign.id,
        externalTxnId: `ov-txn-${run}`,
        amountCents: 9900,
        wasSigned: true,
        purchasedAt: at,
        scannedAt: at,
      },
    });

    const p = await getBrandOverview(brand.id);
    // Two on pack from the test above, one off the till here. A brand
    // running both mechanisms reads one number, not two halves.
    expect(p.scansLast7Days).toBe(3);
    expect(p.scansByDay.reduce((sum, d) => sum + d.count, 0)).toBe(3);
  });

  it("ignores scans older than the window", async () => {
    const old = new Date(Date.now() - 30 * DAY);
    const batch = await prisma.packBatch.create({
      data: { brandId: brand.id, campaignId: campaign.id, label: `old-${run}`, quantity: 1 },
    });
    await prisma.packCode.create({
      data: {
        brandId: brand.id,
        campaignId: campaign.id,
        batchId: batch.id,
        code: `OV-OLD-${run}`,
        status: "SCANNED",
        scannedAt: old,
      },
    });

    const p = await getBrandOverview(brand.id);
    expect(p.scansLast7Days).toBe(3);
    expect(p.scansByDay).toHaveLength(7);
  });
});
