// A minimal fixed-window rate limiter, in-memory, per process. This is
// intentionally simple and has a real limitation worth stating rather than
// hiding: on a multi-instance deployment (multiple serverless invocations,
// multiple containers) each instance counts independently, so the effective
// limit is (per-instance limit) x (instance count). That's fine as a first
// line of defense against casual abuse/brute force; it is NOT sufficient
// as the only defense in a scaled-out production deployment, where a
// shared store (Redis/Upstash) is the correct fix. Flagged here for
// Phase 5 hardening rather than silently shipped as if it were enough.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count };
}
