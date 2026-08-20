import { prisma as basePrisma } from "@/lib/db/client";

/**
 * The consumer mirror of forBrand(), and the only sanctioned way shopper-
 * facing code reads the database.
 *
 * forBrand() answers "every person, for one brand". Qumo asks the
 * opposite question — "every brand, for one person" — and it must never be
 * answered with the brand-scoped client. Reaching for forBrand() to build
 * a shopper's wallet would require inventing a brandId to scope to, and
 * the natural way to list balances across brands would be to loop it over
 * every brand in the platform, which is a cross-tenant read wearing the
 * tenant guard's clothing. Hence a separate lens with a separate rule.
 *
 * Two deliberate differences from forBrand():
 *
 * 1. It is READ-ONLY. Every write operation is rejected outright. A
 *    shopper's reads are a lens over their own data, but their writes are
 *    always someone else's business rule — awarding points, spending a
 *    wallet, burning a scan code — with validation and atomicity of their
 *    own. Letting this client create a PointsTransaction would put "how
 *    many points is this worth" on the shopper's side of the boundary.
 *
 * 2. Scoping is by relationship, not just by column. PointsTransaction,
 *    Coupon and WalletSpend have no personId — they hang off
 *    BrandMembership — so those are scoped with a relation filter. The guarantee is the same either
 *    way: the query cannot name another person.
 *
 * Anything not listed here is not reachable through this client at all.
 * Note the sharp edge that applies to forBrand() too: this only guards the
 * models named below. Adding a person-owned model to the schema without
 * adding it here does not half-protect it — it leaves it entirely outside
 * the lens.
 */

/** Scoped by a personId column of their own. */
const PERSON_COLUMN_MODELS = ["brandMembership"] as const;
/** Scoped through the BrandMembership that owns the row. */
const MEMBERSHIP_RELATION_MODELS = ["pointsTransaction", "coupon", "walletSpend"] as const;

export class ConsumerScopeViolation extends Error {
  constructor(model: string, detail: string) {
    super(`Consumer scope violation on "${model}": ${detail}`);
    this.name = "ConsumerScopeViolation";
  }
}

// `data` and `create` are declared even though this lens rejects every
// operation that would use them: Prisma types the $allOperations callback
// against the union of *all* a model's argument shapes, including creates,
// and a type carrying only `where` has no property in common with a create
// arg — which TypeScript reports as an incompatibility. forBrand()'s
// equivalent type has the same three fields for the same reason.
type ScopeableArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
};

// groupBy and aggregate are included on purpose, unlike in forBrand():
// deriving a balance is a SUM over the ledger, and forcing that through
// findMany would mean pulling every transaction a shopper has ever earned
// into memory to add it up.
const READ_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

function scopeArgs(
  model: string,
  operation: string,
  args: ScopeableArgs | undefined,
  scopeFilter: Record<string, unknown>,
  personId: string,
): ScopeableArgs {
  if (!READ_OPS.has(operation)) {
    throw new ConsumerScopeViolation(
      model,
      `operation "${operation}" is not permitted — forPerson() is a read-only lens, so writes must go through a server action that owns the rule being applied`,
    );
  }

  const where = { ...args?.where };
  for (const [key, value] of Object.entries(scopeFilter)) {
    // Reject rather than silently overwrite, for the same reason forBrand()
    // does: a caller that supplied a different person is a bug, and quietly
    // correcting it hides the bug instead of surfacing it.
    if (where[key] !== undefined && JSON.stringify(where[key]) !== JSON.stringify(value)) {
      throw new ConsumerScopeViolation(
        model,
        `args constrained "${key}" in a way that disagrees with the scope for person "${personId}"`,
      );
    }
    where[key] = value;
  }

  return { ...args, where };
}

type AllOperationsArgs = {
  operation: string;
  args: ScopeableArgs;
  query: (args: ScopeableArgs) => Promise<unknown>;
};

function makeHandler(model: string, scopeFilter: Record<string, unknown>, personId: string) {
  return ({ operation, args, query }: AllOperationsArgs) =>
    query(scopeArgs(model, operation, args, scopeFilter, personId));
}

/**
 * Returns a read-only Prisma client scoped to a single shopper. Every
 * query against a person-owned model runs as if `personId` were hardcoded
 * into it.
 *
 * Written as a literal object per model rather than generated from the
 * arrays above for the same reason forBrand() is: Prisma's $extends typing
 * wants a statically-shaped object, and an `as any` here would swallow
 * exactly the typo this guard exists to catch. The arrays stay as the
 * documented inventory.
 */
export function forPerson(personId: string) {
  if (!personId) {
    throw new Error("forPerson() requires a non-empty personId");
  }

  const byColumn = { personId };
  const byMembership = { brandMembership: { personId } };

  return basePrisma.$extends({
    query: {
      brandMembership: { $allOperations: makeHandler("brandMembership", byColumn, personId) },
      pointsTransaction: { $allOperations: makeHandler("pointsTransaction", byMembership, personId) },
      coupon: { $allOperations: makeHandler("coupon", byMembership, personId) },
      walletSpend: { $allOperations: makeHandler("walletSpend", byMembership, personId) },
    },
  });
}

export const CONSUMER_SCOPED_MODELS = [...PERSON_COLUMN_MODELS, ...MEMBERSHIP_RELATION_MODELS] as const;
