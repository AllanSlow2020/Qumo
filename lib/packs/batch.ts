import { z } from "zod";
import { Prisma, type Role } from "@prisma/client";
import { forBrand } from "@/lib/db/tenant";
import { requireRole } from "@/lib/auth/rbac";
import { generatePackCode } from "./code";

export const MANAGE_PACK_BATCH_ROLES: Role[] = ["OWNER", "ADMIN", "MARKETING"];

export class PackBatchError extends Error {}

export type SessionLike = { user: { brandId: string; role: string; id: string } };

// A print run is a physical thing with a real cost, so the cap is about
// keeping a typo from becoming a million-row insert and a very surprised
// print vendor, not about any technical limit.
const MAX_BATCH_QUANTITY = 100_000;

const createBatchSchema = z.object({
  campaignId: z.string().trim().min(1),
  label: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().int().min(1).max(MAX_BATCH_QUANTITY),
});

// Inserted in chunks rather than one statement: a hundred thousand rows in
// a single createMany builds a query large enough to be a problem, and
// chunking keeps memory flat whatever the batch size.
const INSERT_CHUNK = 5_000;
// Codes are 31^12, so a collision is vanishingly rare — but "vanishingly
// rare" over millions of inserts is not "never", and the unique constraint
// is the thing that actually decides. On a clash the chunk is regenerated
// rather than the whole batch.
const MAX_CHUNK_ATTEMPTS = 5;

/**
 * Generates a batch of pack codes for a campaign.
 *
 * The testable core, taking a session as an argument rather than calling
 * auth() — same split as lib/products/create.ts, for the same reason: the
 * RBAC rejection has to be exercisable from Vitest, and the UI hiding a
 * button is never the security boundary.
 */
export async function createPackBatchForSession(session: SessionLike, formData: FormData) {
  requireRole(session.user.role as Role, MANAGE_PACK_BATCH_ROLES);

  const parsed = createBatchSchema.parse({
    campaignId: formData.get("campaignId"),
    label: formData.get("label"),
    quantity: formData.get("quantity"),
  });

  const scoped = forBrand(session.user.brandId);

  // Scoped lookup, so a campaignId belonging to another brand simply isn't
  // found rather than being printed onto this brand's labels.
  const campaign = await scoped.campaign.findFirst({ where: { id: parsed.campaignId } });
  if (!campaign) {
    throw new PackBatchError("That campaign doesn't exist.");
  }

  // Printing codes for a campaign that awards nothing produces labels that
  // disappoint every shopper who scans them, and the codes are single-use,
  // so the disappointment is permanent. Refuse at the point of printing.
  const earnRule = await scoped.earnRule.findFirst({ where: { campaignId: campaign.id } });
  if (!earnRule) {
    throw new PackBatchError("Set up what this campaign awards per scan before generating codes for it.");
  }
  // A share-of-spend rule needs a basket to take a share of, and a pack code
  // arrives without one — setSpendRuleForSession zeroes `amount` precisely
  // because it is meaningless there. Printing against one produces codes
  // that scan successfully, award nothing, and are consumed doing it: the
  // shopper is told they earned R0.00 and the sticker is gone for good.
  // Same reasoning as the check above, one step further along.
  if (earnRule.type === "PERCENT_OF_SPEND") {
    throw new PackBatchError(
      "That promotion pays a share of what someone spends, which needs a till slip. Pack codes need a promotion that awards a fixed amount per scan.",
    );
  }

  const batch = await scoped.packBatch.create({
    data: {
      brandId: session.user.brandId,
      campaignId: campaign.id,
      label: parsed.label,
      quantity: parsed.quantity,
      createdByUserId: session.user.id,
    },
  });

  let remaining = parsed.quantity;
  while (remaining > 0) {
    const size = Math.min(INSERT_CHUNK, remaining);
    await insertChunk(scoped, session.user.brandId, campaign.id, batch.id, size);
    remaining -= size;
  }

  return batch;
}

type ScopedClient = ReturnType<typeof forBrand>;

async function insertChunk(
  scoped: ScopedClient,
  brandId: string,
  campaignId: string,
  batchId: string,
  size: number,
): Promise<void> {
  for (let attempt = 0; attempt < MAX_CHUNK_ATTEMPTS; attempt += 1) {
    // A Set, because randomness can repeat within one chunk too — and that
    // collision would never reach the database to be caught by the
    // constraint, it would just silently insert fewer rows than ordered.
    const codes = new Set<string>();
    while (codes.size < size) {
      codes.add(generatePackCode());
    }

    try {
      await scoped.packCode.createMany({
        data: [...codes].map((code) => ({ brandId, campaignId, batchId, code })),
      });
      return;
    } catch (err) {
      const isUniqueViolation = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isUniqueViolation) {
        throw err;
      }
      // Collided with a code already in the table. Try again with fresh
      // randomness; if this ever exhausts its attempts something is wrong
      // with the generator, and failing loudly beats printing a short run.
    }
  }

  throw new PackBatchError("Couldn't generate unique codes for this batch. Please try again.");
}

export type PackBatchSummary = {
  id: string;
  label: string;
  campaignName: string;
  quantity: number;
  scanned: number;
  createdAt: Date;
};

/** Batches for the brand's dashboard, with how much of each has been claimed. */
export async function listPackBatches(brandId: string): Promise<PackBatchSummary[]> {
  const scoped = forBrand(brandId);

  const batches = await scoped.packBatch.findMany({
    include: { campaign: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (batches.length === 0) {
    return [];
  }

  // One grouped count for every batch rather than a query each — a brand
  // with a hundred print runs should still be two round trips.
  const scannedCounts = await scoped.packCode.groupBy({
    by: ["batchId"],
    where: { status: "SCANNED" },
    _count: { _all: true },
  });
  const scannedByBatch = new Map(scannedCounts.map((row) => [row.batchId, row._count._all]));

  return batches.map((batch) => ({
    id: batch.id,
    label: batch.label,
    campaignName: batch.campaign.name,
    quantity: batch.quantity,
    scanned: scannedByBatch.get(batch.id) ?? 0,
    createdAt: batch.createdAt,
  }));
}
