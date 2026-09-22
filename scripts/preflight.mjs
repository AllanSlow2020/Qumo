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

// ------------------------------------------------------- database reachable

/**
 * Whether the database answers, rather than whether a string that looks
 * like a connection is present.
 *
 * This is the check the rest of the file was written for and did not have.
 * DATABASE_URL passing the "is it set" test above says nothing about
 * whether anything is listening, and an unreachable database is invisible
 * at build time: Next compiles every page, the deployment goes green, and
 * then every single request renders a server error because resolving which
 * brand a host belongs to is a query. The failure arrives in front of
 * whoever opened the site first.
 *
 * Two passes, because they catch different mistakes and one of them needs
 * no network at all.
 */

/** Hosts that can never be right for a deployment, whatever is listening on them. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"]);

/** The connection variables a hosting provider's Postgres integration injects under its own names. */
const ALTERNATIVE_URL_VARS = ["POSTGRES_PRISMA_URL", "POSTGRES_URL", "DATABASE_POSTGRES_URL", "POSTGRES_URL_NON_POOLING"];

function parseDatabaseUrl(raw) {
  try {
    // The password is commonly a URL-encoded blob with characters that make
    // a naive split wrong, so this is parsed rather than pattern-matched.
    const url = new URL(raw);
    return { host: decodeURIComponent(url.hostname), port: url.port || "5432", search: url.search };
  } catch {
    return null;
  }
}

async function checkDatabase() {
  const raw = value("DATABASE_URL");
  if (!raw || isPlaceholder(raw)) return; // already failed above

  const parsed = parseDatabaseUrl(raw);
  if (!parsed) {
    fail("DATABASE_URL is not a URL that can be parsed.", "Expected postgresql://user:password@host:port/database");
    return;
  }

  // Pass one, free and offline. A connection string pointing at the machine
  // that built it is the single most common way this goes wrong, because it
  // is what a working local .env contains and copying it up feels like
  // configuration rather than a mistake.
  //
  // Only when this is a real deployment: on a laptop localhost is not a
  // mistake, it is the answer, and a check that cries wolf on every local
  // build is one people learn to scroll past.
  if (strict && LOCAL_HOSTS.has(parsed.host)) {
    const alternatives = ALTERNATIVE_URL_VARS.filter((name) => value(name));
    fail(
      `DATABASE_URL points at ${parsed.host}, which on a deployment means the machine serving the request.`,
      alternatives.length > 0
        ? `Nothing is listening there. This project also has ${alternatives.join(" and ")} set, which a Postgres integration adds under its own name - point DATABASE_URL at the same database.`
        : "Nothing is listening there. Use the connection string from your hosted database, not the local one.",
    );
    return;
  }

  // Pass two, the real thing. Imported dynamically and skipped if it cannot
  // be loaded, so this file keeps the property that it runs with nothing
  // installed - a check that crashes the build when it cannot run is worse
  // than no check.
  let Client;
  try {
    ({ Client } = (await import("pg")).default ?? (await import("pg")));
  } catch {
    warn("Could not load the pg driver, so the database was not actually contacted.", "Checked the connection string only.");
    return;
  }

  const client = new Client({ connectionString: raw, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();
    await client.query("select 1");
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    // Translated where the driver's own wording sends people the wrong way.
    // "no pg_hba.conf entry" in particular reads as a server misconfiguration
    // and is nearly always a missing sslmode from a host that requires TLS.
    const hint = /self.signed|SSL|sslmode|pg_hba/i.test(message)
      ? "The server appears to want TLS. Append ?sslmode=require to DATABASE_URL."
      : /timeout|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|ECONNREFUSED/i.test(message)
        ? `Nothing answered at ${parsed.host}:${parsed.port}. Check the host is right and that the database is not restricted to an IP allowlist, which cannot work from a platform with no fixed egress address.`
        : /password|authentication|role .* does not exist/i.test(message)
          ? "The host answered and refused the credentials. Check the user and password."
          : "";
    fail(`The database at ${parsed.host}:${parsed.port} could not be reached: ${message}`, hint || "The site would render a server error on every page.");
    return;
  } finally {
    await client.end().catch(() => {});
  }

  // Connected, but a direct connection string on a platform that runs one
  // function per request exhausts the server's connection limit under any
  // real traffic. Not fatal, because it works until it does not.
  if (process.env.VERCEL && /neon\.tech/i.test(parsed.host) && !/-pooler/.test(parsed.host)) {
    warn(
      "This looks like a direct Neon connection rather than the pooled one.",
      "Serverless opens a connection per request. Use the host with -pooler in it.",
    );
  }
  if (process.env.VERCEL && /supabase/i.test(parsed.host) && parsed.port !== "6543") {
    warn(
      "This looks like a direct Supabase connection rather than the pooled one.",
      "Serverless opens a connection per request. Use the pooler on port 6543.",
    );
  }
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

// Awaited here rather than at the top so every offline check has already
// run: when the database is unreachable *and* something else is missing,
// both are worth printing in one pass, since a deploy cycle is minutes.
await checkDatabase();

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
