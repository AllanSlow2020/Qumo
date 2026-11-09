import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderLegalCopy } from "@/lib/legal/document";
import { CONSENT_POINTS, SMS_CONSENT_VERSION, WEB_CONSENT_VERSION } from "@/lib/consumer/consent";
import { TERMS_POINTS, TERMS_VERSION } from "@/lib/consumer/terms";
import { SHOPPER_SUPPORT_EMAIL } from "@/lib/product";

const PATH = join(process.cwd(), "docs", "consent-copy.md");
const onDisk = () => readFileSync(PATH, "utf8");

describe("the legal copy a reviewer is sent", () => {
  it("matches the copy constants exactly", () => {
    // The whole arrangement rests on this one assertion. Without it the
    // document is a snapshot that was true once, and the first review that
    // comes back gets applied to the easier file.
    expect(onDisk()).toBe(renderLegalCopy());
  });

  it("carries every heading a shopper can be shown", () => {
    const doc = onDisk();
    for (const point of [...CONSENT_POINTS, ...TERMS_POINTS]) {
      expect(doc).toContain(`### ${point.heading}`);
    }
  });

  it("states the version each block is recorded under", () => {
    const doc = onDisk();
    for (const version of [WEB_CONSENT_VERSION, TERMS_VERSION, SMS_CONSENT_VERSION]) {
      expect(doc).toContain(`\`${version}\``);
    }
  });

  it("does not tell a shopper their account is held on a brand's behalf", () => {
    // The regression this file was written for. Until web-v5 the notice said
    // Qumo holds the shopper's information "on behalf of the brands you
    // interact with", which is operator language, while the schema puts the
    // number, the age confirmation and the consent on a Person row with no
    // brandId that every brand shares. The sentence pointed a complaint at
    // the one party that cannot see the record.
    //
    // Asserted against the rendered document rather than the constant so it
    // also catches the SMS notice, which says it in its own lead-in sentence
    // and does not inherit this wording from CONSENT_POINTS.
    expect(renderLegalCopy()).not.toMatch(/on behalf of the brands?/i);
  });

  it("gives a shopper an address for us, and not only for the brand", () => {
    // web-v5 named us as the party that answers for the account and then
    // said a way to reach us was not built. A responsible party that names
    // itself and gives no address has not really named itself, and the
    // sentence was written to be temporary. This is what stops it being
    // quietly permanent.
    const point = CONSENT_POINTS.find((p) => p.heading === "Who answers for what");
    expect(point?.body).toContain(SHOPPER_SUPPORT_EMAIL);
    expect(renderLegalCopy()).not.toMatch(/not built yet/i);
  });

  it("no longer tells a shopper that redemption is shut", () => {
    // It was true when it was written and it stopped being true the day a
    // coupon could be taken at a counter. A shopper reading the old clause
    // would not know to ask for what they had earned.
    const point = TERMS_POINTS.find((p) => p.heading === "Using what you have earned");
    expect(point?.body).not.toMatch(/Redemption is not open yet/i);
    expect(point?.body).toMatch(/completed card/i);
    // And it still says the half that is shut, because that half is real.
    expect(point?.body).toMatch(/cannot be spent at a till yet/i);
  });

  it("tells a shopper who answers for the account, and that it is us", () => {
    const point = CONSENT_POINTS.find((p) => p.heading === "Who answers for what");
    expect(point).toBeDefined();
    expect(point?.body).toMatch(/answers for your account/);
    expect(point?.body).toMatch(/Each brand answers for its own programme/);
  });
});
