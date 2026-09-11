import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { SMS_CONSENT_VERSION } from "@/lib/consumer/consent";
import { generatePackCode, formatPackCode } from "@/lib/packs/code";
import { hashPhone } from "@/lib/security/crypto";
import { handleInboundSms, SCAN_FAILURE_REPLY } from "@/lib/sms/inbound";

/**
 * The no-data channel, driven the way a network drives it: a number and a
 * string, nothing else.
 *
 * Two things are being proved. The first is that the channel does what a
 * shopper needs - joins, earns, reports a balance - through the same engine
 * calls the web uses, so a rule fixed once is fixed everywhere. The second
 * matters more and is easier to lose in a refactor: that it *refuses* the
 * operations a spoofable identifier must not be trusted with. A test that
 * only covers the happy path would stay green through the change that turns
 * this into a way to empty a stranger's balance from a burner handset.
 */
describe("inbound SMS", () => {
  const suffix = Date.now();
  // Distinct numbers per case, because the rate limiter counts per number
  // and a shared one would make the order of these tests load-bearing.
  const KNOWN = `+2782${String(suffix).slice(-7)}`;
  const STRANGER = `+2783${String(suffix).slice(-7)}`;
  const JOINER = `+2784${String(suffix).slice(-7)}`;
  const THROTTLED = `+2785${String(suffix).slice(-7)}`;

  /**
   * Every send moves the clock on by more than the throttle window.
   *
   * The limiter counts replies per number over ten minutes, which is
   * generous for a person and immediately exhausted by a test that sends
   * twenty messages from one handset in a second. Advancing the clock keeps
   * each case independent without needing a fresh number per assertion, and
   * it exercises the limiter's window rather than working around it - the
   * one test that means to trip it holds the clock still instead.
   */
  let clock = new Date("2026-03-01T08:00:00Z");
  function send(message: { from: string; text: string }) {
    clock = new Date(clock.getTime() + 11 * 60 * 1000);
    return handleInboundSms(message, clock);
  }

  let brand: Brand;
  let campaign: Campaign;
  let knownPersonId: string;

  async function makeCode(): Promise<string> {
    const code = generatePackCode();
    const batch = await prisma.packBatch.create({
      data: { brandId: brand.id, campaignId: campaign.id, label: `sms-${code.slice(0, 4)}`, quantity: 1 },
    });
    await prisma.packCode.create({
      data: { brandId: brand.id, campaignId: campaign.id, batchId: batch.id, code, status: "UNSCANNED" },
    });
    return code;
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Texted Brand", slug: `texted-${suffix}` } });
    campaign = await prisma.campaign.create({
      data: { brandId: brand.id, name: "On-pack code", status: "ACTIVE" },
    });
    await prisma.earnRule.create({
      data: { brandId: brand.id, campaignId: campaign.id, type: "FLAT_PER_SCAN", unit: "CENTS", amount: 2500 },
    });

    const known = await prisma.person.create({
      data: { phoneHash: hashPhone(KNOWN), phoneEncrypted: "x", consentGivenAt: new Date(), consentVersion: "web-v3" },
    });
    knownPersonId = known.id;
  });

  afterAll(async () => {
    const hashes = [KNOWN, STRANGER, JOINER, THROTTLED].map(hashPhone);
    const people = await prisma.person.findMany({ where: { phoneHash: { in: hashes } }, select: { id: true } });
    const personIds = people.map((p) => p.id);

    await prisma.pointsTransaction.deleteMany({ where: { brandId: brand.id } });
    await prisma.packCode.deleteMany({ where: { brandId: brand.id } });
    await prisma.packBatch.deleteMany({ where: { brandId: brand.id } });
    await prisma.earnRule.deleteMany({ where: { brandId: brand.id } });
    await prisma.brandMembership.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.brand.deleteMany({ where: { id: brand.id } });
    await prisma.rateLimit.deleteMany({ where: { key: { in: hashes.map((h) => `sms-inbound:${h}`) } } });
  });

  describe("a number we have never seen", () => {
    it("is told how to join rather than quietly given an account", async () => {
      const { command, reply } = await send({ from: STRANGER, text: "BALANCE" });

      expect(command).toBe("BALANCE");
      expect(reply).toContain("reply YES to join");
      // The point of the test. A channel that creates an account from an
      // inbound message has manufactured a consent record out of a packet.
      expect(await prisma.person.findUnique({ where: { phoneHash: hashPhone(STRANGER) } })).toBeNull();
    });

    it("does not spend a code it cannot award", async () => {
      const code = await makeCode();
      await send({ from: STRANGER, text: formatPackCode(code) });

      const row = await prisma.packCode.findFirst({ where: { code } });
      expect(row?.status).toBe("UNSCANNED");
    });
  });

  describe("joining", () => {
    it("creates the account under the version they actually read", async () => {
      const { command, reply } = await send({ from: JOINER, text: "yes" });

      expect(command).toBe("JOIN");
      expect(reply).toContain("You're on");

      const person = await prisma.person.findUnique({ where: { phoneHash: hashPhone(JOINER) } });
      // Not web-v3. Stamping an SMS joiner with the web version would answer
      // "what did they agree to" with a document they never saw.
      expect(person?.consentVersion).toBe(SMS_CONSENT_VERSION);
      expect(person?.consentGivenAt).toBeInstanceOf(Date);
    });

    it("leaves an existing consent record alone", async () => {
      const before = await prisma.person.findUnique({ where: { phoneHash: hashPhone(KNOWN) } });
      await send({ from: KNOWN, text: "YES" });
      const after = await prisma.person.findUnique({ where: { phoneHash: hashPhone(KNOWN) } });

      expect(after?.consentVersion).toBe("web-v3");
      expect(after?.consentGivenAt?.getTime()).toBe(before?.consentGivenAt?.getTime());
    });
  });

  describe("earning", () => {
    it("awards through the same engine call the web uses", async () => {
      const code = await makeCode();
      const { command, reply } = await send({ from: KNOWN, text: formatPackCode(code) });

      expect(command).toBe("CODE");
      expect(reply).toContain("R25.00 added");
      expect(reply).toContain("Texted Brand");

      const ledger = await prisma.pointsTransaction.aggregate({
        where: { brandId: brand.id, brandMembership: { personId: knownPersonId } },
        _sum: { amount: true },
      });
      expect(ledger._sum.amount).toBe(2500);
    });

    it("accepts the code however it was typed", async () => {
      const code = await makeCode();
      const { reply } = await send({ from: KNOWN, text: `  ${formatPackCode(code).toLowerCase()} ` });
      expect(reply).toContain("added");
    });

    it("accepts a code sent after a keyword the poster invented", async () => {
      const code = await makeCode();
      const { reply } = await send({ from: KNOWN, text: `CODE ${code}` });
      expect(reply).toContain("added");
    });

    it("says a used code is used, and says nothing was taken", async () => {
      const code = await makeCode();
      await send({ from: KNOWN, text: code });
      // A second sender, so this is a genuine reuse rather than the same
      // person being shown their own award again.
      await send({ from: JOINER, text: code });
      const { reply } = await send({ from: JOINER, text: code });

      expect(reply).toMatch(/already been used|already earned/);
    });

    it("tells an unknown code apart from a used one, and keeps the reply short", async () => {
      const { reply } = await send({ from: KNOWN, text: "ZZZZ-ZZZZ-ZZZZ" });

      expect(reply).toContain("don't recognise");
      // Case-insensitive: the reassurance is the point, and whether it opens
      // a sentence or continues one is a punctuation decision the copy is
      // allowed to change without this test having an opinion.
      expect(reply.toLowerCase()).toContain("nothing has been used");
      expect(reply.length).toBeLessThanOrEqual(160);
    });
  });

  describe("balance", () => {
    it("names the brand and the amount", async () => {
      const { command, reply } = await send({ from: KNOWN, text: "balance" });

      expect(command).toBe("BALANCE");
      expect(reply).toContain("Texted Brand");
      expect(reply).toMatch(/R\d/);
    });

    it("reads through the same lens the web wallet uses, so it cannot leak another brand", async () => {
      const other = await prisma.brand.create({ data: { name: "Unrelated", slug: `unrelated-${suffix}` } });
      const stranger = await prisma.person.create({
        data: { phoneHash: `sms-other-${suffix}`, phoneEncrypted: "x" },
      });
      await prisma.brandMembership.create({ data: { brandId: other.id, personId: stranger.id } });

      const { reply } = await send({ from: KNOWN, text: "BALANCE" });
      expect(reply).not.toContain("Unrelated");

      await prisma.brandMembership.deleteMany({ where: { personId: stranger.id } });
      await prisma.person.delete({ where: { id: stranger.id } });
      await prisma.brand.delete({ where: { id: other.id } });
    });

    it("does not send a transaction history", async () => {
      // Narrower than the web wallet on purpose - see handleBalance(). An
      // SMS sits in an inbox on a handset that is often shared, and a list
      // of scans is a movement record rather than the amount that was asked
      // for. If this ever starts listing stores, it should be a decision
      // somebody made, not a line that slipped into a template.
      const { reply } = await send({ from: KNOWN, text: "BALANCE" });
      expect(reply).not.toMatch(/\d{1,2} \w{3} 20\d\d/);
      expect(reply.length).toBeLessThanOrEqual(160);
    });
  });

  describe("what it refuses", () => {
    it("will not opt anybody out, however they phrase it", async () => {
      await prisma.brandMembership.upsert({
        where: { brandId_personId: { brandId: brand.id, personId: knownPersonId } },
        create: { brandId: brand.id, personId: knownPersonId },
        update: {},
      });

      for (const text of ["STOP", "CANCEL", "UNSUBSCRIBE", "OPTOUT"]) {
        const { command } = await send({ from: KNOWN, text });
        expect(command).toBe("STOP");
      }

      const membership = await prisma.brandMembership.findUnique({
        where: { brandId_personId: { brandId: brand.id, personId: knownPersonId } },
      });
      // The whole point: a spoofed STOP must not be able to take somebody
      // out of a programme, or stop the codes they need to sign in.
      expect(membership?.optedOutAt).toBeNull();
    });

    it("explains what STOP does instead of pretending it worked", async () => {
      const { reply } = await send({ from: KNOWN, text: "STOP" });
      expect(reply).toContain("nothing to unsubscribe from");
    });

    it("answers a number it cannot place without touching the database", async () => {
      const { command, reply } = await send({ from: "+15551234567", text: "BALANCE" });

      expect(command).toBe("UNREADABLE");
      expect(reply).toContain("South African mobile numbers");
    });

    it("goes silent rather than paying to say it is busy", async () => {
      // handleInboundSms directly, not send(): this is the one case that
      // wants the clock held still, because a stuck sender is exactly what
      // the limiter exists for.
      const fixed = new Date("2026-03-02T09:00:00Z");
      let last = await handleInboundSms({ from: THROTTLED, text: "HELP" }, fixed);
      for (let i = 0; i < 12 && last.command !== "THROTTLED"; i += 1) {
        last = await handleInboundSms({ from: THROTTLED, text: "HELP" }, fixed);
      }

      expect(last.command).toBe("THROTTLED");
      // An apology is a message the brand pays for. A throttle that replies
      // has doubled the traffic it was meant to cap.
      expect(last.reply).toBe("");
    });
  });

  describe("what every reply costs", () => {
    it("fits one segment, for every reason a code can fail", async () => {
      // Each of these is a message the brand pays for, and a segment is 160
      // GSM-7 characters. A reply that spills to 161 costs double for one
      // word, which nobody notices until an invoice.
      //
      // Checked against the table rather than by driving fourteen scans,
      // because the thing under test is the copy, not the dispatch.
      for (const [reason, text] of Object.entries(SCAN_FAILURE_REPLY)) {
        expect(text.length, `${reason} is ${text.length} characters`).toBeLessThanOrEqual(160);
      }
    });

    it("keeps every other reply inside a segment too", async () => {
      const replies = await Promise.all([
        send({ from: KNOWN, text: "HELP" }),
        send({ from: KNOWN, text: "BALANCE" }),
        send({ from: KNOWN, text: "STOP" }),
        send({ from: KNOWN, text: "ZZZZ-ZZZZ-ZZZZ" }),
      ]);

      for (const { command, reply } of replies) {
        expect(reply.length, `${command} is ${reply.length} characters`).toBeLessThanOrEqual(160);
      }

      // TERMS and the join notice are the two deliberate exceptions: one is
      // somebody asking for the detail, the other is all a person will have
      // read when they agree. Both are allowed to run long, and both would
      // be pointless cut to fit.
      const terms = await send({ from: KNOWN, text: "TERMS" });
      expect(terms.reply.length).toBeGreaterThan(160);
    });
  });

  describe("help and terms", () => {
    it("tells a stranger to join and a member what to send", async () => {
      const stranger = await send({ from: STRANGER, text: "HELP" });
      const member = await send({ from: KNOWN, text: "?" });

      expect(stranger.reply).toContain("reply YES to join");
      expect(member.reply).toContain("BALANCE");
      expect(member.reply.length).toBeLessThanOrEqual(160);
    });

    it("sends the full notice on request rather than a link nobody can open", async () => {
      const { command, reply } = await send({ from: KNOWN, text: "TERMS" });

      expect(command).toBe("TERMS");
      expect(reply).toContain("What we keep");
      expect(reply).toContain("What brands can see");
      // The channel exists for people who cannot open a web page.
      expect(reply).not.toMatch(/https?:\/\//);
    });
  });
});
