import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCsp, generateNonce, REPORT_PATH } from "@/lib/security/csp";

afterEach(() => {
  vi.unstubAllEnvs();
});

function production(nonce = "TESTNONCE", secure = true): string {
  vi.stubEnv("NODE_ENV", "production");
  return buildCsp(nonce, secure);
}

function directive(csp: string, name: string): string {
  const found = csp.split("; ").find((d) => d === name || d.startsWith(`${name} `));
  return found ?? "";
}

describe("generateNonce", () => {
  it("is unpredictable", () => {
    const seen = new Set(Array.from({ length: 200 }, generateNonce));
    expect(seen.size).toBe(200);
  });

  it("carries 128 bits", () => {
    // 16 bytes, base64 - anything shorter would be guessable, and a
    // guessable nonce is the same as no policy at all.
    expect(atob(generateNonce())).toHaveLength(16);
  });
});

describe("the production policy", () => {
  /**
   * The assertion the whole change exists for. A policy that allows inline
   * script stops almost nothing, because making an injected <script> inert
   * is the entire job. This app has no inline scripts, so there is no
   * excuse for the allowance - and this test is what stops one being added
   * back for a quick fix.
   */
  it("never allows inline or eval'd script", () => {
    const script = directive(production(), "script-src");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it("admits scripts only by nonce", () => {
    expect(directive(production("abc123"), "script-src")).toContain("'nonce-abc123'");
    expect(directive(production("abc123"), "script-src")).toContain("'strict-dynamic'");
  });

  it("refuses to be framed, and to have its base rewritten", () => {
    const csp = production();
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'none'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
  });

  it("keeps form submissions on our own origin", () => {
    // A form that could post elsewhere is one of the quieter ways a session
    // cookie or a phone number leaves the building.
    expect(directive(production(), "form-action")).toBe("form-action 'self'");
  });

  it("denies by default", () => {
    expect(directive(production(), "default-src")).toBe("default-src 'self'");
  });

  it("allows images from any https host, because brand logos live on brand CDNs", () => {
    expect(directive(production(), "img-src")).toBe("img-src 'self' https: data:");
  });

  it("does not reach off-origin for fonts, because next/font self-hosts", () => {
    expect(directive(production(), "font-src")).toBe("font-src 'self'");
  });
});

describe("upgrade-insecure-requests", () => {
  it("is set on a request that arrived over https", () => {
    expect(production("n", true)).toContain("upgrade-insecure-requests");
  });

  /**
   * Found by driving a production build locally, not by reading the spec.
   * The directive upgrades same-origin *navigations* as well as
   * subresources, so on an http origin every link and form submission is
   * rewritten to an https port nothing is listening on - which breaks the
   * one way this build gets shown to anyone before it is deployed.
   */
  it("is absent on a request that arrived over http", () => {
    expect(production("n", false)).not.toContain("upgrade-insecure-requests");
  });
});

describe("the development policy", () => {
  it("loosens script only where the dev server needs it", () => {
    vi.stubEnv("NODE_ENV", "development");
    const csp = buildCsp("n", false);
    // Turbopack compiles with eval and injects its own inline scripts.
    expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
    // Hot reload talks over a websocket.
    expect(directive(csp, "connect-src")).toContain("ws:");
    // Everything else holds, so dev is not a different policy shape.
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
  });
});

describe("violation reporting", () => {
  /**
   * The regression guard for a finding that cost an afternoon.
   *
   * Sending both spellings is the obvious, careful-looking thing to do -
   * report-uri for older browsers, report-to for newer ones. It delivers
   * nothing. Chrome ignores report-uri whenever report-to is present, and
   * the report-to path then failed silently, so every violation vanished
   * while the policy looked correctly configured.
   *
   * Proven by removing report-to and watching the same blocked inline
   * script arrive at the endpoint immediately.
   */
  it("names exactly one reporting mechanism", () => {
    const csp = production();
    expect(csp).toContain(`report-uri ${REPORT_PATH}`);
    expect(csp).not.toContain("report-to");
  });

  it("reports to a relative path, so every brand subdomain reports to itself", () => {
    expect(REPORT_PATH.startsWith("/")).toBe(true);
    expect(REPORT_PATH).not.toContain("://");
  });
});
