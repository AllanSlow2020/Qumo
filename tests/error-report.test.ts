import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fingerprint, reportError, resetAlertThrottle } from "@/lib/observability/report";

/**
 * The reporter runs on the failure path, which is the one place a bug is
 * least affordable: anything it does wrong either loses the original error
 * or turns one into two. So most of what is asserted here is what it must
 * *not* do.
 */

let posted: { url: string; body: unknown }[] = [];
let logged: { level: string; message: string; meta?: unknown }[] = [];

beforeEach(() => {
  posted = [];
  logged = [];
  resetAlertThrottle();
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    logged.push({ level: "error", ...JSON.parse(line) });
  });
  vi.spyOn(console, "warn").mockImplementation((line: string) => {
    logged.push({ level: "warn", ...JSON.parse(line) });
  });
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    posted.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(null, { status: 200 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("fingerprint", () => {
  it("groups the same failure together", () => {
    const one = new Error("database unreachable");
    const two = new Error("database unreachable");
    two.stack = one.stack;
    expect(fingerprint(one)).toBe(fingerprint(two));
  });

  it("separates different failures", () => {
    expect(fingerprint(new Error("a"))).not.toBe(fingerprint(new Error("b")));
  });

  it("is stable and short enough to read out loud", () => {
    expect(fingerprint(new Error("x"))).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("reportError", () => {
  it("always writes a log line, with no webhook configured", async () => {
    await reportError(new Error("boom"), { where: "GET /wallet" });
    expect(logged).toHaveLength(1);
    expect(logged[0]!.message).toBe("unhandled: GET /wallet");
    expect(posted).toHaveLength(0);
  });

  it("posts to the webhook when one is configured", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/abc");
    await reportError(new Error("boom"), { where: "GET /wallet" });

    expect(posted).toHaveLength(1);
    expect(posted[0]!.url).toBe("https://hooks.example/abc");
    // `text` by that name so Slack renders it without an adapter.
    expect(String((posted[0]!.body as { text: string }).text)).toContain("boom");
  });

  /**
   * The rule that matters most. A webhook body leaves this machine, so a
   * stack frame or a context field quoting a phone number would be a
   * privacy incident caused by the privacy tooling.
   */
  it("redacts sensitive fields before anything leaves the machine", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/abc");
    await reportError(new Error("boom"), {
      where: "POST /wallet/login",
      detail: { phone: "+27821234567", cookie: "qumo_shopper=abc", route: "/wallet/login" },
    });

    const body = JSON.stringify(posted[0]!.body);
    expect(body).not.toContain("+27821234567");
    expect(body).not.toContain("qumo_shopper=abc");
    // Non-sensitive context survives, or the report would be useless.
    expect(body).toContain("/wallet/login");
  });

  it("alerts once per fingerprint per window, however many times it happens", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/abc");
    const err = new Error("the same bug");
    const at = Date.now();

    for (let i = 0; i < 50; i += 1) {
      await reportError(err, { where: "GET /wallet" }, at + i);
    }

    // One alert, fifty log lines: the channel stays readable and the
    // record stays complete.
    expect(posted).toHaveLength(1);
    expect(logged.filter((l) => l.message.startsWith("unhandled:"))).toHaveLength(50);
  });

  it("alerts again once the window has passed", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/abc");
    const err = new Error("the same bug");
    const at = Date.now();

    await reportError(err, { where: "GET /wallet" }, at);
    await reportError(err, { where: "GET /wallet" }, at + 5 * 60 * 1000 + 1);
    expect(posted).toHaveLength(2);
  });

  it("still alerts for a different failure inside the same window", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/abc");
    const at = Date.now();
    await reportError(new Error("one"), { where: "GET /wallet" }, at);
    await reportError(new Error("two"), { where: "GET /wallet" }, at + 1);
    expect(posted).toHaveLength(2);
  });

  /**
   * If the alerting channel is down, the stdout record is what remains.
   * Turning a failed alert into a thrown exception is how one outage
   * becomes two.
   */
  it("survives a webhook that fails", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/abc");
    vi.stubGlobal("fetch", async () => {
      throw new Error("connection refused");
    });

    await expect(reportError(new Error("boom"), { where: "GET /wallet" })).resolves.toBeUndefined();
    expect(logged.some((l) => l.message.startsWith("unhandled:"))).toBe(true);
    expect(logged.some((l) => l.message.includes("webhook failed"))).toBe(true);
  });

  it("handles something thrown that is not an Error", async () => {
    // A thrown string or object would otherwise report as "[object Object]"
    // and waste an hour of somebody's evening.
    await reportError({ nope: true }, { where: "GET /wallet" });
    await reportError("just a string", { where: "GET /wallet" });
    expect(logged).toHaveLength(2);
    expect(JSON.stringify(logged[1])).toContain("just a string");
  });
});
