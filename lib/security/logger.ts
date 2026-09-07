// A thin wrapper around console.* that redacts known-sensitive keys before
// anything is written out. Logs end up in third-party log aggregators,
// error trackers, and CI output - none of which should ever see a phone
// number, password, or password hash, even accidentally via a stray
// `console.log(user)` during debugging.

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "phone",
  "phoneHash",
  "phoneEncrypted",
  "authorization",
  "cookie",
  "token",
  "tokenHash",
]);

const REDACTED = "[redacted]";

/**
 * Exported because anything that ships an object off this machine - the
 * error reporter's webhook, for one - has to strip the same keys the log
 * line does. One list, one function, so a key added here is stripped
 * everywhere rather than in whichever place someone remembered.
 */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen));
  }
  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEYS.has(k) ? REDACTED : redact(v, seen),
      ]),
    );
  }
  return value;
}

function log(level: "info" | "warn" | "error", message: string, meta?: unknown) {
  const redactedMeta = meta === undefined ? undefined : redact(meta);
  const entry = redactedMeta === undefined ? { message } : { message, meta: redactedMeta };
  console[level](JSON.stringify(entry));

  // This stays a pure writer. Forwarding errors somebody will actually see
  // is lib/observability/report.ts, which calls this for the log line and
  // then decides separately whether the event is worth waking anyone for.
  // Keeping the two apart means a failure in the reporter cannot swallow
  // the log entry, which is the record of last resort.
}

export const logger = {
  info: (message: string, meta?: unknown) => log("info", message, meta),
  warn: (message: string, meta?: unknown) => log("warn", message, meta),
  error: (message: string, meta?: unknown) => log("error", message, meta),
};
