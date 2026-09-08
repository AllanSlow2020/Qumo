import { prisma as basePrisma } from "./client";

// The core multi-tenancy guarantee for this app: every tenant-owned table
// (product, user, brandMembership - anything with a brandId column) is only
// ever touched through forBrand(brandId), which rewrites every query to
// force that brandId, and throws immediately if a caller's own args disagree
// with the scope instead of silently overwriting it (a silent overwrite
// would hide the bug that put the wrong brandId there in the first place).
//
// Person is deliberately NOT in this list - it has no brandId column by
// design (see prisma/schema.prisma), and is only reachable through a
// BrandMembership the caller is authorised to see.
//
// Nor is ShopperSession: it belongs to a person, not a tenant, and a brand
// has no business reading one. PhoneOtp likewise - it is resolved by phone
// hash before any brand context exists.
//
// Known limitation: on `create`/`createMany`, Prisma's generated input types
// still require `brandId` at the type level (it's a required relation column
// in the schema), even though the guard below will inject and verify it at
// runtime. So callers must still pass the matching brandId on creates - the
// guard's job there is to reject a *mismatched* brandId, not to make the
// field optional. The full guarantee (brandId never needs to be supplied,
// and can't be gotten wrong) applies to reads, updates, and deletes, where
// `where` is optional and entirely under the guard's control.

/**
 * Exported so a test can assert that every name here is actually wired into
 * the `$extends` block below. The two are separate on purpose - see the
 * note on forBrand - and separate things drift: `auditEvent` was added to
 * this list and not to that block, which left the model listed as scoped
 * while every query against it ran unscoped and unguarded. The type on
 * makeHandler cannot catch that, because the omission is a missing line
 * rather than a wrong one.
 */
export const TENANT_SCOPED_MODELS = [
  "user",
  "brandMembership",
  "pointsTransaction",
  "campaign",
  "reward",
  "coupon",
  "couponFraudEvent",
  "packBatch",
  "packCode",
  "earnRule",
  "walletSpend",
  "store",
  "purchaseScan",
  "auditEvent",
] as const;
type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

export class TenantScopeViolation extends Error {
  constructor(model: string, detail: string) {
    super(`Tenant scope violation on "${model}": ${detail}`);
    this.name = "TenantScopeViolation";
  }
}

type ScopeableArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
};

// Every operation here takes a `where` and nothing else that could carry a
// brandId, so forcing the scope into `where` is the whole job.
//
// aggregate and groupBy were originally left out and caught by the
// deny-by-default branch below, which asked for them to be reasoned about
// before use. They have been: both accept the same `where` as a findMany
// and apply it before aggregating, so an injected brandId constrains the
// rows that reach the SUM or the COUNT exactly as it constrains the rows a
// findMany returns. Without them, deriving any per-brand total means
// loading every matching row into memory to add it up.
const WHERE_ONLY_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

function assertOwnedBy(model: string, value: unknown, brandId: string): void {
  if (value !== undefined && value !== brandId) {
    throw new TenantScopeViolation(
      model,
      `args referenced brandId "${String(value)}" while scoped to "${brandId}"`,
    );
  }
}

/**
 * Models nothing may rewrite once written.
 *
 * A log that the people it watches can edit is not a log, and "nothing in
 * the app calls update on it" is a property of today's code rather than a
 * guarantee. This makes it a guarantee: the attempt throws, wherever it
 * comes from. Rows are created and read, and that is all.
 */
const APPEND_ONLY_MODELS = new Set<string>(["auditEvent"]);
const MUTATING_OPS = new Set(["update", "updateMany", "upsert", "delete", "deleteMany"]);

function scopeArgs(
  model: string,
  operation: string,
  args: ScopeableArgs | undefined,
  brandId: string,
): ScopeableArgs {
  const next: ScopeableArgs = { ...args };

  if (APPEND_ONLY_MODELS.has(model) && MUTATING_OPS.has(operation)) {
    throw new TenantScopeViolation(
      model,
      `"${operation}" is not permitted: this model is append-only, and a record that can be rewritten is not a record`,
    );
  }

  if (operation === "create") {
    const data = { ...(next.data as Record<string, unknown> | undefined) };
    assertOwnedBy(model, data.brandId, brandId);
    next.data = { ...data, brandId };
    return next;
  }

  if (operation === "createMany") {
    const rows = Array.isArray(next.data) ? next.data : next.data ? [next.data] : [];
    next.data = rows.map((row) => {
      assertOwnedBy(model, row.brandId, brandId);
      return { ...row, brandId };
    });
    return next;
  }

  if (operation === "upsert") {
    const where = { ...next.where };
    assertOwnedBy(model, where.brandId, brandId);
    next.where = { ...where, brandId };

    const create = { ...next.create };
    assertOwnedBy(model, create.brandId, brandId);
    next.create = { ...create, brandId };
    return next;
  }

  if (WHERE_ONLY_OPS.has(operation)) {
    const where = { ...next.where };
    assertOwnedBy(model, where.brandId, brandId);
    next.where = { ...where, brandId };
    return next;
  }

  // Deny by default: an operation we haven't explicitly reasoned about
  // (aggregate, groupBy, raw queries, ...) fails loudly instead of silently
  // running unscoped.
  throw new TenantScopeViolation(
    model,
    `operation "${operation}" is not covered by the tenant guard yet - extend scopeArgs() before using it`,
  );
}

type AllOperationsArgs = {
  operation: string;
  args: ScopeableArgs;
  query: (args: ScopeableArgs) => Promise<unknown>;
};

function makeHandler(model: TenantScopedModel, brandId: string) {
  return ({ operation, args, query }: AllOperationsArgs) =>
    query(scopeArgs(model, operation, args, brandId));
}

/**
 * Returns a Prisma client scoped to a single brand. Every query against a
 * tenant-owned model runs as if `brandId` were hardcoded into it.
 *
 * The query block is written as a literal object (not built from
 * TENANT_SCOPED_MODELS via a loop) because Prisma's `$extends` typing
 * expects a statically-shaped object per model - an `as any` cast here would
 * silently swallow a typo in a model name, which is exactly the kind of
 * mistake this guard exists to catch.
 */
export function forBrand(brandId: string) {
  if (!brandId) {
    throw new Error("forBrand() requires a non-empty brandId");
  }

  return basePrisma.$extends({
    query: {
      user: { $allOperations: makeHandler("user", brandId) },
      brandMembership: { $allOperations: makeHandler("brandMembership", brandId) },
      pointsTransaction: { $allOperations: makeHandler("pointsTransaction", brandId) },
      campaign: { $allOperations: makeHandler("campaign", brandId) },
      reward: { $allOperations: makeHandler("reward", brandId) },
      coupon: { $allOperations: makeHandler("coupon", brandId) },
      couponFraudEvent: { $allOperations: makeHandler("couponFraudEvent", brandId) },
      packBatch: { $allOperations: makeHandler("packBatch", brandId) },
      packCode: { $allOperations: makeHandler("packCode", brandId) },
      earnRule: { $allOperations: makeHandler("earnRule", brandId) },
      walletSpend: { $allOperations: makeHandler("walletSpend", brandId) },
      store: { $allOperations: makeHandler("store", brandId) },
      purchaseScan: { $allOperations: makeHandler("purchaseScan", brandId) },
      auditEvent: { $allOperations: makeHandler("auditEvent", brandId) },
    },
  });
}

/**
 * The one sanctioned way to read a consumer's profile from brand-scoped
 * code: prove the brand has a membership with this person first, then (and
 * only then) read Person directly. A brand can never list or infer another
 * brand's memberships through this path.
 */
export async function getMemberProfile(brandId: string, personId: string) {
  const scoped = forBrand(brandId);
  const membership = await scoped.brandMembership.findFirst({ where: { personId } });
  if (!membership) {
    return null;
  }
  return basePrisma.person.findUnique({ where: { id: personId } });
}
