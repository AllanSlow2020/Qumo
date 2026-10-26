import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Migrations do not run on the pooled connection, when there is a choice.
 *
 * `prisma migrate deploy` takes a session-level advisory lock before it
 * touches anything, so that two deploys landing together cannot apply the
 * same migration twice. A transaction-mode pooler does not promise you the
 * same backend for the next statement, so the session holding that lock and
 * the session waiting on it can be different connections, and the wait ends
 * at the 10s timeout with P1002 - "the database server was reached but
 * timed out". It is intermittent by nature: it depends on which backend the
 * pooler hands out, so it passes for three deploys and fails on the fourth.
 *
 * DIRECT_DATABASE_URL is the same database without the pooler. On Neon that
 * is the host without `-pooler` in it. It is used only by the CLI, for
 * migrations: the application keeps the pooled URL, which is what it wants,
 * because serverless functions open far more connections than Postgres will
 * hold.
 *
 * Unset is allowed and falls back to the pooled URL, so a fresh checkout
 * with one connection string still runs. It is the deployment that needs
 * both, and scripts/preflight.mjs refuses to build without it when the
 * pooled host is in use.
 *
 * ── Why this is `url` and not `directUrl` ────────────────────────────────
 *
 * Prisma 7 removed `directUrl`. Every answer written before v7 - and some
 * written after - puts the direct connection in a `directUrl` property,
 * and in v7 that property is simply ignored: migrations carry on using
 * `url`, the advisory lock goes back through the pooler, and the deploy
 * fails exactly as it did before the fix. It was ignored here first.
 *
 * This file configures the Prisma CLI and nothing else. The application
 * builds its own adapter from DATABASE_URL in lib/db/client.ts and never
 * reads this, so pointing `url` at the direct connection moves migrations
 * off the pooler without touching how the app connects.
 */
const direct = process.env.DIRECT_DATABASE_URL?.trim();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: {
    url: direct ? direct : env("DATABASE_URL"),
  },
});
