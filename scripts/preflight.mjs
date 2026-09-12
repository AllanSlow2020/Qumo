#!/usr/bin/env node
/**
 * What has to be true before a build is worth deploying.
 *
 * Every check here is for a mistake that produces a *running* site rather
 * than a failed one, which is why they are worth catching at build time and
 * not at request time. A missing encryption key does not break the home
 * page; it breaks the first shopper who tries to sign in, an hour later, in
 * front of somebody. A root domain left on "localhost" builds and deploys
 * perfectly and then answers every single request with "this link needs a
 * brand", because the host names no brand and nothing else decides which
 * brand a shopper is looking at.
 *
 * Strict only where it can tell it is building for real - on Vercel, or
 * when asked. `next build` sets NODE_ENV=production even for a local build,
 * so keying on that would fail every `pnpm build` on a laptop, and a check
 * people learn to work around is worse than no check.
 *
 * Plain Node and no dependencies, like scripts/setup.mjs, and no colour
 * codes for the same reason.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";


const strict = Boolean(process.env.VERCEL) || process.env.QUMO_PREFLIGHT === "strict";

/**
 * Loads .env, if there is one, without overwriting anything already set.
 *
 * Next loads .env itself, but this runs before Next does - so without this
 * a local `pnpm build` reports every secret missing, which is both wrong
 * and the fastest way to teach somebody to ignore the output. A host that
 * supplies real environment variables always wins: nothing here overwrites
 * a value that is already there, which is what makes it safe on Vercel,
 * where there is no file and shouldn't be.
 *
 * Hand-parsed rather than pulling in dotenv, like scripts/setup.mjs: this
 * has to run before `pnpm install` has necessarily done anything useful.
 */
function loadEnvFile() {
  const file = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, name, raw] = match;
    if (process.env[name] !== undefined) continue;
    process.env[name] = raw.trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvFile();

const problems = [];
const warnings = [];

const fail = (what, why) => problems.push(`${what}\n     ${why}`);
const warn = (what, why) => warnings.push(`${what}\n     ${why}`);

const value = (name) => {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
};

/** True for the strings .env.example ships, which are worse than empty: they are the right shape. */
const isPlaceholder = (v) => /^replace-with-/.test(v);

// ------------------------------------------------------------- required

for (const name of ["DATABASE_URL", "AUTH_SECRET", "PHONE_HASH_SECRET", "ENCRYPTION_KEY"]) {
  const v = value(name);
  if (!v) {
    fail(`${name} is not set.`, "The build will succeed and the site will fail on first use.");
  } else if (isPlaceholder(v)) {
    fail(`${name} is still the placeholder from .env.example.`, "Generate a real one: openssl rand -base64 32");
  }
}

// AES-256 needs exactly 32 bytes of key. A 31- or 33-byte key throws inside
// node:crypto at the moment a phone number is encrypted, which is to say at
// the moment somebody signs up.
const key = value("ENCRYPTION_KEY");
if (key && !isPlaceholder(key)) {
  const bytes = Buffer.from(key, "base64").length;
  if (bytes !== 32) {
    fail(
      `ENCRYPTION_KEY decodes to ${bytes} bytes, and AES-256 needs exactly 32.`,
      "Generate one: openssl rand -base64 32",
    );
  }
}

// The most load-bearing string in the file, and the only one whose default
// is wrong rather than absent.
const root = value("NEXT_PUBLIC_QUMO_ROOT_DOMAIN");
if (!root) {
  fail(
    "NEXT_PUBLIC_QUMO_ROOT_DOMAIN is not set, so it defaults to localhost.",
    "Every request would land on the no-brand page. Set it to the apex you serve brands under, before the build - it is compiled in.",
  );
} else if (root === "localhost" || root.endsWith(".localhost")) {
  fail(
    `NEXT_PUBLIC_QUMO_ROOT_DOMAIN is "${root}", which is a development value.`,
    "A deployed site with this set answers every request with the no-brand page.",
  );
} else if (root.includes("://") || root.includes("/")) {
  fail(`NEXT_PUBLIC_QUMO_ROOT_DOMAIN is "${root}", which looks like a URL.`, "It is a bare hostname: qumo.co.za");
}

// -------------------------------------------------------------- warnings

if (!value("CRON_SECRET")) {
  warn(
    "CRON_SECRET is not set, so the nightly sweep will 401 and delete nothing.",
    "Expired shopper sessions and rate-limit rows accumulate. Safe, but it is a job silently not running.",
  );
}

// Mirrors resolveTwilioCredentials() in lib/sms/client.ts. Kept as its own
// few lines rather than imported because this file is plain Node with no
// build step and runs before anything is compiled; the cost of the
// duplication is that the two can drift, and tests/sms-client.test.ts owns
// the real rules.
const smsAccount = value("TWILIO_ACCOUNT_SID");
const smsFrom = value("TWILIO_FROM_NUMBER");
const smsKeySid = value("TWILIO_API_KEY_SID");
const smsKeySecret = value("TWILIO_API_KEY_SECRET");
const smsAuthToken = value("TWILIO_AUTH_TOKEN");
const smsKeyComplete = Boolean(smsKeySid && smsKeySecret);
const smsCanSend = Boolean(smsAccount && smsFrom && (smsKeyComplete || (!smsKeySid && !smsKeySecret && smsAuthToken)));

if (!smsCanSend) {
  // Told apart deliberately. Nothing set is a state somebody chose and
  // knows about. Something set that still cannot send is the failure this
  // whole file exists for: the site builds, deploys, accepts a phone
  // number, says a code is on its way, and no handset ever rings.
  if (smsAccount || smsFrom || smsKeySid || smsKeySecret || smsAuthToken) {
    warn(
      "Twilio is half configured, so passcodes are STILL only written to the deployment log.",
      smsKeySid && !smsKeySecret
        ? "TWILIO_API_KEY_SID is set without TWILIO_API_KEY_SECRET. Twilio shows the secret once, at creation - if it is gone, make a new key."
        : smsKeySecret && !smsKeySid
          ? "TWILIO_API_KEY_SECRET is set without TWILIO_API_KEY_SID."
          : "Needs TWILIO_ACCOUNT_SID, TWILIO_FROM_NUMBER, and either the API key pair or TWILIO_AUTH_TOKEN.",
    );
  } else {
    warn(
      "No SMS account, so sign-in passcodes are written to the deployment log.",
      "Fine for a demo with numbers you own. Not fine once a real shopper signs in: anyone who can read the logs can sign in as them.",
    );
  }
} else if (!smsKeyComplete) {
  warn(
    "SMS sends on the account auth token, which is the master credential for the whole Twilio account.",
    "It can buy numbers, spend money and read every message ever sent, and it cannot be scoped or rotated on its own. Create a restricted API key and set TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET instead.",
  );
}

// Not a mistake - it is a thing somebody switched on - but it is the one
// setting here that makes the front door wider, so it says so on every
// single build until it goes.
if (value("DEMO_LOGIN_PHONES") && value("DEMO_LOGIN_CODE")) {
  if (smsCanSend) {
    // The reason this existed has gone. Said as its own warning rather
    // than a softer clause on the old one, because "remove it eventually"
    // is what every permanent workaround was told once.
    warn(
      "Demo login is ON and there is now a working SMS account, so it is pure attack surface.",
      "The numbers in DEMO_LOGIN_PHONES sign in with DEMO_LOGIN_CODE and never receive a passcode. It existed only while nothing could send one. Clear both.",
    );
  } else {
    warn(
      "Demo login is ON: the numbers in DEMO_LOGIN_PHONES can sign in with DEMO_LOGIN_CODE, no SMS needed.",
      "Fine while there is no SMS account and the listed numbers are yours. Remove both the day one is connected.",
    );
  }
}

if (!value("ERROR_WEBHOOK_URL")) {
  warn(
    "ERROR_WEBHOOK_URL is not set.",
    "Errors are still written to stdout, which Vercel keeps - nothing is lost, but nothing tells you either.",
  );
}

// --------------------------------------------------------------- report

const label = strict ? "Preflight" : "Preflight (advisory - not a real deployment)";
console.log(`\n${label}`);

for (const w of warnings) console.log(`   !   ${w}`);
for (const p of problems) console.log(`   x   ${p}`);

if (problems.length === 0) {
  console.log(`   ok  ${warnings.length > 0 ? "nothing fatal" : "everything set"}\n`);
  process.exit(0);
}

if (!strict) {
  console.log("\n   Not failing the build: this looks like a local build.");
  console.log("   Run QUMO_PREFLIGHT=strict pnpm build to check it the way a deployment would.\n");
  process.exit(0);
}

console.log(`\nStopped: ${problems.length} thing${problems.length === 1 ? "" : "s"} would deploy broken.`);
console.log("Set them in the project's environment variables and deploy again.\n");
process.exit(1);
