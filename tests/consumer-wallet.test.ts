import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Person } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { formatLedgerAmount, getWallet, getWalletHistory } from "@/lib/consumer/wallet";

describe("lib/consumer/wallet", () => {
  const suffix = Date.now();
  let coffeeBrand: Brand;
  let drinksBrand: Brand;
  let shopper: Person;
  let stranger: Person;

  beforeAll(async () => {
    coffeeBrand = await prisma.brand.create({ data: { name: "Wallet Coffee Co", slug: `wallet-coffee-${suffix}` } });
    drinksBrand = await prisma.brand.create({ data: { name: "Wallet Drinks Co", slug: `wallet-drinks-${suffix}` } });

    shopper = await prisma.person.create({ data: { phoneHash: `wallet-me-${suffix}`, phoneEncrypted: "x" } });
    stranger = await prisma.person.create({ data: { phoneHash: `wallet-them-${suffix}`, phoneEncrypted: "x" } });

    const coffeeMembership = await prisma.brandMembership.create({
      data: { brandId: coffeeBrand.id, personId: shopper.id },
    });
    const drinksMembership = await prisma.brandMembership.create({
      data: { brandId: drinksBrand.id, personId: shopper.id },
    });
    const strangerMembership = await prisma.brandMembership.create({
      data: { brandId: coffeeBrand.id, personId: stranger.id },
    });

    await prisma.pointsTransaction.createMany({
      data: [
        // Coffee: a spend-based wallet plus a part-filled stamp card.
        { brandId: coffeeBrand.id, brandMembershipId: coffeeMembership.id, amount: 425, unit: "CENTS", reason: "PACK_SCAN_AWARDED" },
        { brandId: coffeeBrand.id, brandMembershipId: coffeeMembership.id, amount: 300, unit: "CENTS", reason: "PACK_SCAN_AWARDED" },
        { brandId: coffeeBrand.id, brandMembershipId: coffeeMembership.id, amount: -200, unit: "CENTS", reason: "COUPON_UNLOCKED" },
        { brandId: coffeeBrand.id, brandMembershipId: coffeeMembership.id, amount: 1, unit: "STAMPS", reason: "PACK_SCAN_AWARDED" },
        { brandId: coffeeBrand.id, brandMembershipId: coffeeMembership.id, amount: 1, unit: "STAMPS", reason: "PACK_SCAN_AWARDED" },
        // Drinks: pack-scan points, the Campari model.
        { brandId: drinksBrand.id, brandMembershipId: drinksMembership.id, amount: 50, unit: "POINTS", reason: "PACK_SCAN_AWARDED" },
        // Someone else's money, at a brand the shopper also belongs to.
        { brandId: coffeeBrand.id, brandMembershipId: strangerMembership.id, amount: 999999, unit: "CENTS", reason: "PACK_SCAN_AWARDED" },
      ],
    });
  });

  afterAll(async () => {
    const brandIds = [coffeeBrand.id, drinksBrand.id];
    await prisma.pointsTransaction.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.brandMembership.deleteMany({ where: { personId: { in: [shopper.id, stranger.id] } } });
    await prisma.person.deleteMany({ where: { id: { in: [shopper.id, stranger.id] } } });
    await prisma.brand.deleteMany({ where: { id: { in: brandIds } } });
  });

  it("derives each balance by summing the ledger", async () => {
    const wallet = await getWallet(shopper.id);
    const coffee = wallet.find((w) => w.brandId === coffeeBrand.id);

    // 425 + 300 - 200 = 525. Nothing is read from a stored counter.
    expect(coffee?.balances.find((b) => b.unit === "CENTS")?.amount).toBe(525);
    expect(coffee?.balances.find((b) => b.unit === "STAMPS")?.amount).toBe(2);
  });

  it("keeps balances separate per brand, because the wallet is closed-loop", async () => {
    const wallet = await getWallet(shopper.id);
    expect(wallet).toHaveLength(2);

    const drinks = wallet.find((w) => w.brandId === drinksBrand.id);
    expect(drinks?.balances.find((b) => b.unit === "POINTS")?.amount).toBe(50);
    // Cents earned at the coffee brand must not appear at the drinks brand.
    expect(drinks?.balances.find((b) => b.unit === "CENTS")).toBeUndefined();
  });

  it("keeps units separate, because cents and stamps are not addable", async () => {
    const wallet = await getWallet(shopper.id);
    const coffee = wallet.find((w) => w.brandId === coffeeBrand.id);
    expect(new Set(coffee?.balances.map((b) => b.unit))).toEqual(new Set(["CENTS", "STAMPS"]));
  });

  it("never includes another shopper's balance", async () => {
    const wallet = await getWallet(shopper.id);
    const coffee = wallet.find((w) => w.brandId === coffeeBrand.id);
    expect(coffee?.balances.find((b) => b.unit === "CENTS")?.amount).not.toBe(999999);
  });

  it("returns nothing for a shopper who has signed in but never scanned", async () => {
    const newcomer = await prisma.person.create({
      data: { phoneHash: `wallet-new-${suffix}`, phoneEncrypted: "x" },
    });
    expect(await getWallet(newcomer.id)).toEqual([]);
    await prisma.person.delete({ where: { id: newcomer.id } });
  });

  it("returns the shopper's own history, newest first", async () => {
    const history = await getWalletHistory(shopper.id);
    expect(history).toHaveLength(6);
    for (let i = 1; i < history.length; i += 1) {
      const previous = history[i - 1]!;
      const current = history[i]!;
      expect(previous.createdAt.getTime()).toBeGreaterThanOrEqual(current.createdAt.getTime());
    }
  });

  it("honours the history limit", async () => {
    expect(await getWalletHistory(shopper.id, 2)).toHaveLength(2);
  });
});

describe("formatLedgerAmount", () => {
  it("renders cents as rands only at the edge", () => {
    expect(formatLedgerAmount(425, "CENTS")).toBe("R4.25");
    expect(formatLedgerAmount(8500, "CENTS")).toBe("R85.00");
    // The padding case that a naive implementation gets wrong: 5 cents is
    // R0.05, not R0.5.
    expect(formatLedgerAmount(5, "CENTS")).toBe("R0.05");
    expect(formatLedgerAmount(0, "CENTS")).toBe("R0.00");
    expect(formatLedgerAmount(-200, "CENTS")).toBe("-R2.00");
  });

  it("pluralises counts", () => {
    expect(formatLedgerAmount(1, "STAMPS")).toBe("1 stamp");
    expect(formatLedgerAmount(2, "STAMPS")).toBe("2 stamps");
    expect(formatLedgerAmount(0, "STAMPS")).toBe("0 stamps");
    expect(formatLedgerAmount(1, "POINTS")).toBe("1 point");
    expect(formatLedgerAmount(30, "POINTS")).toBe("30 points");
  });
});
