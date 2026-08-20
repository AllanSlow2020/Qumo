import { describe, expect, it, vi } from "vitest";
import { rateLimit } from "@/lib/security/rate-limit";

describe("rateLimit", () => {
  it("allows requests up to the limit, then blocks the next one", () => {
    const key = `test-${Date.now()}-a`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000).allowed).toBe(true);
    }
    const sixth = rateLimit(key, 5, 60_000);
    expect(sixth.allowed).toBe(false);
    expect(sixth.remaining).toBe(0);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-${Date.now()}-b`;
    const keyB = `test-${Date.now()}-c`;
    expect(rateLimit(keyA, 1, 60_000).allowed).toBe(true);
    expect(rateLimit(keyA, 1, 60_000).allowed).toBe(false);
    // keyB has never been touched, so it should not be affected by keyA
    // being exhausted — a same-path different-IP request shouldn't block.
    expect(rateLimit(keyB, 1, 60_000).allowed).toBe(true);
  });

  it("resets the window once it elapses", () => {
    vi.useFakeTimers();
    try {
      const key = `test-${Date.now()}-d`;
      expect(rateLimit(key, 1, 1_000).allowed).toBe(true);
      expect(rateLimit(key, 1, 1_000).allowed).toBe(false);

      vi.advanceTimersByTime(1_001);

      expect(rateLimit(key, 1, 1_000).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports decreasing remaining count as the window fills up", () => {
    const key = `test-${Date.now()}-e`;
    expect(rateLimit(key, 3, 60_000).remaining).toBe(2);
    expect(rateLimit(key, 3, 60_000).remaining).toBe(1);
    expect(rateLimit(key, 3, 60_000).remaining).toBe(0);
  });
});
