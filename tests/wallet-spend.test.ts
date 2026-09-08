import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Brand, BrandMembership, Person, User } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  cancelWalletSpend,
  confirmWalletSpend,
  createWalletSpend,
  expireLapsedSpends,
  getPendingSpend,
  WalletSpendError,
} from "@/lib/wallet/spend";
import { ForbiddenError } from "@/lib/auth/rbac";

describe("lib/wallet/spend", () => {
  const suffix = Date.now();
  let brand: Brand;
  let rival: Brand;
  let cashier: User;
  let rivalCashier: User;
  let shopper: Person;
  let membership: BrandMembership;

  const staff = (brandId: string, userId: string, role = "QUALITY") => ({
    user: { brandId, role, id: userId },
  });

  /** Sets the wallet balance to exactly `cents` by topping up the ledger. */
  async function setBalance(cents: number) {
    await prisma.pointsTransaction.deleteMany({ where: { brandMembershipId: membership.id } });
    if (cents !== 0) {
      await prisma.pointsTransaction.create({
        data: {
          brandId: brand.id,
          brandMembershipId: membership.id,
          amount: cents,
          unit: "CENTS",
          reason: "PACK_SCAN_AWARDED",
        },
      });
    }
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Spend Brand", slug: `spend-${suffix}` } });
    rival = await prisma.brand.create({ data: { name: "Spend Rival", slug: `spend-rival-${suffix}` } });

    cashier = await prisma.user.create({
      data: { brandId: brand.id, email: `cashier-${suffix}@test.dev`, name: "Cashier", role: "QUALITY", passwordHash: "x" },
    });
    rivalCashier = await prisma.user.create({
      data: { brandId: rival.id, email: `rival-cashier-${suffix}@test.dev`, name: "Rival", role: "QUALITY", passwordHash: "x" },
    });

    shopper = await prisma.person.create({
      data: { phoneHash: `spend-me-${suffix}`, phoneEncrypted: "x", firstName: "Thandi" },
    });
    membership = await prisma.brandMembership.create({ data: { brandId: brand.id, personId: shopper.id } });
  });

  beforeEach(async () => {
    await prisma.walletSpend.deleteMany({ where: { brandMembershipId: membership.id } });
    await setBalance(10_000); // R100.00
  });

  afterAll(async () => {
    const brandIds = [brand.id, rival.id];
    await prisma.walletSpend.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.pointsTransaction.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.brandMembership.deleteMany({ where: { personId: shopper.id } });
    await prisma.person.delete({ where: { id: shopper.id } });
    await prisma.user.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.brand.deleteMany({ where: { id: { in: brandIds } } });
  });

  it("does not touch the balance when a spend is only requested", async () => {
    // The whole reason for two phases: an unconfirmed request must cost
    // nothing, or a cashier who never honours it destroys real money.
    await createWalletSpend(shopper.id, brand.id, 5_000);

    const totals = await prisma.pointsTransaction.aggregate({
      where: { brandMembershipId: membership.id, unit: "CENTS" },
      _sum: { amount: true },
    });
    expect(totals._sum.amount).toBe(10_000);
  });

  it("debits only when the cashier confirms", async () => {
    const spend = await createWalletSpend(shopper.id, brand.id, 2_500);
    const result = await confirmWalletSpend(staff(brand.id, cashier.id), spend.code);

    expect(result.amountCents).toBe(2_500);
    expect(result.memberFirstName).toBe("Thandi");
    expect(result.newBalanceCents).toBe(7_500);

    const debit = await prisma.pointsTransaction.findFirst({
      where: { brandMembershipId: membership.id, reason: "WALLET_SPENT" },
    });
    // Negative, and a ledger row like any other - not a decrement of a
    // stored total.
    expect(debit?.amount).toBe(-2_500);
    expect(debit?.unit).toBe("CENTS");
  });

  it("records who confirmed it", async () => {
    const spend = await createWalletSpend(shopper.id, brand.id, 1_000);
    await confirmWalletSpend(staff(brand.id, cashier.id), spend.code);

    const row = await prisma.walletSpend.findUniqueOrThrow({ where: { code: spend.code } });
    expect(row.status).toBe("CONFIRMED");
    expect(row.confirmedByUserId).toBe(cashier.id);
    expect(row.confirmedAt).toBeInstanceOf(Date);
  });

  it("refuses a second confirmation of the same code", async () => {
    const spend = await createWalletSpend(shopper.id, brand.id, 1_000);
    await confirmWalletSpend(staff(brand.id, cashier.id), spend.code);

    await expect(confirmWalletSpend(staff(brand.id, cashier.id), spend.code)).rejects.toThrow(WalletSpendError);

    const debits = await prisma.pointsTransaction.count({
      where: { brandMembershipId: membership.id, reason: "WALLET_SPENT" },
    });
    expect(debits).toBe(1);
  });

  it("debits once when two tills confirm the same code at the same moment", async () => {
    const spend = await createWalletSpend(shopper.id, brand.id, 3_000);

    const results = await Promise.allSettled([
      confirmWalletSpend(staff(brand.id, cashier.id), spend.code),
      confirmWalletSpend(staff(brand.id, cashier.id), spend.code),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const debits = await prisma.pointsTransaction.count({
      where: { brandMembershipId: membership.id, reason: "WALLET_SPENT" },
    });
    expect(debits).toBe(1);
  });

  it("refuses to overdraw a balance", async () => {
    await expect(createWalletSpend(shopper.id, brand.id, 20_000)).rejects.toThrow(WalletSpendError);
  });

  it("refuses at confirmation when the balance dropped in between", async () => {
    // The check at request time is a courtesy; this is the enforcement.
    const spend = await createWalletSpend(shopper.id, brand.id, 9_000);
    await setBalance(1_000);

    await expect(confirmWalletSpend(staff(brand.id, cashier.id), spend.code)).rejects.toThrow(WalletSpendError);

    const debits = await prisma.pointsTransaction.count({
      where: { brandMembershipId: membership.id, reason: "WALLET_SPENT" },
    });
    expect(debits).toBe(0);
  });

  it("keeps only one live request per member", async () => {
    // Several live codes would each individually fit the balance while
    // together exceeding it, and every one would pass its own check.
    const first = await createWalletSpend(shopper.id, brand.id, 6_000);
    const second = await createWalletSpend(shopper.id, brand.id, 6_000);

    const firstRow = await prisma.walletSpend.findUniqueOrThrow({ where: { code: first.code } });
    expect(firstRow.status).toBe("CANCELLED");

    await expect(confirmWalletSpend(staff(brand.id, cashier.id), first.code)).rejects.toThrow(WalletSpendError);
    await expect(confirmWalletSpend(staff(brand.id, cashier.id), second.code)).resolves.toBeTruthy();
  });

  it("refuses an expired code and marks it expired", async () => {
    const spend = await createWalletSpend(shopper.id, brand.id, 1_000);
    await prisma.walletSpend.update({
      where: { code: spend.code },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await expect(confirmWalletSpend(staff(brand.id, cashier.id), spend.code)).rejects.toThrow(WalletSpendError);
    const row = await prisma.walletSpend.findUniqueOrThrow({ where: { code: spend.code } });
    expect(row.status).toBe("EXPIRED");
  });

  it("never lets one brand confirm another brand's code", async () => {
    const spend = await createWalletSpend(shopper.id, brand.id, 1_000);
    await expect(confirmWalletSpend(staff(rival.id, rivalCashier.id), spend.code)).rejects.toThrow(WalletSpendError);

    const row = await prisma.walletSpend.findUniqueOrThrow({ where: { code: spend.code } });
    expect(row.status).toBe("PENDING");
  });

  it("rejects a malformed code", async () => {
    for (const code of ["", "12345", "abcdef", "1234567"]) {
      await expect(confirmWalletSpend(staff(brand.id, cashier.id), code)).rejects.toThrow(WalletSpendError);
    }
  });

  it("rejects a zero or negative amount", async () => {
    for (const amount of [0, -100]) {
      await expect(createWalletSpend(shopper.id, brand.id, amount)).rejects.toThrow(WalletSpendError);
    }
  });

  it("refuses a brand the shopper has no membership with", async () => {
    await expect(createWalletSpend(shopper.id, rival.id, 100)).rejects.toThrow(WalletSpendError);
  });

  it("lets a shopper cancel their own request but not someone else's", async () => {
    const spend = await createWalletSpend(shopper.id, brand.id, 1_000);

    const stranger = await prisma.person.create({
      data: { phoneHash: `spend-stranger-${suffix}`, phoneEncrypted: "x" },
    });
    // A stranger naming the id must not be able to cancel it.
    await cancelWalletSpend(stranger.id, spend.id);
    expect((await prisma.walletSpend.findUniqueOrThrow({ where: { id: spend.id } })).status).toBe("PENDING");

    await cancelWalletSpend(shopper.id, spend.id);
    expect((await prisma.walletSpend.findUniqueOrThrow({ where: { id: spend.id } })).status).toBe("CANCELLED");

    await prisma.person.delete({ where: { id: stranger.id } });
  });

  it("enforces role permissions on confirmation", async () => {
    const spend = await createWalletSpend(shopper.id, brand.id, 1_000);
    await expect(
      confirmWalletSpend({ user: { id: cashier.id, brandId: brand.id, role: "NOT_A_ROLE", name: "Test Cashier" } }, spend.code),
    ).rejects.toThrow(ForbiddenError);
  });

  it("only reports a live request to its owner", async () => {
    const spend = await createWalletSpend(shopper.id, brand.id, 1_000);
    expect((await getPendingSpend(shopper.id, brand.id))?.id).toBe(spend.id);

    const stranger = await prisma.person.create({
      data: { phoneHash: `spend-peek-${suffix}`, phoneEncrypted: "x" },
    });
    expect(await getPendingSpend(stranger.id, brand.id)).toBeNull();
    await prisma.person.delete({ where: { id: stranger.id } });
  });

  it("sweeps lapsed requests without touching live ones", async () => {
    const live = await createWalletSpend(shopper.id, brand.id, 1_000);
    await prisma.walletSpend.create({
      data: {
        brandId: brand.id,
        brandMembershipId: membership.id,
        amountCents: 500,
        code: `9${String(suffix).slice(-5)}`,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    expect(await expireLapsedSpends(brand.id)).toBe(1);
    expect((await prisma.walletSpend.findUniqueOrThrow({ where: { code: live.code } })).status).toBe("PENDING");
  });
});
