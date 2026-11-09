import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],

    /**
     * One test file at a time, because they share one database.
     *
     * ── What this fixes ──────────────────────────────────────────────────
     *
     * Most of these files write to Postgres, and the ones that decide
     * anything from a balance run Serializable: the coupon threshold, a
     * stamp card completing, a wallet spend. Postgres aborts one side of
     * any two Serializable transactions it cannot order, which is the
     * system working. The engine retries, six times, and that is normally
     * the end of it.
     *
     * Run in parallel on a loaded CI runner, it was not the end of it. The
     * suite put enough unrelated transactions in flight at once that all
     * six attempts could lose, and a run would fail with
     * TransactionWriteConflict in whichever file happened to be unlucky.
     * The same commit passed on a second run, which is the signature of a
     * flaky suite and the reason to fix it rather than re-run it: a suite
     * that fails one run in three teaches people to ignore CI, and then it
     * is not a suite, it is a decoration.
     *
     * ── Why this, and not the alternatives ───────────────────────────────
     *
     * Raising MAX_SERIALIZATION_ATTEMPTS would have been changing product
     * code to accommodate a test harness. The retry ceiling is a decision
     * about what a shopper should wait through at a till; it is not a knob
     * for making CI quieter.
     *
     * A schema per test file would keep the parallelism and is the textbook
     * answer, but every scoped client in lib/db and lib/consumer assumes
     * one schema, so it is a large change to the thing being tested in
     * order to speed up the thing testing it.
     *
     * ── What it costs, and what it does not hide ─────────────────────────
     *
     * About 53 seconds instead of 24. The tests themselves got faster -
     * 34 seconds of test time instead of 46 - because nothing is retrying
     * any more; only the wall clock grew, since nothing overlaps.
     *
     * It hides no real concurrency. The races that matter are created
     * deliberately inside single files, two counters taking one coupon in
     * the same instant and two tills spending one wallet, and those still
     * run and still exercise every retry path. What is gone is contention
     * between unrelated files, which has no production analogue: nothing
     * in production runs seventy-one scripts against one database on two
     * cores and expects them all to win.
     */
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
