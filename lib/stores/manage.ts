import { randomBytes } from "node:crypto";
import { z } from "zod";
import { Prisma, type Role } from "@prisma/client";
import { forBrand } from "@/lib/db/tenant";
import { requireRole } from "@/lib/auth/rbac";
import { encryptSecret } from "@/lib/security/crypto";

export const MANAGE_STORE_ROLES: Role[] = ["OWNER", "ADMIN"];

export class StoreError extends Error {}

export type SessionLike = { user: { brandId: string; role: string } };

const createStoreSchema = z.object({
  name: z.string().trim().min(1).max(120),
  // Upper-cased and restricted so it survives being printed on a receipt
  // and read back by a camera: no lower case to confuse with upper, no
  // characters that need escaping in a URL.
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9-]+$/, "Use letters, numbers and hyphens only."),
  signed: z.boolean(),
});

/** 256 bits, hex. Long enough that the truncated signature is the weak link, not this. */
function generateSigningSecret(): string {
  return randomBytes(32).toString("hex");
}

export type CreatedStore = {
  id: string;
  code: string;
  /**
   * The plaintext signing secret, returned exactly once at creation and
   * never again — only the ciphertext is stored. A brand that loses it
   * rotates rather than recovers, same as any other credential.
   */
  signingSecret: string | null;
};

export async function createStoreForSession(session: SessionLike, formData: FormData): Promise<CreatedStore> {
  requireRole(session.user.role as Role, MANAGE_STORE_ROLES);

  const parsed = createStoreSchema.parse({
    name: formData.get("name"),
    code: formData.get("code"),
    signed: formData.get("signed") === "on",
  });

  const signingSecret = parsed.signed ? generateSigningSecret() : null;

  try {
    const store = await forBrand(session.user.brandId).store.create({
      data: {
        brandId: session.user.brandId,
        name: parsed.name,
        code: parsed.code,
        signingSecretEncrypted: signingSecret ? encryptSecret(signingSecret) : null,
      },
    });
    return { id: store.id, code: store.code, signingSecret };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Codes are globally unique because a scanned slip carries nothing
      // else — so a clash can be with another brand's store, and the
      // message deliberately doesn't say which.
      throw new StoreError("That store code is already taken. Try another.");
    }
    throw err;
  }
}

/**
 * Issues a new signing secret, or turns signing on for a store that was
 * created without it — which is the path a brand takes when their POS
 * vendor comes back and says yes after all.
 *
 * Slips signed with the old secret stop verifying immediately. That is the
 * point of a rotation, but it means an unscanned slip printed minutes ago
 * is now unverifiable, so the screen says so before anyone clicks.
 */
export async function rotateStoreSecretForSession(session: SessionLike, storeId: string): Promise<string> {
  requireRole(session.user.role as Role, MANAGE_STORE_ROLES);

  const scoped = forBrand(session.user.brandId);
  const store = await scoped.store.findFirst({ where: { id: storeId } });
  if (!store) {
    throw new StoreError("That store doesn't exist.");
  }

  const signingSecret = generateSigningSecret();
  await scoped.store.update({
    where: { id: store.id },
    data: { signingSecretEncrypted: encryptSecret(signingSecret) },
  });
  return signingSecret;
}

/**
 * Turns signing off. Deliberately available: a brand mid-rollout may have
 * one franchise whose till cannot sign yet, and the alternative to
 * supporting that is that franchise earning nothing at all.
 */
export async function disableStoreSigningForSession(session: SessionLike, storeId: string): Promise<void> {
  requireRole(session.user.role as Role, MANAGE_STORE_ROLES);

  const scoped = forBrand(session.user.brandId);
  const store = await scoped.store.findFirst({ where: { id: storeId } });
  if (!store) {
    throw new StoreError("That store doesn't exist.");
  }
  await scoped.store.update({ where: { id: store.id }, data: { signingSecretEncrypted: null } });
}

export async function setStoreActiveForSession(
  session: SessionLike,
  storeId: string,
  isActive: boolean,
): Promise<void> {
  requireRole(session.user.role as Role, MANAGE_STORE_ROLES);

  const scoped = forBrand(session.user.brandId);
  const store = await scoped.store.findFirst({ where: { id: storeId } });
  if (!store) {
    throw new StoreError("That store doesn't exist.");
  }
  await scoped.store.update({ where: { id: store.id }, data: { isActive } });
}

export type StoreSummary = {
  id: string;
  name: string;
  code: string;
  isSigned: boolean;
  isActive: boolean;
  scanCount: number;
  /** Slips accepted without a signature — the exposure, stated as a number. */
  unsignedScanCount: number;
};

export async function listStores(brandId: string): Promise<StoreSummary[]> {
  const scoped = forBrand(brandId);

  const stores = await scoped.store.findMany({ orderBy: { name: "asc" } });
  if (stores.length === 0) {
    return [];
  }

  const [totals, unsigned] = await Promise.all([
    scoped.purchaseScan.groupBy({ by: ["storeId"], _count: { _all: true } }),
    scoped.purchaseScan.groupBy({ by: ["storeId"], where: { wasSigned: false }, _count: { _all: true } }),
  ]);
  const totalByStore = new Map(totals.map((row) => [row.storeId, row._count._all]));
  const unsignedByStore = new Map(unsigned.map((row) => [row.storeId, row._count._all]));

  return stores.map((store) => ({
    id: store.id,
    name: store.name,
    code: store.code,
    isSigned: store.signingSecretEncrypted !== null,
    isActive: store.isActive,
    scanCount: totalByStore.get(store.id) ?? 0,
    unsignedScanCount: unsignedByStore.get(store.id) ?? 0,
  }));
}

const spendRuleSchema = z.object({
  campaignId: z.string().trim().min(1),
  unit: z.enum(["POINTS", "CENTS", "STAMPS"]),
  // 1 basis point to 100% — a brand giving away more than the basket is a
  // typo, not a promotion.
  basisPoints: z.coerce.number().int().min(1).max(10_000),
  minSpendCents: z.coerce.number().int().min(0).max(10_000_000).optional(),
});

/**
 * Configures a campaign to award a share of spend.
 *
 * Refuses if the brand already has another active campaign doing so. That
 * restriction is what lets a scanned slip resolve to exactly one campaign:
 * without it, a receipt would be worth whatever campaign happened to be
 * found first, and the same purchase could pay out differently depending on
 * row order. Better to refuse at configuration time, where a person is
 * present to read the reason, than to guess at scan time.
 */
export async function setSpendRuleForSession(session: SessionLike, formData: FormData) {
  requireRole(session.user.role as Role, MANAGE_STORE_ROLES);

  const parsed = spendRuleSchema.parse({
    campaignId: formData.get("campaignId"),
    unit: formData.get("unit"),
    basisPoints: formData.get("basisPoints"),
    minSpendCents: formData.get("minSpendCents") || undefined,
  });

  const scoped = forBrand(session.user.brandId);

  const campaign = await scoped.campaign.findFirst({ where: { id: parsed.campaignId } });
  if (!campaign) {
    throw new StoreError("That campaign doesn't exist.");
  }

  const conflicting = await scoped.campaign.findFirst({
    where: {
      status: "ACTIVE",
      id: { not: campaign.id },
      earnRule: { type: "PERCENT_OF_SPEND" },
    },
  });
  if (conflicting) {
    throw new StoreError(
      `"${conflicting.name}" is already running a spend-based rule. Pause it before starting another, so a till slip can only ever be worth one thing.`,
    );
  }

  return scoped.earnRule.upsert({
    where: { campaignId: campaign.id },
    update: {
      type: "PERCENT_OF_SPEND",
      unit: parsed.unit,
      // amount is the FLAT_PER_SCAN field and is meaningless here; zeroed
      // rather than left stale so a rule that is later switched back to
      // flat cannot silently inherit a number nobody chose.
      amount: 0,
      basisPoints: parsed.basisPoints,
      minSpendCents: parsed.minSpendCents ?? null,
    },
    create: {
      brandId: session.user.brandId,
      campaignId: campaign.id,
      type: "PERCENT_OF_SPEND",
      unit: parsed.unit,
      amount: 0,
      basisPoints: parsed.basisPoints,
      minSpendCents: parsed.minSpendCents ?? null,
    },
  });
}
