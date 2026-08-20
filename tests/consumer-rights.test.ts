import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, Person } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { exportPerson } from "@/lib/consumer/export";
import { listProgrammes, setOptOut } from "@/lib/consumer/membership";
import { createSession } from "@/lib/consumer/session";
import { encryptPhone, hashPhone } from "@/lib/security/crypto";

/**
 * The two things the privacy notice promised and the code could not do:
 * tell a shopper what is held about them, and let them stop taking part.
 */
describe("what a shopper can do with their own data", () => {
  const suffix = Date.now();

  let brandA: Brand;
  let brandB: Brand;
  let campaign: Campaign;
  let me: Person;
  let someoneElse: Person;

  async function member(person: Person, brand: Brand) {
    return prisma.brandMembership.create({ data: { brandId: brand.id, personId: person.id } });
  }

  beforeAll(async () => {
    brandA = await prisma.brand.create({ data: { name: "Licken", slug: `rights-a-${suffix}` } });
    brandB = await prisma.brand.create({ data: { name: "Campari", slug: `rights-b-${suffix}` } });
    campaign = await prisma.campaign.create({
      data: { brandId: brandA.id, name: "5% back", status: "ACTIVE" },
    });

    const myPhone = `+27${suffix}1`;
    me = await prisma.person.create({
      data: {
        phoneHash: hashPhone(myPhone),
        phoneEncrypted: encryptPhone(myPhone),
        firstName: "Allan",
        consentGivenAt: new Date(),
        consentVersion: "web-v2",
      },
    });
    const otherPhone = `+27${suffix}2`;
    someoneElse = await prisma.person.create({
      data: { phoneHash: hashPhone(otherPhone), phoneEncrypted: encryptPhone(otherPhone), firstName: "Nobody" },
    });

    const mineAtA = await member(me, brandA);
    await member(me, brandB);
    const theirs = await member(someoneElse, brandA);

    await prisma.pointsTransaction.createMany({
      data: [
        {
          brandId: brandA.id,
          brandMembershipId: mineAtA.id,
          campaignId: campaign.id,
          amount: 425,
          unit: "CENTS",
          reason: "PURCHASE_ACCRUAL",
        },
        {
          brandId: brandA.id,
          brandMembershipId: mineAtA.id,
          campaignId: campaign.id,
          amount: -100,
          unit: "CENTS",
          reason: "WALLET_SPENT",
        },
        {
          brandId: brandA.id,
          brandMembershipId: theirs.id,
          campaignId: campaign.id,
          amount: 9999,
          unit: "CENTS",
          reason: "PURCHASE_ACCRUAL",
        },
      ],
    });

    await createSession(me.id);
  });

  afterAll(async () => {
    for (const brand of [brandA, brandB]) {
      await prisma.pointsTransaction.deleteMany({ where: { brandId: brand.id } });
      await prisma.brandMembership.deleteMany({ where: { brandId: brand.id } });
      await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
      await prisma.brand.delete({ where: { id: brand.id } });
    }
    await prisma.person.deleteMany({ where: { id: { in: [me.id, someoneElse.id] } } });
  });

  it("exports the phone number in the clear", async () => {
    // It is stored encrypted, and the person asking is the person it belongs
    // to. An export that withheld it would answer a different question than
    // the one that was asked.
    const data = await exportPerson(me.id);
    expect(data?.you.phone).toBe(`+27${suffix}1`);
    expect(data?.you.consent.version).toBe("web-v2");
  });

  it("exports every brand, with balances that match the rows beneath them", async () => {
    const data = await exportPerson(me.id);
    expect(data?.brands.map((b) => b.brand).sort()).toEqual(["Campari", "Licken"]);

    const licken = data!.brands.find((b) => b.brand === "Licken")!;
    // 425 earned less 100 spent. Derived from the listed rows, never stored,
    // so the summary cannot contradict the detail printed under it.
    expect(licken.balances).toEqual([{ unit: "CENTS", amount: 325 }]);
    expect(licken.activity).toHaveLength(2);
  });

  it("never exports another person's rows", async () => {
    // The failure that would matter most: a privacy feature that leaks.
    const data = await exportPerson(me.id);
    const amounts = data!.brands.flatMap((b) => b.activity.map((a) => a.amount));
    expect(amounts).not.toContain(9999);
  });

  it("lists sign-ins so an ended session can still be accounted for", async () => {
    const data = await exportPerson(me.id);
    expect(data!.signIns.length).toBeGreaterThan(0);
  });

  it("opts out of one brand without touching the other", async () => {
    expect(await setOptOut(me.id, brandA.id, true)).toBe(true);

    const programmes = await listProgrammes(me.id);
    expect(programmes.find((p) => p.brandName === "Licken")?.optedOutAt).toBeInstanceOf(Date);
    expect(programmes.find((p) => p.brandName === "Campari")?.optedOutAt).toBeNull();
  });

  it("leaves the balance exactly where it was", async () => {
    // The fear that stops people opting out, and it is unfounded by design:
    // withdrawal is a flag, never a deletion.
    const data = await exportPerson(me.id);
    const licken = data!.brands.find((b) => b.brand === "Licken")!;
    expect(licken.balances).toEqual([{ unit: "CENTS", amount: 325 }]);
    expect(licken.optedOut).not.toBeNull();
  });

  it("lets them rejoin and find it there", async () => {
    expect(await setOptOut(me.id, brandA.id, false)).toBe(true);
    const programmes = await listProgrammes(me.id);
    expect(programmes.find((p) => p.brandName === "Licken")?.optedOutAt).toBeNull();
  });

  it("refuses to opt somebody else out", async () => {
    // brandId arrives from a form. personId never does — it comes from the
    // verified session, and the membership is resolved through the consumer
    // lens before anything is written.
    expect(await setOptOut(someoneElse.id, brandB.id, true)).toBe(false);

    const programmes = await listProgrammes(me.id);
    expect(programmes.find((p) => p.brandName === "Campari")?.optedOutAt).toBeNull();
  });
});
