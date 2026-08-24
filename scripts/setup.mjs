#!/usr/bin/env node
/**
 * One command from a fresh clone to a running Qumo.
 *
 * Plain Node with nothing beyond the standard library and `pg`, which is
 * already a dependency — so it behaves the same on macOS, Linux and Windows
 * PowerShell. In particular it generates secrets with node:crypto rather than
 * openssl, which is the step most likely to stop a Windows reader dead.
 *
 * No colour codes: terminals disagree about them, and a setup script that
 * prints escape sequences at somebody is not a good first impression.
 *
 * Safe to run twice. It never overwrites an existing .env, and migrations and
 * the seed are both idempotent.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { userInfo } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");

const say = (msg) => console.log(msg);
const step = (n, msg) => console.log(`\n${n} ${msg}`);
const ok = (msg) => console.log(`   ok  ${msg}`);
const warn = (msg) => console.log(`   !   ${msg}`);

function die(msg, fix) {
  console.error(`\nStopped: ${msg}`);
  if (fix) console.error(`\n${fix}`);
  process.exit(1);
}

// ---------------------------------------------------------------- node

step("1/5", "Checking Node");
const major = Number(process.versions.node.split(".")[0]);
if (major < 22) {
  die(
    `Node ${process.versions.node} is too old — this needs 22 or newer.`,
    "Install the LTS build from https://nodejs.org and run this again.",
  );
}
ok(`Node ${process.versions.node}`);

// ---------------------------------------------------------------- database

step("2/5", "Looking for Postgres");

function readEnvValue(key) {
  if (!existsSync(envPath)) return null;
  const line = readFileSync(envPath, "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith(`${key}=`));
  if (!line) return null;
  const raw = line.slice(line.indexOf("=") + 1).trim();
  return raw.replace(/^["']|["']$/g, "") || null;
}

/**
 * Tried in order against the `postgres` maintenance database — which always
 * exists, unlike the one we are about to create. The list covers every way
 * the README tells somebody to install it: a Mac with Postgres.app or
 * Homebrew (your own username, no password), the Docker one-liner, and a
 * stock Linux install.
 */
function candidates() {
  const fromEnv = process.env.DATABASE_URL || readEnvValue("DATABASE_URL");
  const me = userInfo().username;
  return [
    fromEnv,
    `postgresql://${me}@localhost:5432/qumo_dev`,
    "postgresql://postgres:qumo@localhost:5432/qumo_dev",
    "postgresql://postgres:postgres@localhost:5432/qumo_dev",
    "postgresql://postgres@localhost:5432/qumo_dev",
  ].filter(Boolean);
}

const { Client } = await import("pg");

async function reachable(url) {
  let probe;
  try {
    probe = new URL(url);
  } catch {
    return false;
  }
  probe.pathname = "/postgres";
  const client = new Client({ connectionString: probe.toString(), connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    try {
      await client.end();
    } catch {
      /* already closed */
    }
    return false;
  }
}

let databaseUrl = null;
for (const url of candidates()) {
  if (await reachable(url)) {
    databaseUrl = url;
    break;
  }
}

if (!databaseUrl) {
  die(
    "Couldn't connect to Postgres on localhost:5432.",
    [
      "Start it, or install it, then run this again:",
      "",
      "  macOS      brew install postgresql@16 && brew services start postgresql@16",
      "             (or download Postgres.app from https://postgresapp.com)",
      "  Linux      sudo apt install postgresql && sudo systemctl start postgresql",
      "  Anywhere   docker run --name qumo-db -e POSTGRES_PASSWORD=qumo -p 5432:5432 -d postgres:16",
      "",
      "Already running somewhere else? Put its connection string in .env as",
      "DATABASE_URL and run this again.",
    ].join("\n"),
  );
}
ok(`Postgres reachable at ${databaseUrl.replace(/:[^:@/]*@/, ":****@")}`);

// ---------------------------------------------------------------- secrets

step("3/5", "Writing .env");

if (existsSync(envPath)) {
  // Never clobber. Somebody's real Twilio credentials or a database they care
  // about could be in there, and a setup script that eats those is worse than
  // one that does nothing.
  ok(".env already exists — left exactly as it is");
  const stale = ["AUTH_SECRET", "PHONE_HASH_SECRET", "ENCRYPTION_KEY"].filter((k) => {
    const v = readEnvValue(k);
    return !v || v.startsWith("replace-with");
  });
  if (stale.length > 0) {
    warn(`still on placeholder values: ${stale.join(", ")}`);
    warn("the app won't start until those are real — delete .env and re-run to generate them");
  }
} else {
  const b64 = () => randomBytes(32).toString("base64");
  const filled = readFileSync(path.join(root, ".env.example"), "utf8")
    .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${databaseUrl}"`)
    .replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET="${b64()}"`)
    .replace(/^PHONE_HASH_SECRET=.*$/m, `PHONE_HASH_SECRET="${b64()}"`)
    .replace(/^ENCRYPTION_KEY=.*$/m, `ENCRYPTION_KEY="${b64()}"`)
    .replace(/^CRON_SECRET=.*$/m, `CRON_SECRET="${randomBytes(32).toString("hex")}"`);
  writeFileSync(envPath, filled, { mode: 0o600 });
  ok("generated four secrets and pointed DATABASE_URL at the database above");
}

// ---------------------------------------------------------------- schema

step("4/5", "Creating the database and its tables");

const childEnv = { ...process.env, DATABASE_URL: databaseUrl };

try {
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: childEnv,
  });
  ok("schema applied");
} catch (err) {
  die("Migrations failed.", (err.stderr?.toString() || err.stdout?.toString() || err.message).trim());
}

step("5/5", "Adding demo data");
let seedOutput = "";
try {
  seedOutput = execFileSync("pnpm", ["exec", "tsx", "prisma/seed.ts"], {
    cwd: root,
    encoding: "utf8",
    env: childEnv,
  });
  ok("two brands, two stores, two promotions and one console login");
} catch (err) {
  die("Seeding failed.", (err.stderr?.toString() || err.message).trim());
}

// ---------------------------------------------------------------- done

say("\nReady. Start it with:\n");
say("   pnpm dev\n");
say("Then open these. Each brand is its own subdomain — that is the whole");
say("routing model, and *.localhost resolves to your own machine, so they");
say("need no setup:\n");

// The seed already prints every URL and the console password; echoing its
// output beats maintaining a second copy that drifts out of date.
for (const line of seedOutput.split("\n")) {
  if (line.includes("http://") || line.includes("@chicken-licken")) say(`   ${line.trim()}`);
}

say("\nSigning in as a shopper needs no SMS account: enter any South African");
say("mobile number and the passcode prints in the terminal running `pnpm dev`,");
say("on a line reading: sms (simulated) send\n");
