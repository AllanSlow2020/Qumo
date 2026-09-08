import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, Person, Store } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { buildReceiptUrl } from "@/lib/stores/payload";
import { redeemReceipt } from "@/lib/stores/receipt";

/**
 * The adversarial suite for the slip path. Written before the fix, and it
 * failed: this is the attack, not a hypothetical.
 *
 * A store whose point-of-sale cannot compute an HMAC has no signing secret,
 * so its slips carry no `g` parameter and nothing binds the payload to the
 * till that printed it. lib/stores/receipt.ts described that as losing
 * "protection against a shopper who edits the amount on their own receipt",
 * which understated it by some distance. The three remaining defences are:
 *
 *   - the unique constraint on (storeId, externalTxnId)
 *   - the 30-day freshness window
 *   - the campaign's minimum basket
 *
 * None of them constrain a *fabricated* slip. A shopper who has scanned one
 * real receipt knows the store code, and every other field is theirs to
 * choose: a fresh transaction id sails past the unique constraint, today's
 * timestamp past the freshness window, and any amount at all past the
 * minimum. The constraint stops a slip being reused, not invented.
 *
 * These tests assert the bound, not the vulnerability, so they keep their
 * meaning after the caps land.
 */
describe("lib/stores/receipt - forged slips at an unsigned store", () => {
  const suffix = Date.now();

  /** What a brand is willing to hand one person in a day, in cents. */
  const DAILY_CENTS_CAP = 2_000;
  /** And how many separate scans, whatever they are worth. */
  const DAILY_SCAN_CAP = 3;
  /** The most the whole campaign may ever issue. */
  const CAMPAIGN_CAP = 20_000;

  let brand: Brand;
  let campaign: Campaign;
  let store: Store;
  let attacker: Person;

  let txn = 0;
  /** A slip the till never printed: fresh id, chosen amount, timestamped now. */
  function forge(amountCents: number): string {
    txn += 1;
    const url = buildReceiptUrl(
      "https://qumo.test",
      {
        storeCode: store.code,
        externalTxnId: `forged-${suffix}-${txn}`,
        amountCents,
        purchasedAt: new Date(),
      },
      null,
    );
    return new URL(url).search.slice(1);
  }

  async function balanceFor(person: Person): Promise<number> {
    const membership = await prisma.brandMembership.findFirst({
      where: { brandId: brand.id, personId: person.id },
    });
    if (!membership) return 0;
    const totals = await prisma.pointsTransaction.aggregate({
      where: { brandMembershipId: membership.id, unit: "CENTS" },
      _sum: { amount: true },
    });
    return totals._sum.amount ?? 0;
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Forgery Co", slug: `forge-${suffix}` } });
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
        maxPerPersonPerDay: DAILY_CENTS_CAP,
        maxScansPerPersonPerDay: DAILY_SCAN_CAP,
        maxTotalAmount: CAMPAIGN_CAP,
      },
    });
    store = await prisma.store.create({
      // No signing secret: the brand's POS vendor cannot sign, which is the
      // whole reason unsigned stores exist as a shippable option.
      data: { brandId: brand.id, name: "Rosebank", code: `FORGE-${suffix}` },
    });
    attacker = await prisma.person.create({
      data: { phoneHash: `forge-attacker-${suffix}`, phoneEncrypted: "x" },
    });
  });

  afterAll(async () => {
    await prisma.purchaseScan.deleteMany({ where: { brandId: brand.id } });
    await prisma.pointsTransaction.deleteMany({ where: { brandId: brand.id } });
    await prisma.store.deleteMany({ where: { brandId: brand.id } });
    await prisma.earnRule.deleteMany({ where: { brandId: brand.id } });
    await prisma.brandMembership.deleteMany({ where: { brandId: brand.id } });
    await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
    await prisma.person.deleteMany({ where: { brandId: undefined, id: attacker.id } });
    await prisma.brand.delete({ where: { id: brand.id } });
  });

  it("caps what one person can mint from fabricated slips in a day", async () => {
    // Twenty slips, each claiming a R1 000 basket. Every one of them is
    // individually valid: unseen transaction id, timestamped now, well over
    // any minimum. Before the cap this returned R1 000 of real spendable
    // wallet value for zero purchases.
    const results = [];
    for (let i = 0; i < 20; i += 1) {
      results.push(await redeemReceipt(forge(100_000), attacker.id));
    }

    const balance = await balanceFor(attacker);
    expect(balance).toBeLessThanOrEqual(DAILY_CENTS_CAP);

    // And the refusal has to be legible, not a silent zero award - a shopper
    // who has genuinely hit the ceiling deserves to be told which one.
    const refusals = results.filter((r) => !r.ok);
    expect(refusals.length).toBeGreaterThan(0);
    expect(refusals.every((r) => !r.ok && (r.reason === "DAILY_LIMIT" || r.reason === "CAMPAIGN_EXHAUSTED"))).toBe(true);
  });

  it("leaves a refused slip scannable, rather than burning it", async () => {
    // The cap is not the shopper's fault when they are honest, and a slip
    // consumed by a refusal would be a real purchase they can never earn
    // from. So a refused scan must not write the PurchaseScan row that the
    // replay guard keys on.
    const person = await prisma.person.create({
      data: { phoneHash: `forge-honest-${suffix}`, phoneEncrypted: "x" },
    });

    // Exhaust the day.
    for (let i = 0; i < DAILY_SCAN_CAP + 1; i += 1) {
      await redeemReceipt(forge(1_000), person.id);
    }

    const query = forge(1_000);
    const refused = await redeemReceipt(query, person.id);
    expect(refused.ok).toBe(false);

    const params = new URLSearchParams(query);
    const scan = await prisma.purchaseScan.findFirst({
      where: { storeId: store.id, externalTxnId: params.get("t")! },
    });
    expect(scan).toBeNull();

    await prisma.pointsTransaction.deleteMany({ where: { brandMembership: { personId: person.id } } });
    await prisma.brandMembership.deleteMany({ where: { personId: person.id } });
    await prisma.person.delete({ where: { id: person.id } });
  });

  it("caps how many scans one person can make in a day, whatever they are worth", async () => {
    // A cap on value alone is walkable with many small slips, which is also
    // what a colluding cashier ringing up nothing looks like.
    const person = await prisma.person.create({
      data: { phoneHash: `forge-many-${suffix}`, phoneEncrypted: "x" },
    });

    for (let i = 0; i < DAILY_SCAN_CAP + 5; i += 1) {
      await redeemReceipt(forge(1_000), person.id);
    }

    const membership = await prisma.brandMembership.findFirstOrThrow({
      where: { brandId: brand.id, personId: person.id },
    });
    const accruals = await prisma.pointsTransaction.count({
      where: { brandMembershipId: membership.id, reason: "PURCHASE_ACCRUAL" },
    });
    expect(accruals).toBeLessThanOrEqual(DAILY_SCAN_CAP);

    await prisma.purchaseScan.deleteMany({ where: { brandMembershipId: membership.id } });
    await prisma.pointsTransaction.deleteMany({ where: { brandMembershipId: membership.id } });
    await prisma.brandMembership.delete({ where: { id: membership.id } });
    await prisma.person.delete({ where: { id: person.id } });
  });

  it("refuses a shopper who has opted out, without burning their slip", async () => {
    const person = await prisma.person.create({
      data: { phoneHash: `forge-out-${suffix}`, phoneEncrypted: "x" },
    });
    const first = await redeemReceipt(forge(1_000), person.id);
    expect(first.ok).toBe(true);

    await prisma.brandMembership.updateMany({
      where: { brandId: brand.id, personId: person.id },
      data: { optedOutAt: new Date() },
    });

    const query = forge(1_000);
    const refused = await redeemReceipt(query, person.id);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe("OPTED_OUT");

    // Withdrawal must not cost them a real purchase either: the slip stays
    // scannable for whenever they opt back in.
    const params = new URLSearchParams(query);
    const scan = await prisma.purchaseScan.findFirst({
      where: { storeId: store.id, externalTxnId: params.get("t")! },
    });
    expect(scan).toBeNull();

    await prisma.purchaseScan.deleteMany({ where: { brandMembership: { personId: person.id } } });
    await prisma.pointsTransaction.deleteMany({ where: { brandMembership: { personId: person.id } } });
    await prisma.brandMembership.deleteMany({ where: { personId: person.id } });
    await prisma.person.delete({ where: { id: person.id } });
  });

  it("holds the ceiling when scans arrive together", async () => {
    // The reason every check sits inside the serializable transaction. Run
    // in parallel and outside it, each of these reads a total below the
    // ceiling and all of them write - which is the race an attacker drives
    // deliberately rather than hits by accident.
    const person = await prisma.person.create({
      data: { phoneHash: `forge-race-${suffix}`, phoneEncrypted: "x" },
    });

    const slips = Array.from({ length: 8 }, () => forge(20_000));
    await Promise.all(slips.map((q) => redeemReceipt(q, person.id).catch(() => null)));

    const membership = await prisma.brandMembership.findFirst({
      where: { brandId: brand.id, personId: person.id },
    });
    const totals = membership
      ? await prisma.pointsTransaction.aggregate({
          where: { brandMembershipId: membership.id, unit: "CENTS" },
          _sum: { amount: true },
        })
      : { _sum: { amount: 0 } };
    expect(totals._sum.amount ?? 0).toBeLessThanOrEqual(DAILY_CENTS_CAP);

    if (membership) {
      await prisma.purchaseScan.deleteMany({ where: { brandMembershipId: membership.id } });
      await prisma.pointsTransaction.deleteMany({ where: { brandMembershipId: membership.id } });
      await prisma.brandMembership.delete({ where: { id: membership.id } });
    }
    await prisma.person.delete({ where: { id: person.id } });
  });

  it("stops issuing once the campaign's total liability is spent", async () => {
    // The question a brand's finance director asks first, and the one the
    // system could not answer: what is our maximum exposure? It is this
    // number, and nothing may be issued past it.
    const people = [];
    for (let i = 0; i < 12; i += 1) {
      people.push(
        await prisma.person.create({
          data: { phoneHash: `forge-crowd-${suffix}-${i}`, phoneEncrypted: "x" },
        }),
      );
    }

    for (const person of people) {
      for (let i = 0; i < 3; i += 1) {
        await redeemReceipt(forge(40_000), person.id);
      }
    }

    const issued = await prisma.pointsTransaction.aggregate({
      where: { brandId: brand.id, unit: "CENTS", amount: { gt: 0 } },
      _sum: { amount: true },
    });
    expect(issued._sum.amount ?? 0).toBeLessThanOrEqual(CAMPAIGN_CAP);

    for (const person of people) {
      await prisma.purchaseScan.deleteMany({ where: { brandMembership: { personId: person.id } } });
      await prisma.pointsTransaction.deleteMany({ where: { brandMembership: { personId: person.id } } });
      await prisma.brandMembership.deleteMany({ where: { personId: person.id } });
      await prisma.person.delete({ where: { id: person.id } });
    }
  });
});
