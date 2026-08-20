import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Prisma 7 requires an explicit driver adapter — there's no implicit
// "just pass a URL" client anymore. One adapter instance, one pooled `pg`
// Pool, reused across requests; re-creating it per request would open a
// new connection pool every time, which is the classic way to exhaust
// Postgres's max_connections in serverless environments.
declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// In dev, Next.js hot-reloads modules but not the Node process, so without
// caching on `global` every file save would leak another connection pool.
export const prisma = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
