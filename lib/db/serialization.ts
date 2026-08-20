import { Prisma } from "@prisma/client";

/**
 * Whether a failed transaction failed because Postgres refused to let two
 * Serializable transactions interleave, rather than because anything is
 * actually wrong.
 *
 * Any decision of the form "read a balance, then write based on it" has to
 * run Serializable, or two concurrent attempts can each read the same
 * balance and both act on it — issuing one coupon over budget, or letting
 * a wallet go overdrawn between two tills. Postgres detects that conflict
 * and aborts one side, which is the system working: the correct response
 * is to retry the whole attempt, not to surface an error.
 *
 * The conflict arrives two different ways depending on where Postgres
 * notices it. The Prisma engine translates it to P2034 ("write conflict or
 * deadlock — retry your transaction") when it surfaces at commit, but with
 * the pg driver adapter a conflict detected mid-transaction can reach us
 * first as a raw `DriverAdapterError` from @prisma/driver-adapter-utils,
 * before the engine can translate it. Both are checked, duck-typed rather
 * than importing that package, since it is only a transitive dependency.
 *
 * Lives here rather than beside its first caller because there is now more
 * than one place that reads a balance and writes based on it — the
 * check-in coupon threshold, a pack scan completing a stamp card, and a
 * wallet spend — and each one silently getting its own copy of this
 * reasoning is how they drift apart.
 */
export function isSerializationConflict(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
    return true;
  }
  return (
    err instanceof Error &&
    err.name === "DriverAdapterError" &&
    (err as { cause?: { kind?: string } }).cause?.kind === "TransactionWriteConflict"
  );
}

/** How many times a Serializable attempt is retried before giving up. */
export const MAX_SERIALIZATION_ATTEMPTS = 6;
