import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, Person } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { erasePerson } from "@/lib/consumer/erase";
import { OTP_RETENTION_MS, sweepExpiredPasscodes } from "@/lib/consumer/otp";
import { MIN_DORMANT_DAYS, dormancyWindowDays, sweepDormantShoppers } from "@/lib/consumer/dormancy";
import { createSession } from "@/lib/consumer/session";
import { encryptPhone, hashPhone } from "@/lib/security/crypto";

/**
 * What is kept, and for how long.
 *
 * POPIA section 14 says records must not be kept longer than is necessary
 * for the purpose they were collected for. PhoneOtp had no sweep at all, so
 * it was a permanent log of every sign-in attempt ever made, keyed on the
 * HMAC of a phone number - and it survived an erasure request, which made it
 * a way to prove an erased number had used the service.
 */
describe("what a passcode row leaves behind", () => {
  const suffix = Date.now();
  const MY_PHONE = `+2784${String(suffix).slice(-7)}`;
  const OTHER_PHONE = `+2785${String(suffix).slice(-7)}`;

  let me: Person;

  async function passcode(phone: string, ageMs: number) {
    const expiresAt = new Date(Date.now() - ageMs);
    return prisma.phoneOtp.create({
      data: { phoneHash: hashPhone(phone), codeHash: "x", expiresAt, consumedAt: expiresAt },
    });
  }

  beforeAll(async () => {
    me = await prisma.person.create({
      data: { phoneHash: hashPhone(MY_PHONE), phoneEncrypted: encryptPhone(MY_PHONE) },
    });
  });

  afterAll(async () => {
    await prisma.phoneOtp.deleteMany({ where: { phoneHash: { in: [hashPhone(MY_PHONE), hashPhone(OTHER_PHONE)] } } });
    await prisma.rateLimit.deleteMany({ where: { key: { contains: hashPhone(MY_PHONE) } } });
    await prisma.shopperSession.deleteMany({ where: { personId: me.id } });
    await prisma.person.delete({ where: { id: me.id } });
  });

  describe("the nightly sweep", () => {
    it("keeps a passcode that has not aged out yet", async () => {
      const row = await passcode(OTHER_PHONE, 24 * 60 * 60 * 1000);
      await sweepExpiredPasscodes();
      expect(await prisma.phoneOtp.findUnique({ where: { id: row.id } })).not.toBeNull();
      await prisma.phoneOtp.delete({ where: { id: row.id } });
    });

    it("deletes one that is past the retention window", async () => {
      const row = await passcode(OTHER_PHONE, OTP_RETENTION_MS + 60_000);
      await sweepExpiredPasscodes();
      expect(await prisma.phoneOtp.findUnique({ where: { id: row.id } })).toBeNull();
    });

    it("leaves a live code alone, which is the one that must survive", async () => {
      // Expiry in the future. A sweep that took these would sign everybody
      // out mid-login, and the window is wide enough that this could only
      // ever happen through a sign error - which is exactly why it is here.
      const row = await prisma.phoneOtp.create({
        data: { phoneHash: hashPhone(OTHER_PHONE), codeHash: "x", expiresAt: new Date(Date.now() + 600_000) },
      });
      await sweepExpiredPasscodes();
      expect(await prisma.phoneOtp.findUnique({ where: { id: row.id } })).not.toBeNull();
      await prisma.phoneOtp.delete({ where: { id: row.id } });
    });
  });

  describe("erasure", () => {
    it("takes the passcode trail with it", async () => {
      const hash = hashPhone(MY_PHONE);
      await passcode(MY_PHONE, 60_000);
      await passcode(MY_PHONE, 120_000);
      await prisma.rateLimit.create({
        data: { key: `otp:send:${hash}`, count: 2, resetAt: new Date(Date.now() + 600_000) },
      });

      const result = await erasePerson(me.id);
      expect(result.passcodesDeleted).toBe(2);

      /*
       * The point of the whole test.
       *
       * phoneHash is a deterministic HMAC of the real number, and erasure
       * works by overwriting Person.phoneHash with a value no number can
       * hash to. If the original hash survives in a neighbouring table, then
       * anyone who can compute it can take the erased number, hash it, and
       * find rows proving it used Qumo and when - which is the thing the
       * overwrite exists to make impossible.
       */
      expect(await prisma.phoneOtp.count({ where: { phoneHash: hash } })).toBe(0);
      expect(await prisma.rateLimit.count({ where: { key: { contains: hash } } })).toBe(0);
    });

    it("does not take anybody else's", async () => {
      const row = await passcode(OTHER_PHONE, 60_000);
      await erasePerson(me.id);
      expect(await prisma.phoneOtp.findUnique({ where: { id: row.id } })).not.toBeNull();
      await prisma.phoneOtp.delete({ where: { id: row.id } });
    });
  });
});

describe("letting go of a shopper who stopped coming", () => {
  const suffix = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const WINDOW_DAYS = 1095;
  const LONG_AGO = new Date(Date.now() - 1500 * DAY);
  const RECENTLY = new Date(Date.now() - 10 * DAY);

  let brand: Brand;
  let campaign: Campaign;
  const made: string[] = [];

  /**
   * A person created long enough ago to be a candidate. Everything that
   * saves them from the sweep is then added on top, one test at a time.
   */
  async function dormantSince(label: string): Promise<Person> {
    const phone = `+2787${String(Date.now()).slice(-7)}${made.length}`;
    const person = await prisma.person.create({
      data: {
        phoneHash: `dorm-${label}-${suffix}`,
        phoneEncrypted: encryptPhone(phone),
        firstName: "Dormant",
        createdAt: LONG_AGO,
        consentGivenAt: LONG_AGO,
      },
    });
    made.push(person.id);
    return person;
  }

  async function membershipFor(personId: string) {
    return prisma.brandMembership.create({ data: { brandId: brand.id, personId } });
  }

  async function sweep() {
    process.env.QUMO_DORMANT_ERASE_AFTER_DAYS = String(WINDOW_DAYS);
    try {
      return await sweepDormantShoppers();
    } finally {
      delete process.env.QUMO_DORMANT_ERASE_AFTER_DAYS;
    }
  }

  async function wasErased(personId: string): Promise<boolean> {
    const row = await prisma.person.findUnique({ where: { id: personId }, select: { erasedAt: true } });
    return row?.erasedAt != null;
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Dormancy", slug: `dorm-${suffix}` } });
    campaign = await prisma.campaign.create({ data: { brandId: brand.id, name: "Dorm", status: "ACTIVE" } });
  });

  afterAll(async () => {
    await prisma.coupon.deleteMany({ where: { brandId: brand.id } });
    await prisma.reward.deleteMany({ where: { brandId: brand.id } });
    await prisma.pointsTransaction.deleteMany({ where: { brandId: brand.id } });
    await prisma.shopperSession.deleteMany({ where: { personId: { in: made } } });
    await prisma.brandMembership.deleteMany({ where: { brandId: brand.id } });
    await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
    await prisma.brand.delete({ where: { id: brand.id } });
    await prisma.person.deleteMany({ where: { id: { in: made } } });
  });

  describe("the window", () => {
    it("does nothing at all until somebody sets one", async () => {
      // The default has to be inert. A retention rule is a decision with a
      // date on it, and a sweep that picks its own number is not one.
      delete process.env.QUMO_DORMANT_ERASE_AFTER_DAYS;
      expect(await sweepDormantShoppers()).toEqual({ ran: false, reason: "not_configured" });
    });

    it("refuses a window under a year rather than clamping it", async () => {
      // "30" where somebody meant "1095" would erase most of a customer
      // base overnight, irreversibly, through a cron nobody is watching.
      // Clamping would carry out an instruction nobody meant to give.
      expect(dormancyWindowDays("30")).toBeNull();
      expect(dormancyWindowDays(String(MIN_DORMANT_DAYS - 1))).toBeNull();
      expect(dormancyWindowDays("1095")).toBe(1095);
      expect(dormancyWindowDays("  ")).toBeNull();
      expect(dormancyWindowDays("ten years")).toBeNull();
      expect(dormancyWindowDays("1095.5")).toBeNull();

      process.env.QUMO_DORMANT_ERASE_AFTER_DAYS = "30";
      try {
        expect(await sweepDormantShoppers()).toEqual({ ran: false, reason: "window_too_short" });
      } finally {
        delete process.env.QUMO_DORMANT_ERASE_AFTER_DAYS;
      }
    });
  });

  describe("who it takes", () => {
    it("erases somebody who has done nothing at all inside the window", async () => {
      const person = await dormantSince("plain");
      await sweep();
      expect(await wasErased(person.id)).toBe(true);
    });

    it("erases a member whose last scan is older than the window", async () => {
      const person = await dormantSince("stale");
      const membership = await membershipFor(person.id);
      await prisma.pointsTransaction.create({
        data: {
          brandId: brand.id,
          brandMembershipId: membership.id,
          campaignId: campaign.id,
          amount: 100,
          unit: "CENTS",
          reason: "PACK_SCAN_AWARDED",
          createdAt: LONG_AGO,
        },
      });
      await sweep();
      expect(await wasErased(person.id)).toBe(true);
    });
  });

  describe("who it leaves alone", () => {
    it("spares somebody who earned something recently", async () => {
      const person = await dormantSince("earner");
      const membership = await membershipFor(person.id);
      await prisma.pointsTransaction.create({
        data: {
          brandId: brand.id,
          brandMembershipId: membership.id,
          campaignId: campaign.id,
          amount: 100,
          unit: "CENTS",
          reason: "PACK_SCAN_AWARDED",
          createdAt: RECENTLY,
        },
      });
      await sweep();
      expect(await wasErased(person.id)).toBe(false);
    });

    it("spares somebody who only opened the wallet to look", async () => {
      // Checking a balance leaves no ledger row. Somebody looking at their
      // stamps is plainly still using this, and a sweep that reads only the
      // ledger would erase them.
      const person = await dormantSince("looker");
      await createSession(person.id);
      await sweep();
      expect(await wasErased(person.id)).toBe(false);
    });

    it("spares somebody still holding a reward they could claim", async () => {
      // Dormant or not, they own something here, and erasing them would
      // leave a coupon code nobody can ever be matched to.
      const person = await dormantSince("holder");
      const membership = await membershipFor(person.id);
      const reward = await prisma.reward.create({
        data: { brandId: brand.id, campaignId: campaign.id, rewardName: "Free coffee" },
      });
      await prisma.coupon.create({
        data: {
          brandId: brand.id,
          campaignId: campaign.id,
          rewardId: reward.id,
          brandMembershipId: membership.id,
          code: `DORM${suffix}`.slice(0, 16),
          status: "ISSUED",
          expiresAt: new Date(Date.now() + 90 * DAY),
        },
      });
      await sweep();
      expect(await wasErased(person.id)).toBe(false);
    });

    it("does not spare somebody whose reward has already expired", async () => {
      const person = await dormantSince("lapsed");
      const membership = await membershipFor(person.id);
      // Its own campaign: Reward.campaignId is unique, so a brand gets one
      // reward per promotion and the test above already took this one's.
      const other = await prisma.campaign.create({
        data: { brandId: brand.id, name: "Dorm lapsed", status: "ACTIVE" },
      });
      const reward = await prisma.reward.create({
        data: { brandId: brand.id, campaignId: other.id, rewardName: "Gone" },
      });
      await prisma.coupon.create({
        data: {
          brandId: brand.id,
          campaignId: other.id,
          rewardId: reward.id,
          brandMembershipId: membership.id,
          code: `LAPS${suffix}`.slice(0, 16),
          status: "ISSUED",
          expiresAt: LONG_AGO,
        },
      });
      await sweep();
      expect(await wasErased(person.id)).toBe(true);
    });

    it("spares an account made yesterday that has not scanned anything yet", async () => {
      const person = await prisma.person.create({
        data: {
          phoneHash: `dorm-new-${suffix}`,
          phoneEncrypted: encryptPhone(`+27880000${made.length}`),
          consentGivenAt: RECENTLY,
        },
      });
      made.push(person.id);
      await sweep();
      expect(await wasErased(person.id)).toBe(false);
    });
  });
});
