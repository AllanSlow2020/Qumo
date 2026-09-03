import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Brand, Campaign, Person, Store } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ForbiddenError } from "@/lib/auth/rbac";
import { encryptPhone, hashPhone } from "@/lib/security/crypto";
import { buildReceiptUrl } from "@/lib/stores/payload";
import { redeemReceipt } from "@/lib/stores/receipt";
import { createWalletSpend, WalletSpendError } from "@/lib/wallet/spend";
import { HONOUR_WINDOW_MS, programmeState } from "@/lib/subscriptions/state";
import {
  SubscriptionError,
  cancelForSession,
  closeElapsedProgrammes,
  getProgrammeState,
  resumeForSession,
  setStatusForSession,
} from "@/lib/subscriptions/manage";

describe("what a brand's standing means, decided from the row", () => {
  const day = 24 * 60 * 60 * 1000;
  const cancelled = new Date("2026-01-01T00:00:00Z");
  const until = new Date(cancelled.getTime() + HONOUR_WINDOW_MS);

  it("lets an unmanaged brand carry on, deliberately", () => {
    // Fails open on purpose while no billing provider exists: an absent row
    // means "not on the billing system yet", not "stopped paying". The
    // comment on UNMANAGED says which way to flip it when that changes.
    expect(programmeState(null)).toMatchObject({ canEarn: true, canRedeem: true, status: "UNMANAGED" });
  });

  it("freezes earning the moment they cancel, and keeps redemption", () => {
    const oneDayLater = new Date(cancelled.getTime() + day);
    const state = programmeState(
      { status: "CANCELLED", cancelledAt: cancelled, honourRedemptionUntil: until },
      oneDayLater,
    );
    expect(state.canEarn).toBe(false);
    expect(state.canRedeem).toBe(true);
    expect(state.status).toBe("CANCELLED");
  });

  it("closes once the window elapses, whether or not anything ran", () => {
    // The property the whole design rests on. A nightly job that marks rows
    // CLOSED is tidying; if it never runs, this still answers correctly —
    // otherwise a brand stops paying, a cron quietly fails, and the
    // programme keeps awarding for a month.
    const afterWindow = new Date(until.getTime() + 1);
    const state = programmeState(
      { status: "CANCELLED", cancelledAt: cancelled, honourRedemptionUntil: until },
      afterWindow,
    );
    expect(state).toMatchObject({ canEarn: false, canRedeem: false, status: "CLOSED" });
  });

  it("honours the window right up to its last moment", () => {
    const justInside = new Date(until.getTime() - 1);
    expect(
      programmeState({ status: "CANCELLED", cancelledAt: cancelled, honourRedemptionUntil: until }, justInside)
        .canRedeem,
    ).toBe(true);
  });
});

describe("cancelling a programme, end to end", () => {
  const suffix = Date.now();

  let brand: Brand;
  let campaign: Campaign;
  let store: Store;
  let shopper: Person;

  const owner = () => ({ user: { id: "test-owner", brandId: brand.id, role: "OWNER", name: "Test Owner" } });
  const admin = () => ({ user: { id: "test-admin", brandId: brand.id, role: "ADMIN", name: "Test Admin" } });

  let txn = 0;
  function slip(amountCents = 10_000): string {
    txn += 1;
    const url = buildReceiptUrl(
      "https://qumo.test",
      { storeCode: store.code, externalTxnId: `sub-${suffix}-${txn}`, amountCents, purchasedAt: new Date() },
      null,
    );
    return new URL(url).search.slice(1);
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Licken", slug: `sub-${suffix}` } });
    campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "5% back", status: "ACTIVE" },
    });
    await prisma.earnRule.create({
      data: {
        brandId: brand.id,
        campaignId: campaign.id,
        type: "PERCENT_OF_SPEND",
        unit: "CENTS",
        amount: 0,
        basisPoints: 500,
      },
    });
    store = await prisma.store.create({ data: { brandId: brand.id, name: "S", code: `SUB-${suffix}` } });

    const phone = `+2786${String(suffix).slice(-7)}`;
    shopper = await prisma.person.create({
      data: { phoneHash: hashPhone(phone), phoneEncrypted: encryptPhone(phone), firstName: "Allan" },
    });
  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { brandId: brand.id } });
    await prisma.pointsTransaction.deleteMany({ where: { brandId: brand.id } });
    await prisma.walletSpend.deleteMany({ where: { brandId: brand.id } });
    await prisma.purchaseScan.deleteMany({ where: { brandId: brand.id } });
    await prisma.brandMembership.deleteMany({ where: { brandId: brand.id } });
    await prisma.store.deleteMany({ where: { brandId: brand.id } });
    await prisma.earnRule.deleteMany({ where: { brandId: brand.id } });
    await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
    await prisma.person.delete({ where: { id: shopper.id } });
    await prisma.brand.delete({ where: { id: brand.id } });
  });

  beforeEach(async () => {
    await setStatusForSession(owner(), "ACTIVE");
  });

  it("earns normally while the brand is paying", async () => {
    const result = await redeemReceipt(slip(), shopper.id);
    expect(result.ok).toBe(true);
  });

  it("stops earning the instant they cancel", async () => {
    await cancelForSession(owner());
    expect(await redeemReceipt(slip(), shopper.id)).toEqual({ ok: false, reason: "PROGRAMME_CLOSED" });
  });

  it("refuses before the slip is spent, so it works again if they come back", async () => {
    // Same discipline as every other refusal on this path: a shopper must
    // not lose a real purchase to a brand's commercial decision.
    const theSlip = slip(20_000);
    await cancelForSession(owner());
    expect(await redeemReceipt(theSlip, shopper.id)).toEqual({ ok: false, reason: "PROGRAMME_CLOSED" });

    await resumeForSession(owner());
    const second = await redeemReceipt(theSlip, shopper.id);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.awarded).toBe(1_000);
  });

  it("still lets a shopper spend what they had, for sixty days", async () => {
    // The half of the promise that costs the brand something, and the half
    // a shopper actually cares about.
    const membership = await prisma.brandMembership.findFirstOrThrow({
      where: { brandId: brand.id, personId: shopper.id },
    });
    await prisma.pointsTransaction.create({
      data: {
        brandId: brand.id,
        brandMembershipId: membership.id,
        campaignId: campaign.id,
        amount: 5_000,
        unit: "CENTS",
        reason: "PURCHASE_ACCRUAL",
      },
    });

    await cancelForSession(owner());
    const spend = await createWalletSpend(shopper.id, brand.id, 1_000);
    expect(spend.amountCents).toBe(1_000);
  });

  it("stops redemption once the window has passed", async () => {
    await cancelForSession(owner());
    // Reach back in time rather than wait sixty days: the row is what the
    // engine reads, so moving it is a faithful simulation.
    await prisma.subscription.update({
      where: { brandId: brand.id },
      data: { honourRedemptionUntil: new Date(Date.now() - 1_000) },
    });

    await expect(createWalletSpend(shopper.id, brand.id, 500)).rejects.toThrow(WalletSpendError);
    expect(await getProgrammeState(brand.id)).toMatchObject({ canEarn: false, canRedeem: false, status: "CLOSED" });
  });

  it("restores everything if the brand comes back, because nothing was deleted", async () => {
    // Closure freezes; it never erases. Balances are ledger rows and the
    // ledger is immutable, which is exactly what makes coming back possible.
    await cancelForSession(owner());
    await resumeForSession(owner());

    const state = await getProgrammeState(brand.id);
    expect(state).toMatchObject({ canEarn: true, canRedeem: true });
    const spend = await createWalletSpend(shopper.id, brand.id, 500);
    expect(spend.amountCents).toBe(500);
  });

  it("writes down the date rather than recomputing it later", async () => {
    // A stored promise. If the window ever becomes thirty days, everybody
    // already cancelled under sixty keeps sixty.
    const before = Date.now();
    await cancelForSession(owner());
    const row = await prisma.subscription.findUniqueOrThrow({ where: { brandId: brand.id } });

    expect(row.honourRedemptionUntil).not.toBeNull();
    const window = row.honourRedemptionUntil!.getTime() - before;
    expect(window).toBeGreaterThan(HONOUR_WINDOW_MS - 5_000);
    expect(window).toBeLessThan(HONOUR_WINDOW_MS + 5_000);
  });

  it("refuses to cancel twice", async () => {
    await cancelForSession(owner());
    await expect(cancelForSession(owner())).rejects.toThrow(SubscriptionError);
  });

  it("won't let an admin cancel", async () => {
    // Cancelling ends earning and starts a clock on every shopper's
    // balance. That is not a decision for whoever happens to be logged in.
    await expect(cancelForSession(admin())).rejects.toThrow(ForbiddenError);
  });

  it("tidies elapsed rows without that being what enforces anything", async () => {
    await cancelForSession(owner());
    await prisma.subscription.update({
      where: { brandId: brand.id },
      data: { honourRedemptionUntil: new Date(Date.now() - 1_000) },
    });

    expect(await closeElapsedProgrammes()).toBeGreaterThanOrEqual(1);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { brandId: brand.id } })).status).toBe("CLOSED");
  });
});
