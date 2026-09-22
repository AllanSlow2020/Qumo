import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LoggingSmsClient,
  resolveTwilioCredentials,
  SmsSendError,
  TwilioSmsClient,
  type TwilioCredentials,
} from "@/lib/sms/client";

/**
 * Which credential the passcode sender authenticates with, and what it does
 * when the provider says no.
 *
 * Two things here are worth a test rather than a reading of the code.
 *
 * The first is the refusal to fall back. Twilio accepts either an API key
 * or the account's auth token, and the auth token is the master credential
 * for the whole account: it can buy numbers, spend money and read every
 * message ever sent. Somebody who configures an API key has chosen the
 * narrower one deliberately, so a half-typed key that quietly sends on the
 * master credential instead would be the single worst behaviour available
 * here, and it is exactly what a "use whatever is set" implementation does.
 *
 * The second is the error code. A wrong credential, an unverified
 * recipient and a country nobody enabled all arrive as a 4xx and need three
 * different fixes, and the one that actually happened cost an evening
 * before this carried the code through.
 */
describe("the SMS credential", () => {
  const FULL = {
    TWILIO_ACCOUNT_SID: "AC00000000000000000000000000000001",
    TWILIO_AUTH_TOKEN: "the-account-auth-token",
    TWILIO_FROM_NUMBER: "+17372508034",
  };

  describe("what counts as configured", () => {
    it("is nothing at all when nothing is set", () => {
      expect(resolveTwilioCredentials({})).toBeNull();
    });

    it("takes the account auth token when that is all there is", () => {
      const resolved = resolveTwilioCredentials(FULL);
      expect(resolved).toMatchObject({
        accountSid: FULL.TWILIO_ACCOUNT_SID,
        username: FULL.TWILIO_ACCOUNT_SID,
        password: "the-account-auth-token",
        kind: "auth-token",
      });
    });

    it("prefers an API key over the auth token when both are set", () => {
      const resolved = resolveTwilioCredentials({
        ...FULL,
        TWILIO_API_KEY_SID: "SK00000000000000000000000000000002",
        TWILIO_API_KEY_SECRET: "the-api-key-secret",
      });

      expect(resolved).toMatchObject({
        // The account is still addressed by its own SID: an API key
        // authenticates against an account rather than replacing it.
        accountSid: FULL.TWILIO_ACCOUNT_SID,
        username: "SK00000000000000000000000000000002",
        password: "the-api-key-secret",
        kind: "api-key",
      });
    });

    it("refuses a half-set API key rather than falling back to the master token", () => {
      // The whole point. Somebody pasting a key SID and losing the secret
      // (Twilio shows it once) would otherwise get a working send on the
      // credential they were trying to stop using, and no sign of it.
      expect(resolveTwilioCredentials({ ...FULL, TWILIO_API_KEY_SID: "SK0000000000000000000000000000003" })).toBeNull();
      expect(resolveTwilioCredentials({ ...FULL, TWILIO_API_KEY_SECRET: "orphan-secret" })).toBeNull();
    });

    it("needs an account and a sender whichever credential is used", () => {
      expect(resolveTwilioCredentials({ ...FULL, TWILIO_ACCOUNT_SID: "" })).toBeNull();
      expect(resolveTwilioCredentials({ ...FULL, TWILIO_FROM_NUMBER: "" })).toBeNull();
      // An API key with no account SID cannot address anything, so it is
      // unconfigured rather than half-configured.
      expect(
        resolveTwilioCredentials({
          TWILIO_FROM_NUMBER: FULL.TWILIO_FROM_NUMBER,
          TWILIO_API_KEY_SID: "SK00000000000000000000000000000004",
          TWILIO_API_KEY_SECRET: "secret",
        }),
      ).toBeNull();
    });

    it("survives the whitespace a copy and paste leaves behind", () => {
      const resolved = resolveTwilioCredentials({
        TWILIO_ACCOUNT_SID: `  ${FULL.TWILIO_ACCOUNT_SID}\n`,
        TWILIO_AUTH_TOKEN: " the-account-auth-token ",
        TWILIO_FROM_NUMBER: " +17372508034 ",
      });
      expect(resolved?.accountSid).toBe(FULL.TWILIO_ACCOUNT_SID);
      expect(resolved?.password).toBe("the-account-auth-token");
      expect(resolved?.fromNumber).toBe("+17372508034");
    });
  });

  describe("what goes on the wire", () => {
    let calls: { url: string; headers: Record<string, string>; body: URLSearchParams }[];

    beforeEach(() => {
      calls = [];
      vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
        calls.push({
          url,
          headers: init.headers as Record<string, string>,
          body: new URLSearchParams(String(init.body)),
        });
        return new Response(JSON.stringify({ sid: "SM1" }), { status: 201 });
      });
    });

    afterEach(() => vi.unstubAllGlobals());

    /** The one call made, failing loudly rather than reading undefined. */
    function onlyCall() {
      expect(calls).toHaveLength(1);
      return calls[0]!;
    }

    /** What the Authorization header actually says, decoded. */
    function basicAuth(): [string, string] {
      const encoded = String(onlyCall().headers.Authorization).replace("Basic ", "");
      const [user, ...rest] = Buffer.from(encoded, "base64").toString().split(":");
      return [user ?? "", rest.join(":")];
    }

    it("signs with the API key but still addresses the account", async () => {
      const credentials: TwilioCredentials = {
        accountSid: "AC1",
        username: "SK2",
        password: "shhh",
        fromNumber: "+17372508034",
        kind: "api-key",
      };
      await new TwilioSmsClient(credentials).sendSms("+27821234567", "Your code is 123456");

      expect(onlyCall().url).toContain("/Accounts/AC1/Messages.json");
      expect(basicAuth()).toEqual(["SK2", "shhh"]);
      expect(onlyCall().body.get("To")).toBe("+27821234567");
      expect(onlyCall().body.get("From")).toBe("+17372508034");
      expect(onlyCall().body.get("Body")).toBe("Your code is 123456");
    });

    it("signs with the account SID when there is no key", async () => {
      await new TwilioSmsClient({
        accountSid: "AC1",
        username: "AC1",
        password: "auth-token",
        fromNumber: "+17372508034",
        kind: "auth-token",
      }).sendSms("+27821234567", "Your code is 123456");

      expect(basicAuth()).toEqual(["AC1", "auth-token"]);
    });
  });

  describe("when the provider says no", () => {
    afterEach(() => vi.unstubAllGlobals());

    const credentials: TwilioCredentials = {
      accountSid: "AC1",
      username: "AC1",
      password: "auth-token",
      fromNumber: "+17372508034",
      kind: "auth-token",
    };

    function refuseWith(status: number, body: string) {
      vi.stubGlobal("fetch", async () => new Response(body, { status }));
    }

    it("carries Twilio's code through, because the status cannot name the fix", async () => {
      // 21408 is a region that was never enabled. It is the failure mode
      // that looks like nothing at all: the app records a request, the
      // shopper is told a code is on its way, and no handset ever rings.
      refuseWith(400, JSON.stringify({ code: 21408, message: "Permission to send an SMS has not been enabled" }));

      const err = await new TwilioSmsClient(credentials).sendSms("+27821234567", "hi").catch((e) => e);
      expect(err).toBeInstanceOf(SmsSendError);
      expect(err.status).toBe(400);
      expect(err.code).toBe(21408);
    });

    it("says nothing about the recipient in the message it throws", async () => {
      // Twilio's own error text quotes the destination number. That string
      // must not become the thing an outer layer logs or renders.
      refuseWith(400, JSON.stringify({ code: 21608, message: "The number +27821234567 is unverified" }));

      const err = await new TwilioSmsClient(credentials).sendSms("+27821234567", "hi").catch((e) => e);
      expect(err.message).not.toContain("+27821234567");
      expect(err.message).not.toContain("unverified");
    });

    it("still fails usefully when the body is not the JSON it promised", async () => {
      // A gateway or a proxy in front of the API answers with HTML, and a
      // parse error here would replace a diagnosable failure with a
      // confusing one on a path that is already broken.
      refuseWith(502, "<html>Bad Gateway</html>");

      const err = await new TwilioSmsClient(credentials).sendSms("+27821234567", "hi").catch((e) => e);
      expect(err).toBeInstanceOf(SmsSendError);
      expect(err.status).toBe(502);
      expect(err.code).toBeUndefined();
    });
  });

  describe("with nothing configured", () => {
    it("logs rather than sends, and never throws for it", async () => {
      // The state every local checkout and every fresh deployment is in.
      // A login has to complete against this, or nothing is testable until
      // an account exists.
      await expect(new LoggingSmsClient().sendSms("+27821234567", "Your code is 123456")).resolves.toBeUndefined();
    });
  });
});
