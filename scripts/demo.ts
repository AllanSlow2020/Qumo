import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes, randomUUID } from "node:crypto";
import { encryptSecret, encryptPhone, hashPhone } from "../lib/security/crypto";
import { hashPassword } from "../lib/staff/password";
import { generatePackCode } from "../lib/packs/code";

/**
 * A Chicken Licken worth showing someone.
 *
 * `prisma/seed.ts` makes the smallest database the app will run against —
 * two brands, a couple of stores, enough to boot. This makes one that looks
 * like a business: five Cape Town stores, a few hundred members, three
 * months of uneven activity, a stamp card partway through and a printed
 * batch of codes waiting to be scanned.
 *
 * Deliberately uneven, because the even version is a lie. Real programmes
 * have one store carrying half the volume, a long tail of people who came
 * once, and a small core who come every week — and those are exactly the
 * shapes the performance screen exists to show. Seeding a smooth
 * distribution would produce a demo where every chart says "fine".
 *
 * Safe to run repeatedly: it clears its own demo rows first, and it will
 * not touch a database whose brand does not look like the seeded one.
 */

const DAY = 86_400_000;
const STORES = [
  { name: "Sea Point", code: "CPT-001", signed: true, weight: 0.44 },
  { name: "Claremont", code: "CPT-002", signed: true, weight: 0.23 },
  { name: "Rondebosch", code: "CPT-003", signed: true, weight: 0.16 },
  { name: "Gardens", code: "CPT-004", signed: true, weight: 0.12 },
  // One store the point of sale has not been updated at, because there is
  // always one, and it is what the exposure warning is for.
  { name: "Woodstock", code: "CPT-005", signed: false, weight: 0.05 },
];

const MEMBERS = 280;
const HISTORY_DAYS = 84;

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

/** Busier on Fridays and Saturdays, quieter on Mondays. A flat week is a
 *  giveaway that the data is invented. */
function dayWeight(date: Date): number {
  return [0.7, 0.6, 0.75, 0.85, 1.0, 1.4, 1.2][date.getDay()] ?? 1;
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  const brand = await prisma.brand.findUnique({ where: { slug: "chicken-licken" } });
  if (!brand) {
    throw new Error("No chicken-licken brand. Run `pnpm db:seed` first.");
  }

  console.log("clearing previous demo data…");
  await prisma.pointsTransaction.deleteMany({ where: { brandId: brand.id } });
  await prisma.purchaseScan.deleteMany({ where: { brandId: brand.id } });
  await prisma.coupon.deleteMany({ where: { brandId: brand.id } });
  await prisma.packCode.deleteMany({ where: { brandId: brand.id } });
  await prisma.packBatch.deleteMany({ where: { brandId: brand.id } });
  await prisma.brandMembership.deleteMany({ where: { brandId: brand.id } });

  await prisma.brand.update({
    where: { id: brand.id },
    data: {
      displayName: "Chicken Licken",
      tagline: "Soul food rewards",
      accentColor: "#c8102e",
      accentInkColor: "#ffffff",
      supportEmail: "rewards@chickenlicken.example",
    },
  });

  console.log("stores…");
  const stores = [];
  for (const s of STORES) {
    stores.push(
      await prisma.store.upsert({
        where: { code: s.code },
        update: {
          brandId: brand.id,
          name: s.name,
          isActive: true,
          signingSecretEncrypted: s.signed ? encryptSecret(randomBytes(32).toString("hex")) : null,
        },
        create: {
          brandId: brand.id,
          name: s.name,
          code: s.code,
          signingSecretEncrypted: s.signed ? encryptSecret(randomBytes(32).toString("hex")) : null,
        },
      }),
    );
  }
  // Anything left over from an earlier run or an earlier test.
  await prisma.store.deleteMany({
    where: { brandId: brand.id, code: { notIn: STORES.map((s) => s.code) } },
  });

  console.log("promotions…");
  const cashback = await prisma.campaign.upsert({
    where: { id: (await prisma.campaign.findFirst({ where: { brandId: brand.id, name: "5% back" } }))?.id ?? "new" },
    update: { status: "ACTIVE" },
    create: { brandId: brand.id, name: "5% back", description: "Five percent of every basket", status: "ACTIVE" },
  });
  await prisma.earnRule.upsert({
    where: { campaignId: cashback.id },
    update: { maxTotalAmount: 1_500_000, maxPerPersonPerDay: 5_000, maxScansPerPersonPerDay: 3 },
    create: {
      brandId: brand.id,
      campaignId: cashback.id,
      type: "PERCENT_OF_SPEND",
      unit: "CENTS",
      amount: 0,
      basisPoints: 500,
      maxTotalAmount: 1_500_000,
      maxPerPersonPerDay: 5_000,
      maxScansPerPersonPerDay: 3,
    },
  });

  console.log(`members and ${HISTORY_DAYS} days of activity…`);
  let scans = 0;
  const totalWeight = STORES.reduce((sum, s) => sum + s.weight, 0);

  for (let i = 0; i < MEMBERS; i += 1) {
    const phone = `+2782${String(1000000 + i).slice(-7)}`;
    const person = await prisma.person.upsert({
      where: { phoneHash: hashPhone(phone) },
      update: {},
      create: {
        phoneHash: hashPhone(phone),
        phoneEncrypted: encryptPhone(phone),
        firstName: pick(["Thandi", "Sipho", "Ayanda", "Nomsa", "Lerato", "Kagiso", "Zanele", "Naledi"]),
        consentGivenAt: new Date(Date.now() - Math.floor(Math.random() * HISTORY_DAYS) * DAY),
      },
    });

    const joined = new Date(Date.now() - Math.floor(Math.random() * HISTORY_DAYS) * DAY);
    const membership = await prisma.brandMembership.create({
      data: { brandId: brand.id, personId: person.id, joinedAt: joined },
    });

    // The shape that matters: most people come once, some come a few times,
    // a few are regulars. Flattening this is what makes a demo meaningless.
    const roll = Math.random();
    const visits = roll < 0.55 ? 1 : roll < 0.85 ? 2 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 8);

    for (let v = 0; v < visits; v += 1) {
      const at = new Date(Date.now() - Math.floor(Math.random() * HISTORY_DAYS) * DAY - Math.floor(Math.random() * DAY));
      if (at < joined) continue;
      if (Math.random() > dayWeight(at) / 1.4) continue;

      let r = Math.random() * totalWeight;
      let index = 0;
      while (index < STORES.length - 1 && r > STORES[index]!.weight) {
        r -= STORES[index]!.weight;
        index += 1;
      }
      const store = stores[index]!;

      const basket = 4_500 + Math.floor(Math.random() * 42_000);
      const award = Math.round(basket * 0.05);
      scans += 1;

      await prisma.purchaseScan.create({
        data: {
          brandId: brand.id,
          storeId: store.id,
          brandMembershipId: membership.id,
          campaignId: cashback.id,
          externalTxnId: `CL-${randomUUID().slice(0, 12)}`,
          amountCents: basket,
          wasSigned: store.signingSecretEncrypted !== null,
          purchasedAt: at,
          scannedAt: at,
          awardedAmount: award,
          awardedUnit: "CENTS",
        },
      });
      await prisma.pointsTransaction.create({
        data: {
          brandId: brand.id,
          brandMembershipId: membership.id,
          campaignId: cashback.id,
          amount: award,
          unit: "CENTS",
          reason: "PURCHASE_ACCRUAL",
          createdAt: at,
        },
      });
    }
  }

  console.log("a sleeve promotion, and a printed batch to go with it…");

  /**
   * Pack codes need their own promotion, and finding that out the hard way
   * is what this seed is for.
   *
   * A printed code awards a fixed amount — it is on a sleeve, and nobody
   * knows what basket it will end up in. So it cannot hang off the
   * share-of-spend campaign, and the engine refuses to print or scan one
   * that does (lib/packs/earn-rule.ts). Attaching the batch to "5% back"
   * produced a demo where every pack code said "this code isn't part of the
   * promotion running right now" — which is the guard working, and a seed
   * that had not read it.
   */
  const existingSleeve = await prisma.campaign.findFirst({ where: { brandId: brand.id, name: "Wing box sleeve" } });
  const sleeve = await prisma.campaign.upsert({
    where: { id: existingSleeve?.id ?? "new" },
    update: { status: "ACTIVE" },
    create: { brandId: brand.id, name: "Wing box sleeve", description: "R5 under every sleeve", status: "ACTIVE" },
  });
  await prisma.earnRule.upsert({
    where: { campaignId: sleeve.id },
    update: { amount: 500, maxTotalAmount: 200_000 },
    create: {
      brandId: brand.id,
      campaignId: sleeve.id,
      type: "FLAT_PER_SCAN",
      unit: "CENTS",
      amount: 500,
      maxTotalAmount: 200_000,
      maxScansPerPersonPerDay: 2,
    },
  });

  const owner = await prisma.user.findFirst({ where: { brandId: brand.id, role: "OWNER" } });
  const batch = await prisma.packBatch.create({
    data: { brandId: brand.id, campaignId: sleeve.id, label: "Wing box sleeves, run 1", quantity: 40, createdByUserId: owner?.id ?? null },
  });
  await prisma.packCode.createMany({
    data: Array.from({ length: 40 }, () => ({
      brandId: brand.id,
      campaignId: sleeve.id,
      batchId: batch.id,
      code: generatePackCode(),
    })),
  });

  console.log("a stamp card, partway through…");
  const existingStamps = await prisma.campaign.findFirst({ where: { brandId: brand.id, name: "Rounds card" } });
  const rounds = await prisma.campaign.upsert({
    where: { id: existingStamps?.id ?? "new" },
    update: { status: "ACTIVE" },
    create: { brandId: brand.id, name: "Rounds card", description: "Ten rounds, one free", status: "ACTIVE" },
  });
  await prisma.earnRule.upsert({
    where: { campaignId: rounds.id },
    update: { completesAt: 10 },
    create: {
      brandId: brand.id,
      campaignId: rounds.id,
      type: "FLAT_PER_SCAN",
      unit: "STAMPS",
      amount: 1,
      completesAt: 10,
    },
  });

  // Give a slice of the membership some stamps, so a shopper opening their
  // wallet sees a card in progress rather than an empty one.
  const someMembers = await prisma.brandMembership.findMany({ where: { brandId: brand.id }, take: 60 });
  for (const m of someMembers) {
    const stamps = 1 + Math.floor(Math.random() * 8);
    for (let i = 0; i < stamps; i += 1) {
      await prisma.pointsTransaction.create({
        data: {
          brandId: brand.id,
          brandMembershipId: m.id,
          campaignId: rounds.id,
          amount: 1,
          unit: "STAMPS",
          reason: "PURCHASE_ACCRUAL",
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 40) * DAY),
        },
      });
    }
  }

  console.log("");
  console.log(`Done. ${MEMBERS} members, ${scans} scans across ${STORES.length} stores, 40 unscanned pack codes.`);
  console.log("");
  console.log("  Console:  http://app.localhost:3000");
  console.log(`  Sign in:  ${owner?.email ?? "owner@chicken-licken.example"} / qumo-dev-password`);
  console.log("  Shopper:  http://chicken-licken.localhost:3000/join");
  console.log("  Till:     http://chicken-licken.localhost:3000/dev/till");
  console.log("");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
