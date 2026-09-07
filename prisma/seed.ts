import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { encryptSecret } from "../lib/security/crypto";
import { buildReceiptUrl } from "../lib/stores/payload";
import { hashPassword } from "../lib/staff/password";

/**
 * A demo brand a shopper can actually earn against, so the app can be run
 * end to end before a brand console exists to configure one.
 *
 * `dotenv/config` first, and deliberately: tsx does not read .env on its
 * own, so without this DATABASE_URL is undefined here and the failure
 * arrives as an opaque database error rather than "you forgot the file".
 *
 * Idempotent - upserts on natural keys, so running it twice is harmless.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Weak on purpose, and only ever used here. Never reuse this in production. */
const SIGNING_SECRET = "dev-only-store-signing-secret-not-for-production-use";

/**
 * The identity a shopper sees. Two brands rather than one, because the whole
 * claim of Phase D is "same mechanic, different brands, all we do is
 * reskin", and a seed with one brand in it proves nothing about that.
 *
 * The slug is the subdomain: chicken-licken.localhost:3000 and
 * campari.localhost:3000 both work with no hosts-file editing, because
 * *.localhost resolves to 127.0.0.1 in every current browser.
 *
 * Colours are approximations chosen for contrast, not the brands' actual
 * palettes - nothing here is licensed artwork and no logo is fetched.
 */
const BRANDS = [
  {
    slug: "chicken-licken",
    name: "Chicken Licken",
    displayName: null,
    tagline: "Soul food rewards",
    accentColor: "#c8102e",
    accentInkColor: "#ffffff",
    supportEmail: "rewards@example.invalid",
  },
  {
    slug: "campari",
    name: "Campari",
    displayName: null,
    tagline: "Red Passion rewards",
    accentColor: "#1b2a4a",
    accentInkColor: "#ffffff",
    supportEmail: "rewards@example.invalid",
  },
] as const;

async function main() {
  const identity = BRANDS[0];
  const brand = await prisma.brand.upsert({
    where: { slug: identity.slug },
    // Updated on every run, unlike the rest of this seed: theming is the
    // thing being iterated on, and a developer changing a colour here wants
    // to see it, not to be told the row already exists.
    update: { ...identity },
    create: { ...identity },
  });

  // The second brand exists to be switched to. It carries no campaign and no
  // stores - its job is to prove that one deployment serves two identities,
  // and that a shopper signed in at one is not signed in at the other.
  const second = BRANDS[1];
  await prisma.brand.upsert({ where: { slug: second.slug }, update: { ...second }, create: { ...second } });

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

  // A second promotion, because pack codes cannot be printed against the
  // first one. A share-of-spend rule takes its cut from a till slip, and a
  // code on a bottle carries no basket - so a brand needs a fixed-per-scan
  // promotion before it can print anything, and a seed that omits one makes
  // the whole pack path untestable out of the box.
  const stampCampaign = await prisma.campaign.upsert({
    where: { id: "seed-campaign-stamps" },
    update: { status: "ACTIVE" },
    create: {
      id: "seed-campaign-stamps",
      brandId: brand.id,
      name: "Wing box stamp card",
      status: "ACTIVE",
    },
  });
  await prisma.earnRule.upsert({
    where: { campaignId: stampCampaign.id },
    update: {},
    create: {
      brandId: brand.id,
      campaignId: stampCampaign.id,
      type: "FLAT_PER_SCAN",
      unit: "STAMPS",
      amount: 1,
      completesAt: 10,
      maxScansPerPersonPerDay: 3,
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

  // The brand's own host, not the apex. A slip URL that pointed at
  // localhost:3000 would land on the no-brand page, which is exactly the
  // failure this seed should not be teaching people to expect.
  // Somebody to sign into the console with. Weak on purpose and only ever
  // here - the seed prints it, which is exactly what should never happen
  // with a real credential.
  const staffPassword = "qumo-dev-password";
  await prisma.user.upsert({
    where: { email: "owner@chicken-licken.example" },
    update: { passwordHash: await hashPassword(staffPassword), isActive: true },
    create: {
      brandId: brand.id,
      email: "owner@chicken-licken.example",
      name: "Thandi Mokoena",
      role: "OWNER",
      passwordHash: await hashPassword(staffPassword),
    },
  });

  const origin = `http://${brand.slug}.localhost:3000`;
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
  console.log("\n  Each is single-use. Re-run the seed for fresh ones.");
  console.log(`\n  The other brand, for comparing the skin: http://${second.slug}.localhost:3000/wallet`);
  console.log("  The apex, which names no brand:            http://localhost:3000/wallet");
  console.log(`\n  Poster / tag (joins, never awards):  ${origin}/join`);
  console.log("\n  Brand console:  http://app.localhost:3000");
  console.log(`    owner@chicken-licken.example / ${staffPassword}\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
