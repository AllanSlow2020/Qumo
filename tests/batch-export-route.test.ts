import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";

/**
 * The download that hands over a whole print run.
 *
 * Found by review: it checked that somebody was signed in and that the
 * batch belonged to their brand, and did not check their role — while
 * creating a batch requires OWNER, ADMIN or MARKETING. So QUALITY, the one
 * role deliberately barred from making codes, could download every code in
 * every batch.
 *
 * The comment that justified it was the actual error: "codes are not secret
 * — they end up printed on the outside of a box." True of a printed code,
 * which costs a purchase to obtain. Not true of the file: an unprinted
 * batch is every unredeemed code in one download, each worth an award.
 */

const run = randomUUID().slice(0, 8);
const session = { current: null as null | { userId: string; brandId: string; role: Role } };

vi.mock("@/lib/staff/session", () => ({
  getStaffSession: async () => session.current,
}));

const { GET } = await import("@/app/api/console/batches/[batchId]/route");

let brand: { id: string };
let batchId: string;

beforeAll(async () => {
  brand = await prisma.brand.create({ data: { name: `Export ${run}`, slug: `export-${run}` } });
  const user = await prisma.user.create({
    data: {
      brandId: brand.id,
      email: `owner-${run}@example.invalid`,
      name: "Owner",
      role: "OWNER",
      passwordHash: "scrypt$32768$8$1$AAAA$AAAA",
    },
  });
  const campaign = await prisma.campaign.create({
    data: { brandId: brand.id, name: "Sticker run", status: "ACTIVE" },
  });
  const batch = await prisma.packBatch.create({
    data: { brandId: brand.id, campaignId: campaign.id, label: "Run 1", quantity: 2, createdByUserId: user.id },
  });
  batchId = batch.id;
  await prisma.packCode.createMany({
    data: [
      { brandId: brand.id, campaignId: campaign.id, batchId: batch.id, code: `AAAA${run.toUpperCase()}11` },
      { brandId: brand.id, campaignId: campaign.id, batchId: batch.id, code: `BBBB${run.toUpperCase()}22` },
    ],
  });
});

afterAll(async () => {
  await prisma.packCode.deleteMany({ where: { brandId: brand.id } });
  await prisma.packBatch.deleteMany({ where: { brandId: brand.id } });
  await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
  await prisma.auditEvent.deleteMany({ where: { brandId: brand.id } });
  await prisma.user.deleteMany({ where: { brandId: brand.id } });
  await prisma.brand.delete({ where: { id: brand.id } });
});

function request(): Request {
  return new Request("http://app.localhost:3000/api/console/batches/x");
}

const params = () => Promise.resolve({ batchId });

describe("downloading a print run", () => {
  it("refuses somebody who is not signed in", async () => {
    session.current = null;
    expect((await GET(request(), { params: params() })).status).toBe(401);
  });

  it("refuses a role that cannot create a batch", async () => {
    session.current = { userId: "u", brandId: brand.id, role: "QUALITY" };
    expect((await GET(request(), { params: params() })).status).toBe(403);
  });

  it("serves a role that can", async () => {
    session.current = { userId: "u", brandId: brand.id, role: "MARKETING" };
    const response = await GET(request(), { params: params() });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("AAAA");
  });

  it("does not serve another brand's batch, whatever the role", async () => {
    const other = await prisma.brand.create({ data: { name: `Other ${run}`, slug: `other-export-${run}` } });
    session.current = { userId: "u", brandId: other.id, role: "OWNER" };

    // Not 403 and not a partial answer: not found, because the query never
    // sees a row belonging to anybody else.
    expect((await GET(request(), { params: params() })).status).toBe(404);
    await prisma.brand.delete({ where: { id: other.id } });
  });
});
