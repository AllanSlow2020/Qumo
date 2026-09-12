import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { demoLoginEnabled, isDemoLogin, isDemoPhone } from "@/lib/consumer/demo-login";
import { requestOtp, verifyOtp, OtpError } from "@/lib/consumer/otp";
import { hashPhone } from "@/lib/security/crypto";
import type { SmsClient } from "@/lib/sms/client";

/**
 * A bypass is only acceptable if its edges are known, so this file is
 * mostly about what it does *not* do. Every test here fails loudly if the
 * hole ever gets wider: an unlisted number, a wrong code, or a deployment
 * that only half-configured it.
 */
class CountingSms implements SmsClient {
  sent: string[] = [];
  async sendSms(to: string): Promise<void> {
    this.sent.push(to);
  }
}

const LISTED = "0821110001";
const LISTED_E164 = "+27821110001";
const UNLISTED = "0821110002";
const CODE = "424242";

function configure(phones: string | undefined, code: string | undefined) {
  if (phones === undefined) delete process.env.DEMO_LOGIN_PHONES;
  else process.env.DEMO_LOGIN_PHONES = phones;
  if (code === undefined) delete process.env.DEMO_LOGIN_CODE;
  else process.env.DEMO_LOGIN_CODE = code;
}

describe("lib/consumer/demo-login", () => {
  const original = { phones: process.env.DEMO_LOGIN_PHONES, code: process.env.DEMO_LOGIN_CODE };
  afterEach(() => configure(original.phones, original.code));

  it("is off unless both halves are set", () => {
    configure(undefined, undefined);
    expect(demoLoginEnabled()).toBe(false);
    configure(LISTED, undefined);
    expect(demoLoginEnabled()).toBe(false);
    configure(undefined, CODE);
    expect(demoLoginEnabled()).toBe(false);
    configure(LISTED, CODE);
    expect(demoLoginEnabled()).toBe(true);
  });

  it("refuses a code that is not six digits, rather than accepting a weaker one", () => {
    // A four-character code would still "work" if this only checked
    // equality, and would be a materially easier thing to guess.
    configure(LISTED, "1234");
    expect(demoLoginEnabled()).toBe(false);
    configure(LISTED, "not-a-code");
    expect(demoLoginEnabled()).toBe(false);
  });

  it("matches however the number was typed", () => {
    configure("082 111 0001", CODE);
    expect(isDemoPhone(LISTED_E164)).toBe(true);
    configure("+27821110001", CODE);
    expect(isDemoPhone(LISTED_E164)).toBe(true);
  });

  it("keeps the rest of the list when one entry is unusable", () => {
    configure("not-a-phone, 082 111 0001", CODE);
    expect(isDemoPhone(LISTED_E164)).toBe(true);
  });

  it("never matches a number that is not listed", () => {
    configure(LISTED, CODE);
    expect(isDemoLogin("+27821110002", CODE)).toBe(false);
    expect(isDemoPhone("+27821110002")).toBe(false);
  });

  it("never matches the wrong code, for a listed number", () => {
    configure(LISTED, CODE);
    expect(isDemoLogin(LISTED_E164, "000000")).toBe(false);
    expect(isDemoLogin(LISTED_E164, "")).toBe(false);
    expect(isDemoLogin(LISTED_E164, CODE)).toBe(true);
  });
});

describe("signing in with the demo passcode", () => {
  const original = { phones: process.env.DEMO_LOGIN_PHONES, code: process.env.DEMO_LOGIN_CODE };
  const created: string[] = [];

  beforeEach(() => configure(LISTED, CODE));

  afterEach(async () => {
    configure(original.phones, original.code);
    for (const hash of created) {
      await prisma.phoneOtp.deleteMany({ where: { phoneHash: hash } });
      await prisma.person.deleteMany({ where: { phoneHash: hash } });
      // The counters too, and this is the one that was missing.
      //
      // lib/security/rate-limit.ts moved from a Map in module scope to a
      // table, which was the right change and made its counters outlive the
      // process. These tests drive a fixed number through requestOtp and
      // verifyOtp several times each, so a second run of the suite inside
      // the same fifteen-minute window found the limit already spent and
      // failed with "Too many attempts".
      //
      // It looked like flakiness and was not: it was deterministic on the
      // second run. A test that only passes if nobody re-runs it is a test
      // that fails the first time CI retries a job.
      await prisma.rateLimit.deleteMany({
        where: { key: { in: [`otp:send:${hash}`, `otp:verify:${hash}`] } },
      });
    }
    created.length = 0;
  });

  it("signs a listed number in, and sends it no SMS", async () => {
    created.push(hashPhone(LISTED_E164));
    const sms = new CountingSms();

    await requestOtp(LISTED, sms);
    // No message goes out for a number on the list: there is nothing for a
    // handset to receive that the code below does not already cover.
    expect(sms.sent).toEqual([]);

    const person = await verifyOtp(LISTED, CODE, true);
    expect(person.phoneHash).toBe(hashPhone(LISTED_E164));
  });

  it("spends any live code, so the demo sign-in leaves nothing usable behind", async () => {
    const hash = hashPhone(LISTED_E164);
    created.push(hash);
    await requestOtp(LISTED, new CountingSms());
    await verifyOtp(LISTED, CODE, true);

    const live = await prisma.phoneOtp.count({ where: { phoneHash: hash, consumedAt: null } });
    expect(live).toBe(0);
  });

  it("still refuses an unlisted number given the same code", async () => {
    const hash = hashPhone("+27821110002");
    created.push(hash);
    const sms = new CountingSms();
    await requestOtp(UNLISTED, sms);
    // And it does get a real message, because it is a normal login.
    expect(sms.sent).toEqual(["+27821110002"]);

    await expect(verifyOtp(UNLISTED, CODE, true)).rejects.toThrow(OtpError);
  });

  it("still refuses a listed number without consent", async () => {
    created.push(hashPhone(LISTED_E164));
    // The bypass is on the passcode, not on anything else. Consent is
    // checked before it and stays checked.
    await expect(verifyOtp(LISTED, CODE, false)).rejects.toThrow(OtpError);
  });

  it("does nothing at all when the feature is off", async () => {
    configure(undefined, undefined);
    created.push(hashPhone(LISTED_E164));
    await requestOtp(LISTED, new CountingSms());
    await expect(verifyOtp(LISTED, CODE, true)).rejects.toThrow(OtpError);
  });
});
