/**
 * The dependency gate: fails the build on a high or critical advisory in
 * anything the running application loads.
 *
 * ── Why this is a script and not one line of YAML ────────────────────────
 *
 * `pnpm audit --prod --audit-level=high` is that one line, and it fails
 * today, on six advisories nothing in this repository can fix: they are in
 * the Prisma CLI and in PostCSS, which arrive as transitive dependencies of
 * `@prisma/client` and `next` and are not loaded by the deployed app at
 * all. `mysql2` is a MySQL driver in a Postgres application.
 *
 * A gate that is red on arrival gets switched off in a week, so the choice
 * is between lowering it to critical-only and writing the exceptions down.
 * Critical-only would have let through the Server Actions denial of service
 * that was the one live advisory when this was written, so: written down.
 *
 * ── What keeps the list honest ───────────────────────────────────────────
 *
 * Two things, and the second is the one that usually gets left out.
 *
 * An exception is keyed on the advisory ID, not the package, so a *new*
 * advisory in an already-excepted package still fails the build. Excepting
 * "mysql2" wholesale would mean never hearing about mysql2 again.
 *
 * And an exception that no longer matches anything is reported, because the
 * normal way a list like this rots is that the upstream fix lands, the
 * entry stays, and five releases later it is silently covering something
 * real. Non-fatal: a dependency upgrade should not fail CI for having
 * worked.
 */

import { execFileSync } from "node:child_process";

/**
 * Advisories accepted, with the reason each one is not reachable from the
 * deployed application. Reviewed whenever this gate reports a stale entry,
 * and worth re-reading whenever Prisma or Next changes how it packages its
 * CLI, since that is what put most of these here.
 */
const ACCEPTED = {
  "GHSA-ggr8-5vv4-36mx": {
    package: "deepmerge-ts",
    reason:
      "Reached only through prisma > @prisma/config, the CLI's config loader. Runs at migrate and generate time, never in a request.",
  },
  "GHSA-3f6p-5ww8-9rcr": {
    package: "mysql2",
    reason:
      "Prisma's CLI depends on every database driver it supports. This application is Postgres, so the MySQL driver is never loaded, let alone handed a connection.",
  },
  "GHSA-68fv-2mgg-jv7q": {
    package: "source-map-js",
    reason: "next > postcss, which runs at build. No request path reaches a CSS source map.",
  },
};

/**
 * fast-uri arrives under @prisma/dev, the local development server, through
 * ajv's schema validation. Several advisories, all the same reasoning, so
 * they are generated rather than copied five times.
 */
for (const id of [
  "GHSA-5jgf-p345-68v8",
  "GHSA-f65p-4m7j-42xc",
  "GHSA-fph4-wmhf-6fwf",
  "GHSA-jqff-g426-hqxp",
  "GHSA-qw65-cvwx-89v3",
]) {
  ACCEPTED[id] = {
    package: "fast-uri",
    reason:
      "Reached only through @prisma/dev > @prisma/streams-local > ajv, the local development server. Not installed in the deployed runtime.",
  };
}

const BLOCKING = new Set(["high", "critical"]);

/**
 * `pnpm audit` exits non-zero whenever it finds anything, which is most of
 * the time, so the exit code cannot be the signal here - the parsed output
 * is. stdout is still captured on a non-zero exit.
 */
function runAudit() {
  try {
    return execFileSync("pnpm", ["audit", "--prod", "--json"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    if (typeof error.stdout === "string" && error.stdout.trim()) return error.stdout;
    throw error;
  }
}

const raw = runAudit();

let advisories;
try {
  advisories = Object.values(JSON.parse(raw).advisories ?? {});
} catch {
  // A gate that cannot read its input must fail. Parsing silently to an
  // empty list would turn every future advisory into a pass.
  console.error("audit: could not parse `pnpm audit --prod --json` output.");
  console.error(raw.slice(0, 2000));
  process.exit(1);
}

const blocking = [];
const accepted = [];

for (const advisory of advisories) {
  if (!BLOCKING.has(advisory.severity)) continue;

  const id = advisory.github_advisory_id;
  const exception = ACCEPTED[id];
  (exception ? accepted : blocking).push({ advisory, id, exception });
}

const seen = new Set(accepted.map((entry) => entry.id));
const stale = Object.keys(ACCEPTED).filter((id) => !seen.has(id));

console.log("\nDependency audit (production dependencies, high and critical)\n");

for (const { advisory, id, exception } of accepted) {
  console.log(`   -   ${advisory.severity} ${advisory.module_name} (${id}) accepted`);
  console.log(`     ${exception.reason}`);
}

if (stale.length > 0) {
  console.log("");
  for (const id of stale) {
    console.log(`   ?   ${id} (${ACCEPTED[id].package}) is no longer reported, so the exception can go.`);
  }
}

if (blocking.length === 0) {
  console.log(`\n   Nothing blocking. ${accepted.length} accepted, ${stale.length} stale.\n`);
  process.exit(0);
}

console.log("");
for (const { advisory } of blocking) {
  console.error(`   x   ${advisory.severity} ${advisory.module_name}: ${advisory.title}`);
  console.error(`     vulnerable ${advisory.vulnerable_versions}, patched ${advisory.patched_versions}`);
  console.error(`     ${advisory.url}`);
  const path = advisory.findings?.[0]?.paths?.[0];
  if (path) console.error(`     via ${path}`);
}

console.error(
  [
    "",
    `   ${blocking.length} advisory/advisories in production dependencies need a decision.`,
    "",
    "   Upgrade if there is a patched version in range. If it genuinely cannot",
    "   reach the deployed application, add it to ACCEPTED in scripts/audit.mjs",
    "   with the reason, which is then reviewed rather than forgotten.",
    "",
  ].join("\n"),
);

process.exit(1);
