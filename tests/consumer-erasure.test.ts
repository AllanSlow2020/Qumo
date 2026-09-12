import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, Person } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { erasePerson } from "@/lib/consumer/erase";
import { exportPerson } from "@/lib/consumer/export";
import { getWallet } from "@/lib/consumer/wallet";
import { createSession, resolveSessionToken } from "@/lib/consumer/session";
import { decryptPhone, encryptPhone, hashPhone } from "@/lib/security/crypto";

/**
 * Deleting an account, proved from the two sides that disagree about what
 * deletion should mean.
 *
 * The shopper's side is simple: afterwards nothing in the system can turn
 * their number into their history, and the number itself is free.
 *
 * The brand's side is the one that makes this design rather than a DELETE.
 * A brand's record of what it issued cannot move because somebody left, so
 * the tests below check the totals before and after and expect them
 * identical. If a future change makes erasure cascade, the shopper tests
 * would all still pass and these are the ones that would go red.
 */
describe("erasing a shopper", () => {
  const suffix = Date.now();
  const MY_PHONE = `+2782${String(suffix).slice(-7)}`;
  const THEIR_PHONE = `+2783${String(suffix).slice(-7)}`;

  let brand: Brand;
  let campaign: Campaign;
  let me: Person;
  let someoneElse: Person;
  let myMembershipId: string;
  let myToken: string;

  /** What the brand's books say, which is the number that must not move. */
  async function issuedByBrand(): Promise<number> {
    const { _sum } = await prisma.pointsTransaction.aggregate({
      where: { brandId: brand.id },
      _sum: { amount: true },
    });
    return _sum.amount ?? 0;
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Erasable", slug: `erase-${suffix}` } });
    campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "5% back", status: "ACTIVE" },
    });

    me = await prisma.person.create({
      data: {
        phoneHash: hashPhone(MY_PHONE),
        phoneEncrypted: encryptPhone(MY_PHONE),
        firstName: "Allan",
        suburb: "Sea Point",
        consentGivenAt: new Date(),
        consentVersion: "web-v4",
      },
    });
    someoneElse = await prisma.person.create({
      data: { phoneHash: hashPhone(THEIR_PHONE), phoneEncrypted: encryptPhone(THEIR_PHONE), firstName: "Someone" },
    });

    const mine = await prisma.brandMembership.create({ data: { brandId: brand.id, personId: me.id } });
    myMembershipId = mine.id;
    const theirs = await prisma.brandMembership.create({ data: { brandId: brand.id, personId: someoneElse.id } });

    await prisma.pointsTransaction.createMany({
      data: [
        { brandId: brand.id, brandMembershipId: mine.id, amount: 2500, unit: "CENTS", reason: "PACK_SCAN_AWARDED", campaignId: campaign.id },
        { brandId: brand.id, brandMembershipId: mine.id, amount: 1000, unit: "CENTS", reason: "PACK_SCAN_AWARDED", campaignId: campaign.id },
        { brandId: brand.id, brandMembershipId: theirs.id, amount: 700, unit: "CENTS", reason: "PACK_SCAN_AWARDED", campaignId: campaign.id },
      ],
    });

    myToken = await createSession(me.id);
    await createSession(me.id);
  });

  afterAll(async () => {
    await prisma.pointsTransaction.deleteMany({ where: { brandId: brand.id } });
    await prisma.shopperSession.deleteMany({ where: { personId: { in: [me.id, someoneElse.id] } } });
    await prisma.brandMembership.deleteMany({ where: { personId: { in: [me.id, someoneElse.id] } } });
    await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
    await prisma.person.deleteMany({ where: { id: { in: [me.id, someoneElse.id] } } });
    await prisma.brand.deleteMany({ where: { id: brand.id } });
  });

  describe("before it runs", () => {
    it("is a normal account with a history and a live session", async () => {
      expect((await resolveSessionToken(myToken))?.personId).toBe(me.id);
      expect(await getWallet(me.id)).toHaveLength(1);
      expect(await issuedByBrand()).toBe(4200);
    });
  });

  describe("the shopper's side", () => {
    let issuedBefore: number;

    beforeAll(async () => {
      issuedBefore = await issuedByBrand();
      await erasePerson(me.id);
    });

    it("leaves nothing that can turn the row back into a person", async () => {
      const row = await prisma.person.findUnique({ where: { id: me.id } });

      expect(row?.firstName).toBeNull();
      expect(row?.suburb).toBeNull();
      expect(row?.erasedAt).toBeInstanceOf(Date);
      // Not merely blanked - overwritten with something no phone number can
      // hash to, which is what makes every lookup in the system miss it
      // without any of them having to check a flag.
      expect(row?.phoneHash).not.toBe(hashPhone(MY_PHONE));
      expect(row?.phoneHash).toMatch(/^erased:/);
    });

    it("cannot hand the number back, even to code that holds the key", async () => {
      const row = await prisma.person.findUnique({ where: { id: me.id } });
      // Loudly, rather than returning a plausible empty string that a
      // caller would carry on with.
      expect(() => decryptPhone(row!.phoneEncrypted)).toThrow();
    });

    it("ends every session, on every device", async () => {
      expect(await resolveSessionToken(myToken)).toBeNull();
      expect(await prisma.shopperSession.count({ where: { personId: me.id } })).toBe(0);
    });

    it("has nothing left to export", async () => {
      // The export reads by personId, which only a live session could have
      // supplied. Checked anyway: this is the one call whose whole job is
      // to disclose, so "there is nothing to disclose" is worth asserting
      // rather than assuming.
      const dump = JSON.stringify(await exportPerson(me.id));
      expect(dump).not.toContain("Allan");
      expect(dump).not.toContain("Sea Point");
      expect(dump).not.toContain(MY_PHONE);
    });

    it("frees the number, so signing in on it starts an empty account", async () => {
      // Two claims, and the second is the one that could silently fail. The
      // number no longer finds the old account - which is how login, the
      // SMS channel and anything added later all miss it without checking a
      // flag. And the hash is genuinely free: phoneHash is unique, so a row
      // that still held it would make this insert throw rather than give
      // somebody a fresh start.
      expect(await prisma.person.findUnique({ where: { phoneHash: hashPhone(MY_PHONE) } })).toBeNull();

      const fresh = await prisma.person.create({
        data: { phoneHash: hashPhone(MY_PHONE), phoneEncrypted: encryptPhone(MY_PHONE) },
      });
      expect(fresh.id).not.toBe(me.id);
      expect(await getWallet(fresh.id)).toHaveLength(0);

      await prisma.person.delete({ where: { id: fresh.id } });
    });

    it("is idempotent, because a form can be submitted twice", async () => {
      const before = await prisma.person.findUnique({ where: { id: me.id } });
      await erasePerson(me.id);
      const after = await prisma.person.findUnique({ where: { id: me.id } });

      // The second call must not re-stamp the date or mint a fresh hash;
      // either would rewrite the record of when erasure actually happened.
      expect(after?.erasedAt?.getTime()).toBe(before?.erasedAt?.getTime());
      expect(after?.phoneHash).toBe(before?.phoneHash);
    });

    it("does not touch anybody else", async () => {
      const them = await prisma.person.findUnique({ where: { id: someoneElse.id } });

      expect(them?.firstName).toBe("Someone");
      expect(them?.erasedAt).toBeNull();
      expect(decryptPhone(them!.phoneEncrypted)).toBe(THEIR_PHONE);
    });

    it("leaves the brand's books exactly where they were", async () => {
      // The whole reason this is erasure and not a delete. A cascade would
      // take 3,500 cents out of a quarter that has already closed.
      expect(await issuedByBrand()).toBe(issuedBefore);
    });
  });

  describe("the brand's side", () => {
    it("keeps the ledger rows, attached to a membership that names nobody", async () => {
      const rows = await prisma.pointsTransaction.findMany({
        where: { brandMembershipId: myMembershipId },
        select: { amount: true },
      });

      expect(rows.map((r) => r.amount).sort((a, b) => a - b)).toEqual([1000, 2500]);
    });

    it("can still read the membership, and finds an erased person behind it", async () => {
      const membership = await prisma.brandMembership.findUnique({
        where: { id: myMembershipId },
        include: { person: { select: { firstName: true, erasedAt: true } } },
      });

      // This is what a brand's own reporting sees. The row is there, the
      // money is right, and there is no one behind it.
      expect(membership).not.toBeNull();
      expect(membership?.person.firstName).toBeNull();
      expect(membership?.person.erasedAt).toBeInstanceOf(Date);
    });
  });
});
