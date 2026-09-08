import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { requestOtp, verifyOtp, OtpError } from "@/lib/consumer/otp";
import { WEB_CONSENT_VERSION } from "@/lib/consumer/consent";
import { InvalidPhoneNumberError } from "@/lib/consumer/phone";
import { hashPhone } from "@/lib/security/crypto";
import type { SmsClient } from "@/lib/sms/client";

/** Captures the passcode the way a handset would receive it. */
class FakeSmsClient implements SmsClient {
  sent: { to: string; message: string }[] = [];
  async sendSms(to: string, message: string): Promise<void> {
    this.sent.push({ to, message });
  }
  lastCode(): string {
    const last = this.sent.at(-1);
    if (!last) throw new Error("no SMS was sent");
    const match = last.message.match(/\b(\d{6})\b/);
    if (!match?.[1]) throw new Error(`no 6-digit code in: ${last.message}`);
    return match[1];
  }
}

class FailingSmsClient implements SmsClient {
  async sendSms(): Promise<void> {
    const { SmsSendError } = await import("@/lib/sms/client");
    throw new SmsSendError("provider exploded");
  }
}

// The rate limiter is in-memory and shared across this whole test file, so
// every test needs a phone number nobody else used - otherwise one test's
// three requests exhaust another's allowance and the failure looks like a
// logic bug.
let counter = 0;
const run = Date.now() % 100000;
function freshPhone(): string {
  counter += 1;
  return `08${String(run).padStart(5, "0")}${String(counter).padStart(3, "0")}`;
}

const usedPhones: string[] = [];
function trackedPhone(): string {
  const phone = freshPhone();
  usedPhones.push(phone);
  return phone;
}

describe("lib/consumer/otp", () => {
  afterAll(async () => {
    const hashes = usedPhones.map((p) => hashPhone(`+27${p.slice(1)}`));
    await prisma.phoneOtp.deleteMany({ where: { phoneHash: { in: hashes } } });
    await prisma.person.deleteMany({ where: { phoneHash: { in: hashes } } });
  });

  it("creates the Person on a first successful login", async () => {
    const phone = trackedPhone();
    const sms = new FakeSmsClient();

    await requestOtp(phone, sms);
    const person = await verifyOtp(phone, sms.lastCode(), true);

    expect(person.id).toBeTruthy();
    expect(person.consentGivenAt).toBeInstanceOf(Date);
    // Consent is stamped with a version, so an audit can say what wording
    // this person actually agreed to.
    // Names the wording actually shown - the WhatsApp door stamps "wa-v1"
    // for its own, different, script.
    expect(person.consentVersion).toBe(WEB_CONSENT_VERSION);
    // The plaintext number is never stored.
    expect(person.phoneEncrypted).not.toContain(phone);
  });

  it("returns the same Person on a second login rather than duplicating them", async () => {
    const phone = trackedPhone();
    const sms = new FakeSmsClient();

    await requestOtp(phone, sms);
    const first = await verifyOtp(phone, sms.lastCode(), true);

    await requestOtp(phone, sms);
    const second = await verifyOtp(phone, sms.lastCode(), true);

    expect(second.id).toBe(first.id);
  });

  it("normalises the number before hashing, so one person is one account", async () => {
    const phone = trackedPhone();
    const sms = new FakeSmsClient();

    await requestOtp(phone, sms);
    const viaLocal = await verifyOtp(phone, sms.lastCode(), true);

    // Same human, typed differently. Must not become a second account.
    const international = `+27${phone.slice(1)}`;
    await requestOtp(international, sms);
    const viaInternational = await verifyOtp(international, sms.lastCode(), true);

    expect(viaInternational.id).toBe(viaLocal.id);
  });

  it("stores a hash, never the code itself", async () => {
    const phone = trackedPhone();
    const sms = new FakeSmsClient();
    await requestOtp(phone, sms);

    const phoneHash = hashPhone(`+27${phone.slice(1)}`);
    const row = await prisma.phoneOtp.findFirst({ where: { phoneHash } });

    expect(row).not.toBeNull();
    expect(row?.codeHash).not.toBe(sms.lastCode());
    expect(row?.codeHash.length).toBe(64);
  });

  it("rejects a wrong code and burns an attempt", async () => {
    const phone = trackedPhone();
    const sms = new FakeSmsClient();
    await requestOtp(phone, sms);

    const wrong = sms.lastCode() === "000000" ? "111111" : "000000";
    await expect(verifyOtp(phone, wrong, true)).rejects.toThrow(OtpError);

    const phoneHash = hashPhone(`+27${phone.slice(1)}`);
    const row = await prisma.phoneOtp.findFirst({ where: { phoneHash } });
    expect(row?.attempts).toBe(1);
  });

  it("kills the code after too many wrong guesses, even if the right one arrives later", async () => {
    const phone = trackedPhone();
    const sms = new FakeSmsClient();
    await requestOtp(phone, sms);
    const realCode = sms.lastCode();

    const wrong = realCode === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i += 1) {
      await expect(verifyOtp(phone, wrong, true)).rejects.toThrow(OtpError);
    }

    // This is the guarantee: a million-value keyspace cannot be walked.
    await expect(verifyOtp(phone, realCode, true)).rejects.toThrow(OtpError);
  });

  it("makes a code single-use", async () => {
    const phone = trackedPhone();
    const sms = new FakeSmsClient();
    await requestOtp(phone, sms);
    const code = sms.lastCode();

    await verifyOtp(phone, code, true);
    await expect(verifyOtp(phone, code, true)).rejects.toThrow(OtpError);
  });

  it("invalidates the previous code when a new one is requested", async () => {
    const phone = trackedPhone();
    const sms = new FakeSmsClient();

    await requestOtp(phone, sms);
    const firstCode = sms.lastCode();

    await requestOtp(phone, sms);
    const secondCode = sms.lastCode();

    // A code glimpsed before the shopper asked for another must be dead.
    if (firstCode !== secondCode) {
      await expect(verifyOtp(phone, firstCode, true)).rejects.toThrow(OtpError);
    }
    await expect(verifyOtp(phone, secondCode, true)).resolves.toBeTruthy();
  });

  it("rejects an expired code", async () => {
    const phone = trackedPhone();
    const sms = new FakeSmsClient();
    await requestOtp(phone, sms);

    const phoneHash = hashPhone(`+27${phone.slice(1)}`);
    await prisma.phoneOtp.updateMany({
      where: { phoneHash, consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(verifyOtp(phone, sms.lastCode(), true)).rejects.toThrow(OtpError);
  });

  it("gives the same message whether the code is wrong or no code was ever sent", async () => {
    // Enumeration resistance: this endpoint must not reveal which numbers
    // currently have a login in progress.
    const neverRequested = trackedPhone();
    const requested = trackedPhone();
    const sms = new FakeSmsClient();
    await requestOtp(requested, sms);

    const wrong = sms.lastCode() === "000000" ? "111111" : "000000";
    const noCodeError = await verifyOtp(neverRequested, "123456", true).catch((e: Error) => e.message);
    const wrongCodeError = await verifyOtp(requested, wrong, true).catch((e: Error) => e.message);

    expect(noCodeError).toBe(wrongCodeError);
  });

  it("rate-limits repeated code requests for one number", async () => {
    const phone = trackedPhone();
    const sms = new FakeSmsClient();

    await requestOtp(phone, sms);
    await requestOtp(phone, sms);
    await requestOtp(phone, sms);

    await expect(requestOtp(phone, sms)).rejects.toThrow(OtpError);
    expect(sms.sent).toHaveLength(3);
  });

  it("surfaces a provider outage as something a shopper can understand", async () => {
    const phone = trackedPhone();
    await expect(requestOtp(phone, new FailingSmsClient())).rejects.toThrow(OtpError);
  });

  it("refuses to complete a login without consent", async () => {
    const phone = trackedPhone();
    const sms = new FakeSmsClient();
    await requestOtp(phone, sms);

    // The checkbox being `required` in the markup stops an honest mistake,
    // not a crafted request - so the server has to be the boundary.
    await expect(verifyOtp(phone, sms.lastCode(), false)).rejects.toThrow(OtpError);
    expect(await prisma.person.count({ where: { phoneHash: hashPhone(`+27${phone.slice(1)}`) } })).toBe(0);
  });

  it("asks for consent identically whether the account is new or returning", async () => {
    // Requiring it only of new accounts would leak which numbers already
    // have accounts - the exact signal the rest of this module withholds.
    const phone = trackedPhone();
    const sms = new FakeSmsClient();

    await requestOtp(phone, sms);
    await verifyOtp(phone, sms.lastCode(), true);

    await requestOtp(phone, sms);
    const returningError = await verifyOtp(phone, sms.lastCode(), false).catch((e: Error) => e.message);

    const newPhone = trackedPhone();
    const sms2 = new FakeSmsClient();
    await requestOtp(newPhone, sms2);
    const newError = await verifyOtp(newPhone, sms2.lastCode(), false).catch((e: Error) => e.message);

    expect(returningError).toBe(newError);
  });

  it("re-stamps consent when the recorded version is out of date", async () => {
    const phone = trackedPhone();
    const sms = new FakeSmsClient();

    await requestOtp(phone, sms);
    const first = await verifyOtp(phone, sms.lastCode(), true);

    // Simulate this person having agreed to older wording.
    await prisma.person.update({
      where: { id: first.id },
      // A bare "v1" is exactly the legacy case: stamped by the old WhatsApp
      // flow when someone answered a suburb question, having been shown
      // nothing. It must not count as consent on file.
      data: { consentVersion: "v1", consentGivenAt: new Date("2020-01-01") },
    });

    await requestOtp(phone, sms);
    const second = await verifyOtp(phone, sms.lastCode(), true);

    // The version they are re-stamped with is whatever the current copy
    // is, not a literal - a bump is a routine event and a test that fails
    // on one teaches people to edit tests when they change wording.
    expect(second.consentVersion).toBe(WEB_CONSENT_VERSION);
    expect(second.consentGivenAt!.getTime()).toBeGreaterThan(new Date("2020-01-01").getTime());
  });

  it("leaves consentGivenAt alone for someone already on the current version", async () => {
    // Otherwise it would drift forward on every sign-in and stop meaning
    // "when they agreed to this text".
    const phone = trackedPhone();
    const sms = new FakeSmsClient();

    await requestOtp(phone, sms);
    const first = await verifyOtp(phone, sms.lastCode(), true);

    await requestOtp(phone, sms);
    const second = await verifyOtp(phone, sms.lastCode(), true);

    expect(second.consentGivenAt!.getTime()).toBe(first.consentGivenAt!.getTime());
  });

  it("rejects a number that isn't South African before sending anything", async () => {
    const sms = new FakeSmsClient();
    await expect(requestOtp("+447911123456", sms)).rejects.toThrow(InvalidPhoneNumberError);
    expect(sms.sent).toHaveLength(0);
  });
});
