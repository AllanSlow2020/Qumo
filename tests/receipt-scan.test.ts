import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, Person, Store } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { encryptSecret } from "@/lib/security/crypto";
import { buildReceiptUrl } from "@/lib/stores/payload";
import { redeemReceipt } from "@/lib/stores/receipt";

describe("lib/stores/receipt", () => {
  const suffix = Date.now();
  const SECRET = "a".repeat(64);

  let brand: Brand;
  let campaign: Campaign;
  let signedStore: Store;
  let unsignedStore: Store;
  let shopper: Person;

  let txnCounter = 0;
  function nextTxn(): string {
    txnCounter += 1;
    return `${suffix}-${txnCounter}`;
  }

  /** The query string a till would print, for the given store. */
  function slip(
    store: Store,
    opts: { cents?: number; txn?: string; purchasedAt?: Date; secret?: string | null } = {},
  ): string {
    const url = buildReceiptUrl(
      "https://qumo.test",
      {
        storeCode: store.code,
        externalTxnId: opts.txn ?? nextTxn(),
        amountCents: opts.cents ?? 8500,
        purchasedAt: opts.purchasedAt ?? new Date(),
      },
      opts.secret !== undefined ? opts.secret : store.signingSecretEncrypted ? SECRET : null,
    );
    return new URL(url).search.slice(1);
  }

  async function balance() {
    const membership = await prisma.brandMembership.findFirst({
      where: { brandId: brand.id, personId: shopper.id },
    });
    if (!membership) return 0;
    const totals = await prisma.pointsTransaction.aggregate({
      where: { brandMembershipId: membership.id, unit: "CENTS" },
      _sum: { amount: true },
    });
    return totals._sum.amount ?? 0;
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Licken Co", slug: `receipt-${suffix}` } });
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

    signedStore = await prisma.store.create({
      data: {
        brandId: brand.id,
        name: "Sandton",
        code: `SIGNED-${suffix}`,
        signingSecretEncrypted: encryptSecret(SECRET),
      },
    });
    unsignedStore = await prisma.store.create({
      data: { brandId: brand.id, name: "Rosebank", code: `UNSIGNED-${suffix}` },
    });

    shopper = await prisma.person.create({ data: { phoneHash: `receipt-me-${suffix}`, phoneEncrypted: "x" } });
  });

  afterAll(async () => {
    await prisma.purchaseScan.deleteMany({ where: { brandId: brand.id } });
    await prisma.pointsTransaction.deleteMany({ where: { brandId: brand.id } });
    await prisma.store.deleteMany({ where: { brandId: brand.id } });
    await prisma.earnRule.deleteMany({ where: { brandId: brand.id } });
    await prisma.brandMembership.deleteMany({ where: { brandId: brand.id } });
    await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
    await prisma.person.delete({ where: { id: shopper.id } });
    await prisma.brand.delete({ where: { id: brand.id } });
  });

  it("awards a share of the basket from a signed slip", async () => {
    const result = await redeemReceipt(slip(signedStore, { cents: 8500 }), shopper.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.amountCents).toBe(8500);
    expect(result.awarded).toBe(425); // 5% of R85.00
    expect(result.unit).toBe("CENTS");
    expect(result.storeName).toBe("Sandton");
  });

  it("records the scan as signed", async () => {
    const txn = nextTxn();
    await redeemReceipt(slip(signedStore, { txn }), shopper.id);
    const scan = await prisma.purchaseScan.findFirstOrThrow({ where: { externalTxnId: txn } });
    // Recorded per scan, not inferred from the store's current setting - a
    // store signed today may have been unsigned when this slip was scanned.
    expect(scan.wasSigned).toBe(true);
  });

  it("shows the same shopper their award again instead of an error", async () => {
    // Found by driving the app: after sign-in the App Router fetches this
    // page twice on one navigation, so the second render hit the replay
    // guard and told an honest shopper their slip was already used. The
    // ledger was right - the unique constraint held - but the message read
    // like theft. Re-opening your own slip is normal; the answer is a
    // receipt, not an accusation.
    const query = slip(signedStore, { cents: 8500 });

    const first = await redeemReceipt(query, shopper.id);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.alreadyEarned).toBe(false);

    const second = await redeemReceipt(query, shopper.id);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.alreadyEarned).toBe(true);
    // The same award, read back from the scan rather than recomputed.
    expect(second.awarded).toBe(first.awarded);
    expect(second.amountCents).toBe(8500);

    // And nothing was awarded twice.
    const scans = await prisma.purchaseScan.count({
      where: { storeId: signedStore.id, externalTxnId: new URLSearchParams(query).get("t")! },
    });
    expect(scans).toBe(1);
  });

  it("still refuses a slip that belongs to somebody else", async () => {
    // The other half, and the reason the constraint exists: a photographed
    // or forwarded slip must not earn twice.
    const query = slip(signedStore, { cents: 8500 });
    await redeemReceipt(query, shopper.id);

    const other = await prisma.person.create({
      data: { phoneHash: `receipt-thief-${suffix}`, phoneEncrypted: "x" },
    });
    const stolen = await redeemReceipt(query, other.id);
    expect(stolen.ok).toBe(false);
    if (!stolen.ok) expect(stolen.reason).toBe("ALREADY_SCANNED");

    await prisma.brandMembership.deleteMany({ where: { personId: other.id } });
    await prisma.person.delete({ where: { id: other.id } });
  });

  it("rejects a slip whose amount was edited", async () => {
    // The attack the signature exists for. Sign R85, present R850.
    const honest = new URLSearchParams(slip(signedStore, { cents: 8500 }));
    honest.set("c", "85000");

    const result = await redeemReceipt(honest, shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("BAD_SIGNATURE");
  });

  it("rejects a slip signed with the wrong key", async () => {
    const forged = slip(signedStore, { secret: "b".repeat(64) });
    const result = await redeemReceipt(forged, shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("BAD_SIGNATURE");
  });

  it("rejects an unsigned slip at a signed store", async () => {
    // Dropping `g` must not be a way to skip the check.
    const result = await redeemReceipt(slip(signedStore, { secret: null }), shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("SIGNATURE_REQUIRED");
  });

  it("still awards at an unsigned store", async () => {
    // The whole point of supporting unsigned: a brand whose POS vendor
    // cannot sign is not left with nothing.
    const result = await redeemReceipt(slip(unsignedStore, { cents: 10_000 }), shopper.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.awarded).toBe(500);
  });

  it("records an unsigned scan as unsigned", async () => {
    const txn = nextTxn();
    await redeemReceipt(slip(unsignedStore, { txn }), shopper.id);
    const scan = await prisma.purchaseScan.findFirstOrThrow({ where: { externalTxnId: txn } });
    expect(scan.wasSigned).toBe(false);
  });

  it("never awards the same slip twice", async () => {
    // The invariant, stated as the thing that actually matters. It used to
    // be written as "the second call fails", which was true but was not the
    // point - and it stopped being true once re-opening your own slip
    // started showing you a receipt. What must never change is the money.
    const txn = nextTxn();
    const query = slip(signedStore, { txn });
    const before = await balance();

    expect((await redeemReceipt(query, shopper.id)).ok).toBe(true);
    await redeemReceipt(query, shopper.id);
    await redeemReceipt(query, shopper.id);

    expect((await balance()) - before).toBe(425); // 5% of R85.00, once
  });

  it("awards once when one photographed slip is scanned by several people", async () => {
    // A receipt photographed and shared in a group chat is the obvious
    // attack, and it costs the brand real money. Written with several
    // *different* shoppers, because that is what sharing means - the old
    // version raced one person against themselves, which tests the
    // constraint but not the scenario its own comment described.
    const query = slip(signedStore, { txn: nextTxn(), cents: 2_000 });

    // Measured across the whole brand, not one shopper: whoever wins the
    // race is arbitrary and irrelevant. What the brand cares about is that
    // it paid out exactly once.
    const brandTotal = async () => {
      const totals = await prisma.pointsTransaction.aggregate({
        where: { brandId: brand.id, unit: "CENTS", amount: { gt: 0 } },
        _sum: { amount: true },
      });
      return totals._sum.amount ?? 0;
    };
    const before = await brandTotal();

    const others = await Promise.all(
      [1, 2].map((n) =>
        prisma.person.create({ data: { phoneHash: `receipt-group-${suffix}-${n}`, phoneEncrypted: "x" } }),
      ),
    );

    const results = await Promise.all([
      redeemReceipt(query, shopper.id),
      ...others.map((o) => redeemReceipt(query, o.id)),
    ]);

    // Exactly one earns. The other two are told the slip is spent.
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await brandTotal()) - before).toBe(100); // 5% of R20.00, once

    for (const o of others) {
      await prisma.brandMembership.deleteMany({ where: { personId: o.id } });
      await prisma.person.delete({ where: { id: o.id } });
    }
  });

  it("allows the same transaction id at a different store", async () => {
    // Uniqueness is per store: two tills numbering from 1 must not collide.
    const txn = nextTxn();
    expect((await redeemReceipt(slip(signedStore, { txn }), shopper.id)).ok).toBe(true);
    expect((await redeemReceipt(slip(unsignedStore, { txn }), shopper.id)).ok).toBe(true);
  });

  it("rejects a slip older than the window", async () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const result = await redeemReceipt(slip(signedStore, { purchasedAt: old }), shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("TOO_OLD");
  });

  it("accepts a slip from within the window", async () => {
    const recent = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    expect((await redeemReceipt(slip(signedStore, { purchasedAt: recent }), shopper.id)).ok).toBe(true);
  });

  it("rejects a future-dated slip but tolerates a slightly fast till", async () => {
    const wayAhead = new Date(Date.now() + 60 * 60 * 1000);
    const result = await redeemReceipt(slip(signedStore, { purchasedAt: wayAhead }), shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("FUTURE_DATED");

    const slightlyAhead = new Date(Date.now() + 2 * 60 * 1000);
    expect((await redeemReceipt(slip(signedStore, { purchasedAt: slightlyAhead }), shopper.id)).ok).toBe(true);
  });

  it("rejects an unknown store", async () => {
    const query = slip(signedStore).replace(signedStore.code, "NO-SUCH-STORE");
    const result = await redeemReceipt(query, shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("UNKNOWN_STORE");
  });

  it("rejects a paused store", async () => {
    await prisma.store.update({ where: { id: unsignedStore.id }, data: { isActive: false } });
    const result = await redeemReceipt(slip(unsignedStore), shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("STORE_INACTIVE");
    await prisma.store.update({ where: { id: unsignedStore.id }, data: { isActive: true } });
  });

  it("rejects a malformed payload", async () => {
    const result = await redeemReceipt("s=&t=&c=&d=", shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("MALFORMED");
  });

  it("writes no ledger row for a rejected slip", async () => {
    const before = await balance();
    await redeemReceipt(slip(signedStore, { secret: "c".repeat(64) }), shopper.id);
    expect(await balance()).toBe(before);
  });

  it("honours a minimum basket", async () => {
    await prisma.earnRule.update({ where: { campaignId: campaign.id }, data: { minSpendCents: 5_000 } });

    const tooSmall = await redeemReceipt(slip(signedStore, { cents: 4_999 }), shopper.id);
    expect(tooSmall.ok).toBe(false);
    if (!tooSmall.ok) expect(tooSmall.reason).toBe("BELOW_MINIMUM");

    expect((await redeemReceipt(slip(signedStore, { cents: 5_000 }), shopper.id)).ok).toBe(true);

    await prisma.earnRule.update({ where: { campaignId: campaign.id }, data: { minSpendCents: null } });
  });

  it("refuses a basket so small the share rounds to nothing", async () => {
    // Telling a shopper they earned zero reads as a bug; telling them the
    // basket was too small is the truth.
    const result = await redeemReceipt(slip(signedStore, { cents: 19 }), shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("BELOW_MINIMUM");
  });

  it("reports no campaign when none is running", async () => {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "PAUSED" } });
    const result = await redeemReceipt(slip(signedStore), shopper.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("NO_CAMPAIGN");
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "ACTIVE" } });
  });
});
