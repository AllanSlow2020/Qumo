import { afterEach, describe, expect, it, vi } from "vitest";
import { assertLocalDatabase, isLocalDatabaseUrl, SEED_OVERRIDE } from "@/lib/db/is-local";

/**
 * The guard on the two scripts that are safe on a laptop and destructive
 * anywhere else.
 *
 * `pnpm db:seed` creates an OWNER account whose password is a literal in the
 * seed file, in this repository. `pnpm demo` opens by deleting every ledger
 * row, scan and coupon belonging to its brand. Neither checked where
 * DATABASE_URL pointed, and the state where that matters is not a careless
 * one: it is the shell you are in immediately after looking at production
 * for any reason at all.
 */
describe("refusing to seed a database that is not this machine", () => {
  afterEach(() => vi.unstubAllEnvs());

  describe("what counts as local", () => {
    it("accepts the loopback names", () => {
      for (const host of ["localhost", "127.0.0.1", "[::1]", "host.docker.internal"]) {
        expect(isLocalDatabaseUrl(`postgresql://u:p@${host}:5432/qumo`)).toBe(true);
      }
    });

    it("refuses anything else", () => {
      for (const host of ["ep-cool-1.eu-central-1.aws.neon.tech", "db.supabase.co", "10.0.0.5", "example.com"]) {
        expect(isLocalDatabaseUrl(`postgresql://u:p@${host}:5432/qumo`)).toBe(false);
      }
    });

    it("is not fooled by a hostname sitting inside a password", () => {
      // The reason this parses rather than pattern-matches. A password is
      // commonly a URL-encoded blob, and one containing "@localhost" would
      // read as local to anything splitting on @.
      expect(isLocalDatabaseUrl("postgresql://user:pass%40localhost@db.neon.tech:5432/qumo")).toBe(false);
      expect(isLocalDatabaseUrl("postgresql://localhost:secret@db.neon.tech:5432/qumo")).toBe(false);
    });

    it("treats missing and unparseable as not local", () => {
      // Refusing is the safe direction: the cost of a false refusal is a
      // message, and the cost of a false pass is a production database.
      expect(isLocalDatabaseUrl(undefined)).toBe(false);
      expect(isLocalDatabaseUrl("")).toBe(false);
      expect(isLocalDatabaseUrl("not a url at all")).toBe(false);
    });
  });

  describe("what the scripts do about it", () => {
    it("lets a local database through silently", () => {
      vi.stubEnv("DATABASE_URL", "postgresql://qumo:qumo@localhost:5432/qumo_dev");
      expect(() => assertLocalDatabase("the seed")).not.toThrow();
    });

    it("stops a hosted one, and says where it was pointed", () => {
      vi.stubEnv("DATABASE_URL", "postgresql://u:p@ep-cool-1.aws.neon.tech:5432/qumo");

      // Naming the host matters: the whole failure mode is not realising
      // which database is in this shell, so "not local" alone would leave
      // somebody looking for the wrong thing.
      expect(() => assertLocalDatabase("the seed")).toThrow(/ep-cool-1\.aws\.neon\.tech/);
      expect(() => assertLocalDatabase("the seed")).toThrow(/the seed/);
    });

    it("can be overridden on purpose, and only on purpose", () => {
      vi.stubEnv("DATABASE_URL", "postgresql://u:p@ep-cool-1.aws.neon.tech:5432/qumo");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Deliberately not a boolean-ish check. "true", "1" and "yes please"
      // all leave it refusing, because a half-remembered override that
      // silently does nothing is worse than one that is exact.
      vi.stubEnv(SEED_OVERRIDE, "true");
      expect(() => assertLocalDatabase("the seed")).toThrow();

      vi.stubEnv(SEED_OVERRIDE, "yes");
      expect(() => assertLocalDatabase("the seed")).not.toThrow();
      // Loud when used, because it is the one path where this does the
      // dangerous thing.
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
