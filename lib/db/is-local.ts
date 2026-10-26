/**
 * Whether a connection string points at a database on this machine.
 *
 * Exists because two scripts in this repo are safe on a laptop and
 * destructive anywhere else, and neither of them checked. `pnpm db:seed`
 * creates an OWNER account whose password is written in the seed file, in
 * the repository, for anyone to read. `pnpm demo` opens by deleting every
 * ledger row, scan and coupon belonging to its brand. Both read
 * DATABASE_URL and do as they are told.
 *
 * That is fine right up until the moment somebody has a production
 * connection string exported in the shell they happen to be in, which is
 * not a rare or careless state - it is what you are in immediately after
 * looking at production for any reason at all.
 *
 * ── Why a host allowlist and not an environment check ────────────────────
 *
 * NODE_ENV and VERCEL say where the *code* is running. The question here is
 * where the *data* lives, and those are different: a developer on a laptop
 * with NODE_ENV unset, pointed at a hosted database, is exactly the case
 * that matters and the one an environment check waves through.
 */

/** Hosts that can only ever mean this machine. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"]);

export function isLocalDatabaseUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    // Parsed rather than pattern-matched: a password is commonly a
    // URL-encoded blob containing @ and /, which defeats a naive split and
    // would have this reading part of a credential as a hostname.
    const url = new URL(raw);
    // URL keeps the brackets on an IPv6 literal, so hostname for
    // postgresql://u:p@[::1]:5432/db is "[::1]" and not "::1". Stripping
    // them is the difference between this recognising the loopback address
    // and refusing a perfectly local database.
    const host = decodeURIComponent(url.hostname).toLowerCase().replace(/^\[|\]$/g, "");
    return LOCAL_HOSTS.has(host);
  } catch {
    // Unparseable is not local. Refusing is the safe direction, and the
    // caller's message tells somebody what to look at.
    return false;
  }
}

/** Set to "yes" to run one of these against a hosted database on purpose. */
export const SEED_OVERRIDE = "QUMO_SEED_ANYWHERE";

/**
 * Stops a destructive script unless the database is local.
 *
 * The override exists because a throwaway staging database is a real thing
 * somebody will legitimately want to fill. It is deliberately ugly to type
 * and never something a script sets for itself, so using it is a decision
 * somebody made rather than a default they inherited.
 */
export function assertLocalDatabase(what: string): void {
  if (isLocalDatabaseUrl(process.env.DATABASE_URL)) return;
  if (process.env[SEED_OVERRIDE] === "yes") {
    console.warn(`\n  ${SEED_OVERRIDE} is set. Running ${what} against a database that is not local.\n`);
    return;
  }

  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").hostname || "nowhere";
    } catch {
      return "an unreadable DATABASE_URL";
    }
  })();

  throw new Error(
    [
      ``,
      `  Refusing to run ${what}: DATABASE_URL points at ${host}, not this machine.`,
      ``,
      `  This script is written for a laptop. It creates accounts with passwords`,
      `  that are in the repository, and it deletes rows it did not write.`,
      ``,
      `  If you meant it, set ${SEED_OVERRIDE}=yes.`,
      ``,
    ].join("\n"),
  );
}
