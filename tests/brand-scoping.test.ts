import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, Person, Store } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { listProgrammes } from "@/lib/consumer/membership";
import { exportPerson } from "@/lib/consumer/export";
import { getWallet, getWalletHistory } from "@/lib/consumer/wallet";
import { encryptPhone, hashPhone } from "@/lib/security/crypto";
import { buildReceiptUrl } from "@/lib/stores/payload";
import { redeemReceipt } from "@/lib/stores/receipt";
import { generatePackCode } from "@/lib/packs/code";
import { redeemPackCode } from "@/lib/packs/scan";

/**
 * One shopper, two brands, and the question Phase D exists to answer: what
 * does a page under copper-kettle.qumo.co.za show, and what does it refuse?
 *
 * The host-parsing half is tested without a database in brand-host.test.ts.
 * This is the half that costs money if it is wrong.
 */
describe("what a brand's own site shows and refuses", () => {
  const suffix = Date.now();

  let kettle: Brand;
  let amberOak: Brand;
  let kettleCampaign: Campaign;
  let amberOakCampaign: Campaign;
  let kettleStore: Store;
  let shopper: Person;

  async function makeBrand(slug: string, name: string) {
    const brand = await prisma.brand.create({ data: { name, slug: `${slug}-${suffix}` } });
    const campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: `${name} 5%`, status: "ACTIVE" },
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
    return { brand, campaign };
  }

  let txn = 0;
  /** A signed slip from the Copper Kettle store, as its till would print it. */
  function kettleSlip(amountCents = 10_000): string {
    txn += 1;
    const url = buildReceiptUrl(
      "https://qumo.test",
      {
        storeCode: kettleStore.code,
        externalTxnId: `scope-${suffix}-${txn}`,
        amountCents,
        purchasedAt: new Date(),
      },
      null,
    );
    return new URL(url).search.slice(1);
  }

  async function centsAt(brand: Brand): Promise<number> {
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
    ({ brand: kettle, campaign: kettleCampaign } = await makeBrand("scope-kettle", "Copper Kettle"));
    ({ brand: amberOak, campaign: amberOakCampaign } = await makeBrand("scope-amber-oak", "Amber Oak"));

    kettleStore = await prisma.store.create({
      data: { brandId: kettle.id, name: "Sandton", code: `SCOPE-CK-${suffix}` },
    });

    const phone = `+27${suffix}`;
    shopper = await prisma.person.create({
      data: { phoneHash: hashPhone(phone), phoneEncrypted: encryptPhone(phone), firstName: "Allan" },
    });
  });

  afterAll(async () => {
    for (const brand of [kettle, amberOak]) {
      await prisma.pointsTransaction.deleteMany({ where: { brandId: brand.id } });
      await prisma.purchaseScan.deleteMany({ where: { brandId: brand.id } });
      await prisma.packCode.deleteMany({ where: { brandId: brand.id } });
      await prisma.packBatch.deleteMany({ where: { brandId: brand.id } });
      await prisma.brandMembership.deleteMany({ where: { brandId: brand.id } });
      await prisma.store.deleteMany({ where: { brandId: brand.id } });
      await prisma.earnRule.deleteMany({ where: { brandId: brand.id } });
      await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
      await prisma.brand.delete({ where: { id: brand.id } });
    }
    await prisma.person.delete({ where: { id: shopper.id } });
  });

  it("awards a slip scanned on its own brand's site", async () => {
    const result = await redeemReceipt(kettleSlip(), shopper.id, new Date(), kettle.id);
    expect(result.ok).toBe(true);
    expect(await centsAt(kettle)).toBe(500);
  });

  it("refuses the same slip on another brand's site, and awards nothing", async () => {
    // The hand-crafted URL: amber-oak.qumo.co.za/r?s=<a Copper Kettle store>.
    // Nothing about it could have misdirected value - the award has always
    // been driven by the store's own brandId - but rendering one brand's
    // award under a Amber Oak header is indistinguishable, to a
    // shopper, from the two brands sharing a database.
    const before = await centsAt(kettle);
    const result = await redeemReceipt(kettleSlip(), shopper.id, new Date(), amberOak.id);

    expect(result).toEqual({ ok: false, reason: "WRONG_BRAND" });
    expect(await centsAt(kettle)).toBe(before);
    expect(await centsAt(amberOak)).toBe(0);
  });

  it("refuses before the slip is spent, so the shopper can still use it", async () => {
    // A refusal that consumed the transaction id would punish the shopper
    // for our routing: they would return to the right host and be told the
    // slip had already been scanned.
    const slip = kettleSlip(20_000);
    expect(await redeemReceipt(slip, shopper.id, new Date(), amberOak.id)).toEqual({
      ok: false,
      reason: "WRONG_BRAND",
    });

    const second = await redeemReceipt(slip, shopper.id, new Date(), kettle.id);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.awarded).toBe(1_000);
  });

  it("refuses a pack code on the wrong brand's site without burning it", async () => {
    // The same rule on the sticker path, and the stakes are higher: a pack
    // code is single-use, so burning one on a refusal costs the shopper a
    // pack they have already bought.
    // Its own campaign with a fixed-per-scan rule. A pack code carries no
    // basket, so a share-of-spend promotion can never award on one - the
    // engine refuses it, and this fixture used to build exactly that
    // impossible pairing.
    const packCampaign = await prisma.campaign.create({
      data: { brandId: amberOak.id, name: "Amber Oak stickers", status: "ACTIVE" },
    });
    await prisma.earnRule.create({
      data: {
        brandId: amberOak.id,
        campaignId: packCampaign.id,
        type: "FLAT_PER_SCAN",
        unit: "POINTS",
        amount: 25,
      },
    });

    const code = generatePackCode();
    const batch = await prisma.packBatch.create({
      data: { brandId: amberOak.id, campaignId: packCampaign.id, label: `scope-${suffix}`, quantity: 1 },
    });
    await prisma.packCode.create({
      data: { brandId: amberOak.id, campaignId: packCampaign.id, batchId: batch.id, code },
    });

    expect(await redeemPackCode(code, shopper.id, new Date(), kettle.id)).toEqual({
      ok: false,
      reason: "WRONG_BRAND",
    });

    const onTheRightSite = await redeemPackCode(code, shopper.id, new Date(), amberOak.id);
    expect(onTheRightSite.ok).toBe(true);
  });

  it("still works for a carrier that asserts no brand", async () => {
    // SMS arrives with a code and a phone number and no host at all. There
    // is nothing to cross-check, and the absence of a claim is not a
    // mismatched one - Phase G depends on this staying true.
    const result = await redeemReceipt(kettleSlip(4_000), shopper.id, new Date(), null);
    expect(result.ok).toBe(true);
  });

  it("shows one brand's balance on one brand's site", async () => {
    const here = await getWallet(shopper.id, kettle.id);
    expect(here).toHaveLength(1);
    expect(here[0]!.brandName).toBe("Copper Kettle");

    const there = await getWallet(shopper.id, amberOak.id);
    expect(there).toHaveLength(1);
    expect(there[0]!.brandName).toBe("Amber Oak");

    // The sums are the giveaway if scoping were done with the wrong filter:
    // both memberships exist, so an unscoped groupBy would put Amber Oak's
    // rows into Copper Kettle's total.
    const kettleCents = here[0]!.balances.find((b) => b.unit === "CENTS")?.amount ?? 0;
    expect(kettleCents).toBe(await centsAt(kettle));
    expect(kettleCents).not.toBe(await centsAt(amberOak));
  });

  it("shows one brand's activity, and one brand's membership", async () => {
    const history = await getWalletHistory(shopper.id, 50, kettle.id);
    expect(history.length).toBeGreaterThan(0);
    expect(history.every((row) => row.brandId === kettle.id)).toBe(true);

    const programmes = await listProgrammes(shopper.id, kettle.id);
    expect(programmes.map((p) => p.brandName)).toEqual(["Copper Kettle"]);
  });

  it("still exports every brand, because that request is not the brand's", async () => {
    // The one place the shopper's scope is deliberately wider than the
    // page's. It is generated for the signed-in shopper and sent to them;
    // narrowing it to the host would answer a different question than a
    // subject access request asks.
    const data = await exportPerson(shopper.id);
    const names = data!.brands.map((b) => b.brand).sort();
    expect(names).toContain("Copper Kettle");
    expect(names).toContain("Amber Oak");
  });

  it("keeps the two campaigns apart", async () => {
    // Belt and braces on the thing that would be worst: a Amber Oak campaign
    // paying for a Copper Kettle purchase.
    const rows = await prisma.pointsTransaction.findMany({
      where: { campaignId: amberOakCampaign.id },
      select: { brandId: true },
    });
    expect(rows.every((r) => r.brandId === amberOak.id)).toBe(true);
    expect(kettleCampaign.brandId).toBe(kettle.id);
  });
});
