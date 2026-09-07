import { logger, redact } from "@/lib/security/logger";

/**
 * Where an unexpected failure goes.
 *
 * Until now it went nowhere. Handled refusals are logged and shown to
 * whoever caused them, but an actual bug — a throw nobody expected —
 * produced a Next.js error digest for the user and silence for us. A
 * platform holding other people's loyalty balances cannot find out about
 * its own outages from a brand's phone call.
 *
 * ── Two sinks, and why the first one is not optional ─────────────────────
 *
 * 1. **A structured line on stdout, always.** Vercel captures stdout,
 *    indexes it, and can drain it anywhere later. It needs no account, no
 *    key and no signup, so it works today — which matters, because the
 *    alternative to "works today" here is the current state of knowing
 *    nothing.
 *
 * 2. **A webhook, when one is configured.** `ERROR_WEBHOOK_URL` gets a POST
 *    per event. The body carries a `text` field first so a Slack incoming
 *    webhook renders it with no adapter, and the full event beside it for
 *    anything that wants structure. Unset, this half simply does not run.
 *
 * Sentry is the obvious third, and deliberately not here: it wants an
 * account and a DSN that do not exist yet, and a half-configured
 * integration is worse than an honest gap. When there is a DSN, it becomes
 * a third branch in this one function.
 *
 * ── Rules this function must never break ─────────────────────────────────
 *
 * **It cannot throw.** It runs on the failure path. A reporter that throws
 * turns one error into two and loses the first.
 *
 * **It cannot leak.** The event goes through the same redaction the logger
 * uses, because a webhook body leaves this machine — a stack frame quoting
 * a phone number would be a privacy incident caused by the privacy tooling.
 *
 * **It cannot depend on the database.** The throttle below counts in
 * process memory, unlike lib/security/rate-limit.ts which was deliberately
 * moved to Postgres. The reasoning is opposite because the job is opposite:
 * a rate limit must hold across instances or an attacker multiplies it, and
 * it is fine for it to fail when the database does. An error reporter is
 * most needed exactly when the database is unreachable, so it must not need
 * one to work. Per instance is the correct trade here, and the cost is that
 * an error hitting four instances can page four times.
 */

/** At most one webhook per fingerprint per window, per instance. */
const ALERT_WINDOW_MS = 5 * 60 * 1000;
const lastAlerted = new Map<string, number>();

/** Never let a slow endpoint hold a request path open. */
const WEBHOOK_TIMEOUT_MS = 3_000;

export type ErrorContext = {
  /** Where it happened, in words a person can act on. */
  where: string;
  /** Request path, route, or whatever else narrows it down. Redacted. */
  detail?: Record<string, unknown>;
};

type Described = { name: string; message: string; stack?: string };

function describe(err: unknown): Described {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  // A thrown string, a thrown object, a rejected promise carrying neither.
  // Rare, and exactly the kind of thing that would otherwise report as
  // "[object Object]" and waste an hour.
  return { name: "NonError", message: String(err) };
}

/**
 * A short stable id for "this same failure again", so a channel shows one
 * recurring problem rather than four hundred unrelated-looking lines.
 *
 * Name, message and the first stack frame — not the whole stack, because
 * two calls into the same broken function from different pages are the same
 * bug, and not the message alone, because two different bugs often share a
 * generic one. djb2 rather than a crypto hash: this is a grouping key, not
 * a secret, and it has to run in the Edge runtime too.
 */
export function fingerprint(err: unknown): string {
  const { name, message, stack } = describe(err);
  const frame = stack?.split("\n")[1]?.trim() ?? "";
  const input = `${name}|${message}|${frame}`;

  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function shouldAlert(id: string, now: number): boolean {
  const last = lastAlerted.get(id);
  if (last !== undefined && now - last < ALERT_WINDOW_MS) {
    return false;
  }
  lastAlerted.set(id, now);

  // The map is bounded by the number of distinct bugs in a window, which is
  // small — but "small" is an assumption about correct code, and this runs
  // on the path where that assumption has already failed once.
  if (lastAlerted.size > 500) {
    for (const [key, at] of lastAlerted) {
      if (now - at >= ALERT_WINDOW_MS) lastAlerted.delete(key);
    }
  }
  return true;
}

async function postToWebhook(url: string, text: string, event: unknown): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // `text` first and by that name so a Slack incoming webhook renders
      // it as-is. Anything else reads `event`.
      body: JSON.stringify({ text, event }),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
  } catch (err) {
    // Deliberately only a log line. If the alerting channel is down, the
    // stdout record is what remains, and turning a failed alert into a
    // thrown exception on the error path is how one outage becomes two.
    logger.warn("error reporter: webhook failed", { err: String(err) });
  }
}

/**
 * Report an unexpected failure. Safe to call from anywhere, including a
 * catch block on a request path.
 */
export async function reportError(err: unknown, context: ErrorContext, now: number = Date.now()): Promise<void> {
  try {
    const { name, message, stack } = describe(err);
    const id = fingerprint(err);

    const event = redact({
      id,
      where: context.where,
      name,
      message,
      // Trimmed: a full stack in a chat message is unreadable, and the
      // top frames are the ones that say where to look.
      stack: stack?.split("\n").slice(0, 8).join("\n"),
      detail: context.detail,
    });

    logger.error(`unhandled: ${context.where}`, event);

    const url = process.env.ERROR_WEBHOOK_URL;
    if (url && shouldAlert(id, now)) {
      await postToWebhook(url, `Qumo error [${id}] in ${context.where}: ${name}: ${message}`, event);
    }
  } catch (reporterFailure) {
    // The last line of defence. Nothing above should throw, and if it does
    // the original error still has to survive.
    try {
      console.error(JSON.stringify({ message: "error reporter itself failed", err: String(reporterFailure) }));
    } catch {
      // Nothing left to try, and nothing worth crashing a request over.
    }
  }
}

/** Test seam: the throttle is module state and a test needs a clean one. */
export function resetAlertThrottle(): void {
  lastAlerted.clear();
}
