import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { hashPhone } from "@/lib/security/crypto";
import { signedPayload } from "@/lib/sms/twilio-signature";
import { createHmac } from "node:crypto";

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

const AUTH_TOKEN = `twilio-auth-${randomUUID()}`;
const WEBHOOK_URL = "https://qumo.test/api/sms/inbound";

/**
 * A form post carrying a real Twilio signature.
 *
 * The digest is computed here with the same algorithm rather than with a
 * fixture, because a fixture would be a copy of the implementation's output
 * and would therefore keep agreeing with it after the implementation went
 * wrong. `signedPayload` is shared; the HMAC is done independently.
 */
function signedPost(params: Record<string, string>, token = AUTH_TOKEN): NextRequest {
  const signature = createHmac("sha1", token).update(signedPayload(WEBHOOK_URL, params), "utf8").digest("base64");

  const headers = new Headers({
    "content-type": "application/x-www-form-urlencoded",
    "x-twilio-signature": signature,
  });

  return new NextRequest(WEBHOOK_URL, {
    method: "POST",
    headers,
    body: new URLSearchParams(params).toString(),
  });
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
  /*
   * The bearer secret is only consulted when no auth token is configured
   * (see authorised() in the route). Cleared before each test so these
   * cases mean what they say whatever the developer's own .env holds; the
   * signature block below sets it deliberately.
   */
  beforeEach(() => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
  });

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

    it("refuses the token in the query string, which is where it used to be accepted", async () => {
      vi.stubEnv("SMS_WEBHOOK_SECRET", SECRET);
      const response = await POST(post({ from: SENDER, text: "HELP" }, { query: `?token=${SECRET}` }));

      // Deliberately removed rather than deprecated. A secret in a URL is
      // written into the provider's request inspector and the platform's
      // logs, so it leaks by design; see lib/sms/twilio-signature.ts. This
      // asserts the removal, because a path that is merely unused comes
      // back the first time somebody needs a quick way in.
      expect(response.status).toBe(401);
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
      // redeliver a message that has no sender, forever. Empty TwiML
      // rather than an empty body, because Twilio reads anything it
      // cannot parse as an application error.
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    });

    it("answers as TwiML that is never cached", async () => {
      // The reply used to go back as plain text, which Twilio cannot
      // parse: it logs a schema warning and sends the shopper nothing, so
      // the channel looked like it worked from our side and was silence
      // from theirs.
      vi.stubEnv("SMS_WEBHOOK_SECRET", SECRET);
      const response = await POST(post({ from: SENDER, text: "HELP" }, { token: SECRET }));
      const text = await response.text();

      expect(response.headers.get("content-type")).toContain("text/xml");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(text).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?><Response><Message>/);
      expect(text).toMatch(/<\/Message><\/Response>$/);
    });
  });

  /**
   * The signature path, which is the one that actually holds for Twilio.
   *
   * A shared secret proves who called. A signature proves what they said,
   * and that is the difference that matters here: with a bearer token,
   * anybody holding it can post any `From` they like, and an inbound
   * message can read a balance, claim a pack code, opt a number out, or
   * answer YES and write a consent record for a number that never
   * consented. The last of those forges the evidence this product's lawful
   * basis rests on.
   */
  describe("when an auth token is configured", () => {
    beforeEach(() => {
      vi.stubEnv("TWILIO_AUTH_TOKEN", AUTH_TOKEN);
      vi.stubEnv("TWILIO_WEBHOOK_URL", WEBHOOK_URL);
    });

    it("accepts a correctly signed post", async () => {
      const response = await POST(signedPost({ From: SENDER, Body: "HELP" }));

      expect(response.status).toBe(200);
      expect(await response.text()).toContain("BALANCE");
    });

    it("refuses a signed post whose sender was changed afterwards", async () => {
      const signed = signedPost({ From: SENDER, Body: "HELP" });
      const signature = signed.headers.get("x-twilio-signature") ?? "";

      // The same signature, replayed over a different sender. This is the
      // whole attack the bearer token could not stop, so it is the test
      // that would have to fail before this endpoint regressed to it.
      const tampered = new NextRequest(WEBHOOK_URL, {
        method: "POST",
        headers: new Headers({
          "content-type": "application/x-www-form-urlencoded",
          "x-twilio-signature": signature,
        }),
        body: new URLSearchParams({ From: "+27829999999", Body: "HELP" }).toString(),
      });

      expect((await POST(tampered)).status).toBe(401);
    });

    it("refuses a post signed with the wrong token", async () => {
      const response = await POST(signedPost({ From: SENDER, Body: "HELP" }, `${AUTH_TOKEN}x`));
      expect(response.status).toBe(401);
    });

    it("refuses a post with no signature at all", async () => {
      const response = await POST(post({ From: SENDER, Body: "HELP" }, { form: true }));
      expect(response.status).toBe(401);
    });

    it("does not fall back to the bearer secret", async () => {
      vi.stubEnv("SMS_WEBHOOK_SECRET", SECRET);

      // A valid bearer token, which would have been accepted a moment ago.
      // Accepting both would mean the weaker mechanism decides what an
      // attacker has to defeat, which is the same as not having added the
      // stronger one.
      const response = await POST(post({ From: SENDER, Body: "HELP" }, { token: SECRET, form: true }));

      expect(response.status).toBe(401);
    });

    it("refuses a JSON body, which cannot carry a signature this scheme covers", async () => {
      vi.stubEnv("SMS_WEBHOOK_SECRET", SECRET);
      const response = await POST(post({ from: SENDER, text: "HELP" }, { token: SECRET }));

      expect(response.status).toBe(401);
    });
  });
});
