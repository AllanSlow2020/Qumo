// A thin wrapper around console.* that redacts known-sensitive keys before
// anything is written out. Logs end up in third-party log aggregators,
// error trackers, and CI output — none of which should ever see a phone
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

function redact(value: unknown, seen = new WeakSet<object>()): unknown {
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

  // CIOS forwarded every error here to Sentry. That is deliberately not
  // wired up yet: error monitoring is worth having and is four files of
  // configuration, and a first commit that claims to be a clean extraction
  // should not also be quietly carrying a half-configured integration.
  // Adding it is a small change, and this is the one place that changes.
}

export const logger = {
  info: (message: string, meta?: unknown) => log("info", message, meta),
  warn: (message: string, meta?: unknown) => log("warn", message, meta),
  error: (message: string, meta?: unknown) => log("error", message, meta),
};
