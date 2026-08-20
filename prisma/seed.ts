import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { encryptSecret } from "../lib/security/crypto";
import { buildReceiptUrl } from "../lib/stores/payload";

/**
 * A demo brand a shopper can actually earn against, so the app can be run
 * end to end before a brand console exists to configure one.
 *
 * `dotenv/config` first, and deliberately: tsx does not read .env on its
 * own, so without this DATABASE_URL is undefined here and the failure
 * arrives as an opaque database error rather than "you forgot the file".
 *
 * Idempotent — upserts on natural keys, so running it twice is harmless.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Weak on purpose, and only ever used here. Never reuse this in production. */
const SIGNING_SECRET = "dev-only-store-signing-secret-not-for-production-use";

async function main() {
  const brand = await prisma.brand.upsert({
    where: { slug: "chicken-licken" },
    update: {},
    create: { name: "Chicken Licken", slug: "chicken-licken" },
  });

  const campaign = await prisma.campaign.upsert({
    where: { id: "seed-campaign-5pc" },
    update: { status: "ACTIVE" },
    create: { id: "seed-campaign-5pc", brandId: brand.id, name: "5% back", status: "ACTIVE" },
  });

  await prisma.earnRule.upsert({
    where: { campaignId: campaign.id },
    update: {},
    create: {
      brandId: brand.id,
      campaignId: campaign.id,
      type: "PERCENT_OF_SPEND",
      unit: "CENTS",
      amount: 0,
      basisPoints: 500,
      // Ceilings set, not left null. A percent-of-spend campaign with no
      // ceiling is exactly what the forgery suite exists to stop, and a seed
      // that ships one teaches the wrong default to whoever copies it.
      maxPerPersonPerDay: 5_000,
      maxScansPerPersonPerDay: 5,
      maxTotalAmount: 500_000,
    },
  });

  // Two stores, because the difference between them is the most important
  // operational fact about this product: one has a point of sale that can
  // sign its slips and one does not.
  const signed = await prisma.store.upsert({
    where: { code: "CL-SANDTON-01" },
    update: {},
    create: {
      brandId: brand.id,
      name: "Sandton City",
      code: "CL-SANDTON-01",
      signingSecretEncrypted: encryptSecret(SIGNING_SECRET),
    },
  });
  const unsigned = await prisma.store.upsert({
    where: { code: "CL-ROSEBANK-02" },
    update: {},
    create: { brandId: brand.id, name: "Rosebank", code: "CL-ROSEBANK-02" },
  });

  const origin = "http://localhost:3000";
  const now = new Date();
  const stamp = Date.now();

  console.log("\nSeed complete. Scan one of these to earn:\n");
  for (const [label, store, secret] of [
    ["signed  ", signed, SIGNING_SECRET],
    ["unsigned", unsigned, null],
  ] as const) {
    const url = buildReceiptUrl(
      origin,
      {
        storeCode: store.code,
        externalTxnId: `seed-${label.trim()}-${stamp}`,
        amountCents: 12_000,
        purchasedAt: now,
      },
      secret,
    );
    console.log(`  ${label}  R120.00 →  ${url}`);
  }
  console.log("\n  Each is single-use. Re-run the seed for fresh ones.\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
