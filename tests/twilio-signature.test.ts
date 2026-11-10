import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signedPayload, twilioSignatureValid, webhookUrl } from "@/lib/sms/twilio-signature";

/**
 * The signature primitives, separately from the route that uses them.
 *
 * Worth its own file because the two ways this goes wrong are both silent.
 * A wrong parameter order and a wrong URL each produce a digest that simply
 * does not match, so both present as "every request is refused", which
 * looks exactly like a misconfigured console and gets debugged there
 * instead of here.
 */

const TOKEN = "an-auth-token";

function sign(url: string, params: Record<string, string>, token = TOKEN): string {
  return createHmac("sha1", token).update(signedPayload(url, params), "utf8").digest("base64");
}

describe("signedPayload", () => {
  it("appends each parameter as name then value, in name order", () => {
    expect(signedPayload("https://x.test/h", { b: "2", a: "1" })).toBe("https://x.test/ha1b2");
  });

  it("does not depend on the order the parameters arrived in", () => {
    const one = signedPayload("https://x.test/h", { From: "+27820000000", Body: "HELP" });
    const two = signedPayload("https://x.test/h", { Body: "HELP", From: "+27820000000" });

    // Twilio sorts by name, so a provider reordering its form fields must
    // not change the digest. If this ever fails, every real request starts
    // being refused and nothing says why.
    expect(one).toBe(two);
  });

  it("covers the URL, so a signature cannot be replayed against another path", () => {
    const params = { From: "+27820000000", Body: "HELP" };
    expect(signedPayload("https://x.test/a", params)).not.toBe(signedPayload("https://x.test/b", params));
  });
});

describe("twilioSignatureValid", () => {
  const url = "https://x.test/api/sms/inbound";
  const params = { From: "+27820000000", Body: "BALANCE" };

  it("accepts the signature Twilio would have sent", () => {
    expect(twilioSignatureValid(TOKEN, url, params, sign(url, params))).toBe(true);
  });

  it("rejects a changed parameter", () => {
    const signature = sign(url, params);
    expect(twilioSignatureValid(TOKEN, url, { ...params, From: "+27829999999" }, signature)).toBe(false);
  });

  it("rejects an added parameter", () => {
    const signature = sign(url, params);
    expect(twilioSignatureValid(TOKEN, url, { ...params, Extra: "1" }, signature)).toBe(false);
  });

  it("rejects the right signature for the wrong URL", () => {
    expect(twilioSignatureValid(TOKEN, "https://x.test/other", params, sign(url, params))).toBe(false);
  });

  it("rejects a signature made with a different token", () => {
    expect(twilioSignatureValid(TOKEN, url, params, sign(url, params, "other-token"))).toBe(false);
  });

  it("refuses rather than throws when there is no signature or no token", () => {
    // Both are states a deployment passes through, and neither may be a
    // crash: a 500 here tells the caller the endpoint exists and is
    // interesting, where a 401 tells them nothing.
    expect(twilioSignatureValid(TOKEN, url, params, null)).toBe(false);
    expect(twilioSignatureValid("", url, params, sign(url, params))).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    // timingSafeEqual throws on a length mismatch, so the length check has
    // to come first. An attacker who can turn a guess into a 500 has a
    // much better oracle than one who gets a 401 either way.
    expect(() => twilioSignatureValid(TOKEN, url, params, "short")).not.toThrow();
    expect(twilioSignatureValid(TOKEN, url, params, "short")).toBe(false);
  });
});

describe("webhookUrl", () => {
  function request(url: string, headers: Record<string, string> = {}): Request {
    return new Request(url, { method: "POST", headers: new Headers(headers) });
  }

  it("prefers the configured URL over anything in the request", () => {
    const configured = "https://sms.qumo-app.com/api/sms/inbound";
    expect(webhookUrl(request("https://internal.invalid/api/sms/inbound"), configured)).toBe(configured);
  });

  it("ignores a configured value that is only whitespace", () => {
    expect(webhookUrl(request("https://x.test/api/sms/inbound"), "   ")).toBe("https://x.test/api/sms/inbound");
  });

  it("rebuilds the public URL from the proxy's headers", () => {
    // The case that breaks a correct implementation of the algorithm: the
    // request arrives on an internal host, and the signature was computed
    // over the public one.
    const url = webhookUrl(
      request("http://10.0.0.5/api/sms/inbound", {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "sms.qumo-app.com",
      }),
      undefined,
    );

    expect(url).toBe("https://sms.qumo-app.com/api/sms/inbound");
  });

  it("takes the first entry when a proxy chain appended its own", () => {
    const url = webhookUrl(
      request("http://10.0.0.5/api/sms/inbound", {
        "x-forwarded-proto": "https, http",
        "x-forwarded-host": "sms.qumo-app.com, internal.invalid",
      }),
      undefined,
    );

    expect(url).toBe("https://sms.qumo-app.com/api/sms/inbound");
  });

  it("keeps the query string, which Twilio signed along with the path", () => {
    const url = webhookUrl(request("https://x.test/api/sms/inbound?brand=copper-kettle"), undefined);
    expect(url).toBe("https://x.test/api/sms/inbound?brand=copper-kettle");
  });
});
