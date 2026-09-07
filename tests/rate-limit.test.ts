import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { rateLimit, sweepExpiredRateLimits } from "@/lib/security/rate-limit";

/**
 * Keys are namespaced per run so a failed test never leaves a counter that
 * makes the next run fail for the wrong reason.
 */
const run = randomUUID();
const keys: string[] = [];
function key(name: string): string {
  const k = `test:${run}:${name}`;
  keys.push(k);
  return k;
}

afterAll(async () => {
  await prisma.rateLimit.deleteMany({ where: { key: { in: keys } } });
});

describe("rateLimit", () => {
  it("allows requests up to the limit, then blocks the next one", async () => {
    const k = key("basic");
    for (let i = 0; i < 5; i += 1) {
      expect((await rateLimit(k, 5, 60_000)).allowed).toBe(true);
    }
    const sixth = await rateLimit(k, 5, 60_000);
    expect(sixth.allowed).toBe(false);
    expect(sixth.remaining).toBe(0);
  });

  it("tracks separate keys independently", async () => {
    const a = key("separate-a");
    const b = key("separate-b");
    expect((await rateLimit(a, 1, 60_000)).allowed).toBe(true);
    expect((await rateLimit(a, 1, 60_000)).allowed).toBe(false);
    expect((await rateLimit(b, 1, 60_000)).allowed).toBe(true);
  });

  it("reports how many attempts are left", async () => {
    const k = key("remaining");
    expect((await rateLimit(k, 3, 60_000)).remaining).toBe(2);
    expect((await rateLimit(k, 3, 60_000)).remaining).toBe(1);
    expect((await rateLimit(k, 3, 60_000)).remaining).toBe(0);
  });

  it("lets the caller back in once the window has closed", async () => {
    const k = key("window");
    const start = new Date();
    expect((await rateLimit(k, 1, 1_000, start)).allowed).toBe(true);
    expect((await rateLimit(k, 1, 1_000, start)).allowed).toBe(false);

    const afterWindow = new Date(start.getTime() + 1_001);
    const fresh = await rateLimit(k, 1, 1_000, afterWindow);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(0);
  });

  it("reports when the caller may try again", async () => {
    const k = key("reset-at");
    const start = new Date();
    const first = await rateLimit(k, 2, 60_000, start);
    expect(first.resetAt.getTime()).toBe(start.getTime() + 60_000);

    // A second attempt inside the window extends nothing: a fixed window
    // ends when it ends, or a caller could hold themselves out forever by
    // continuing to knock.
    const second = await rateLimit(k, 2, 60_000, new Date(start.getTime() + 5_000));
    expect(second.resetAt.getTime()).toBe(first.resetAt.getTime());
  });
});

describe("rateLimit under concurrency", () => {
  /**
   * Proves the statement is atomic under real concurrency.
   *
   * A read-then-write limiter — Prisma's own upsert, or the obvious
   * findUnique-then-update — lets N in-flight requests all read the same
   * count, all decide they are under the limit, and all proceed, so a limit
   * of 3 admits as many attackers as arrive together. Twenty simultaneous
   * attempts against a limit of 3 must admit exactly 3.
   *
   * Worth being precise about what this does and does not catch: the old
   * in-memory limiter would have passed this, because synchronous code on
   * one thread cannot interleave. It is the test below that the old design
   * fails.
   */
  it("admits exactly the limit when every request arrives at once", async () => {
    const k = key("stampede");
    const results = await Promise.all(
      Array.from({ length: 20 }, () => rateLimit(k, 3, 60_000)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
  });

  /**
   * The multi-instance case, which is the whole point of the change.
   *
   * `vi.resetModules()` between the two imports gives each copy of the
   * limiter its own module scope — which is precisely where the old
   * limiter's `Map` of counters lived — while both still reach the one
   * database. That is what two serverless instances of this app are: the
   * same code, separate memory, shared Postgres.
   *
   * Against the old implementation this test admits six of eight attempts
   * against a limit of three, because each instance keeps its own tally.
   * It must admit three.
   */
  it("shares one counter across separate instances of the module", async () => {
    vi.resetModules();
    const instanceA = await import("@/lib/security/rate-limit");
    vi.resetModules();
    const instanceB = await import("@/lib/security/rate-limit");

    // Distinct module objects, or the test proves nothing about separate
    // memory and would keep passing if resetModules stopped working.
    expect(instanceA).not.toBe(instanceB);

    const k = key("two-instances");
    const allowed: boolean[] = [];
    for (const instance of [instanceA, instanceB, instanceA, instanceB, instanceA, instanceB, instanceA, instanceB]) {
      allowed.push((await instance.rateLimit(k, 3, 60_000)).allowed);
    }

    expect(allowed.filter(Boolean)).toHaveLength(3);
    // And the three that were let through are the first three, not three
    // scattered through the run.
    expect(allowed).toEqual([true, true, true, false, false, false, false, false]);
  });
});

describe("sweepExpiredRateLimits", () => {
  it("deletes closed windows and keeps open ones", async () => {
    const closed = key("sweep-closed");
    const open = key("sweep-open");
    const start = new Date();

    await rateLimit(closed, 5, 1_000, start);
    await rateLimit(open, 5, 60_000, start);

    await sweepExpiredRateLimits(new Date(start.getTime() + 5_000));

    expect(await prisma.rateLimit.findUnique({ where: { key: closed } })).toBeNull();
    expect(await prisma.rateLimit.findUnique({ where: { key: open } })).not.toBeNull();
  });
});
