import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { hashPhone } from "@/lib/security/crypto";

/**
 * The endpoint an aggregator posts to, tested as the trust boundary it is.
 *
 * Everything below the route treats the sender's number as settled fact: it
 * looks up whose it is and answers with their balance, and there is nothing
 * further down that could second-guess the claim, because the network's
 * assertion was the only evidence there ever was. That makes this file's
 * auth check the entire defence, and a defence with no test is a defence
 * until somebody refactors it.
 *
 * So the cases here are mostly about refusal, and one of them is about the
 * state every deployment starts in: no secret configured yet.
 */

const SECRET = `sms-secret-${randomUUID()}`;
const run = randomUUID().slice(0, 8);
const SENDER = `+2786${String(Date.now()).slice(-7)}`;

const { POST } = await import("@/app/api/sms/inbound/route");

function post(body: unknown, init: { token?: string; query?: string; form?: boolean } = {}): NextRequest {
  const headers = new Headers();
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);

  let payload: BodyInit;
  if (init.form) {
    const form = new URLSearchParams(body as Record<string, string>);
    headers.set("content-type", "application/x-www-form-urlencoded");
    payload = form.toString();
  } else {
    headers.set("content-type", "application/json");
    payload = JSON.stringify(body);
  }

  const url = `https://qumo.test/api/sms/inbound${init.query ?? ""}`;
  return new NextRequest(url, { method: "POST", headers, body: payload });
}

beforeAll(async () => {
  await prisma.person.create({
    data: {
      phoneHash: hashPhone(SENDER),
      phoneEncrypted: "x",
      consentGivenAt: new Date(),
      consentVersion: "web-v3",
    },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await prisma.person.deleteMany({ where: { phoneHash: hashPhone(SENDER) } });
  await prisma.rateLimit.deleteMany({ where: { key: `sms-inbound:${hashPhone(SENDER)}` } });
});

describe("POST /api/sms/inbound", () => {
  describe("before it will do anything at all", () => {
    it("refuses every request while no secret is configured", async () => {
      vi.stubEnv("SMS_WEBHOOK_SECRET", "");

      const response = await POST(post({ from: SENDER, text: "BALANCE" }, { token: "anything" }));

      // The state a fresh deployment is in. If this ever returns 200, the
      // window between "deployed" and "secret added" is a public balance
      // lookup for every number in the country.
      expect(response.status).toBe(401);
    });

    it("refuses a request with no token", async () => {
      vi.stubEnv("SMS_WEBHOOK_SECRET", SECRET);
      expect((await POST(post({ from: SENDER, text: "BALANCE" }))).status).toBe(401);
    });

    it("refuses a wrong token", async () => {
      vi.stubEnv("SMS_WEBHOOK_SECRET", SECRET);
      const response = await POST(post({ from: SENDER, text: "BALANCE" }, { token: `${SECRET}x` }));
      expect(response.status).toBe(401);
    });

    it("does not leak whether a number is known to an unauthorised caller", async () => {
      vi.stubEnv("SMS_WEBHOOK_SECRET", SECRET);

      const known = await POST(post({ from: SENDER, text: "BALANCE" }, { token: "wrong" }));
      const unknown = await POST(post({ from: "+27829999999", text: "BALANCE" }, { token: "wrong" }));

      expect(await known.text()).toBe(await unknown.text());
      expect(known.status).toBe(unknown.status);
    });
  });

  describe("once it is configured", () => {
    it("accepts the token in a header", async () => {
      vi.stubEnv("SMS_WEBHOOK_SECRET", SECRET);
      const response = await POST(post({ from: SENDER, text: "HELP" }, { token: SECRET }));

      expect(response.status).toBe(200);
      expect(await response.text()).toContain("BALANCE");
    });

    it("accepts the token in the query string, for consoles that offer only a URL", async () => {
      vi.stubEnv("SMS_WEBHOOK_SECRET", SECRET);
      const response = await POST(post({ from: SENDER, text: "HELP" }, { query: `?token=${SECRET}` }));

      expect(response.status).toBe(200);
      expect(await response.text()).toContain("BALANCE");
    });

    it("reads a form-encoded post, which is what most aggregators send", async () => {
      vi.stubEnv("SMS_WEBHOOK_SECRET", SECRET);
      const response = await POST(post({ From: SENDER, Body: "HELP" }, { token: SECRET, form: true }));

      expect(response.status).toBe(200);
      expect(await response.text()).toContain("BALANCE");
    });

    it("finds the sender under whichever field name the provider chose", async () => {
      vi.stubEnv("SMS_WEBHOOK_SECRET", SECRET);

      for (const body of [
        { msisdn: SENDER, text: "HELP" },
        { sender: SENDER, message: "HELP" },
        { sourceAddr: SENDER, shortMessage: "HELP" },
      ]) {
        const response = await POST(post(body, { token: SECRET }));
        expect(await response.text()).toContain("BALANCE");
      }
    });

    it("swallows a delivery receipt rather than making the provider retry it", async () => {
      vi.stubEnv("SMS_WEBHOOK_SECRET", SECRET);
      const response = await POST(post({ status: "delivered", messageId: run }, { token: SECRET }));

      // 200 with nothing to say. A 4xx here would have the aggregator
      // redeliver a message that has no sender, forever.
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("");
    });

    it("answers as plain text that is never cached", async () => {
      vi.stubEnv("SMS_WEBHOOK_SECRET", SECRET);
      const response = await POST(post({ from: SENDER, text: "HELP" }, { token: SECRET }));

      expect(response.headers.get("content-type")).toContain("text/plain");
      expect(response.headers.get("cache-control")).toBe("no-store");
    });
  });
});
