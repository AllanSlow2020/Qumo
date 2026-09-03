import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";

/**
 * The per-client login cap, which moved out of the Edge proxy when the
 * counter moved into Postgres.
 *
 * `next/headers` is mocked rather than driven through a real request
 * because the only thing this module takes from a request is one header,
 * and the interesting behaviour is entirely in what it does with it.
 */
const forwardedFor = vi.hoisted(() => ({ value: null as string | null }));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => (name === "x-forwarded-for" ? forwardedFor.value : null) }),
}));

const { loginAttemptAllowed } = await import("@/lib/security/login-guard");

const LIMIT = 20;
let keys: string[] = [];

function address(): string {
  // A fresh address per test, so one test's exhausted allowance is never
  // another's starting state.
  const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}-${randomUUID()}`;
  keys.push(`login:shopper:${ip}`, `login:staff:${ip}`);
  return ip;
}

beforeEach(() => {
  keys = [];
});

afterEach(async () => {
  await prisma.rateLimit.deleteMany({ where: { key: { in: keys } } });
  forwardedFor.value = null;
});

describe("loginAttemptAllowed", () => {
  it("allows a normal run of attempts and then refuses", async () => {
    forwardedFor.value = address();
    for (let i = 0; i < LIMIT; i += 1) {
      expect(await loginAttemptAllowed("shopper")).toBe(true);
    }
    expect(await loginAttemptAllowed("shopper")).toBe(false);
  });

  it("keeps the two sign-in surfaces apart", async () => {
    forwardedFor.value = address();
    for (let i = 0; i < LIMIT + 1; i += 1) {
      await loginAttemptAllowed("shopper");
    }
    expect(await loginAttemptAllowed("shopper")).toBe(false);
    // A shopper exhausting their own allowance must not lock a brand's
    // staff out of the console from behind the same NAT.
    expect(await loginAttemptAllowed("staff")).toBe(true);
  });

  it("counts each client address separately", async () => {
    const first = address();
    forwardedFor.value = first;
    for (let i = 0; i < LIMIT + 1; i += 1) {
      await loginAttemptAllowed("shopper");
    }
    expect(await loginAttemptAllowed("shopper")).toBe(false);

    forwardedFor.value = address();
    expect(await loginAttemptAllowed("shopper")).toBe(true);
  });

  it("reads only the original client from a chain of proxies", async () => {
    const client = address();
    forwardedFor.value = `${client}, 203.0.113.9, 203.0.113.10`;
    for (let i = 0; i < LIMIT + 1; i += 1) {
      await loginAttemptAllowed("shopper");
    }

    // Same client, now arriving through a different chain of proxies. The
    // allowance must follow the client, or anyone could reset their own by
    // appending a hop.
    forwardedFor.value = `${client}, 203.0.113.77`;
    expect(await loginAttemptAllowed("shopper")).toBe(false);
  });

  it("puts requests with no address in one shared bucket rather than waving them through", async () => {
    forwardedFor.value = null;
    keys.push("login:shopper:unknown");
    for (let i = 0; i < LIMIT + 1; i += 1) {
      await loginAttemptAllowed("shopper");
    }
    expect(await loginAttemptAllowed("shopper")).toBe(false);
  });
});
