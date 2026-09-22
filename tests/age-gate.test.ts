import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, Campaign, Person } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { generatePackCode } from "@/lib/packs/code";
import { redeemPackCode } from "@/lib/packs/scan";
import { needsAgeStep, submitAgeCheck } from "@/lib/consumer/age-check";
import { ageOn, parseBirthDate, AGE_REFUSAL_COOLDOWN_MS } from "@/lib/consumer/age";

/**
 * The age step.
 *
 * Two things are worth proving and only one of them is the obvious one.
 * The obvious one is that a child is refused. The other is what the
 * database looks like afterwards: a refusal must leave no record of who
 * they are or when they were born, and a pass must record the answer
 * without keeping the date that produced it. A gate that works and quietly
 * accumulates minors' birthdays has failed at the thing it was added for.
 */

describe("working out an age", () => {
  it("counts by calendar, not by dividing days", () => {
    const born = { year: 2008, month: 3, day: 15 };
    // The day before their eighteenth, and the day itself. Millisecond
    // arithmetic with an average year length gets exactly these two wrong.
    expect(ageOn(born, new Date("2026-03-14T12:00:00Z"))).toBe(17);
    expect(ageOn(born, new Date("2026-03-15T00:00:00Z"))).toBe(18);
  });

  it("handles someone born on a leap day", () => {
    const born = { year: 2008, month: 2, day: 29 };
    expect(ageOn(born, new Date("2026-02-28T12:00:00Z"))).toBe(17);
    expect(ageOn(born, new Date("2026-03-01T12:00:00Z"))).toBe(18);
  });

  it("refuses a date that does not exist rather than rolling it over", () => {
    // Date would happily turn this into 3 March and pass. A form that
    // silently reads something other than what was typed is how somebody
    // discovers it was never really checking.
    const result = parseBirthDate({ day: "31", month: "2", year: "1990" }, new Date("2026-01-01T00:00:00Z"));
    expect(result.ok).toBe(false);
  });

  it("refuses a future date and an implausible year", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(parseBirthDate({ day: "1", month: "1", year: "2030" }, now).ok).toBe(false);
    expect(parseBirthDate({ day: "1", month: "1", year: "1089" }, now).ok).toBe(false);
  });
});

describe("a brand that asks for an age", () => {
  const suffix = Date.now();
  let restricted: Brand;
  let open: Brand;
  let campaign: Campaign;
  let openCampaign: Campaign;
  let adult: Person;
  let child: Person;

  const NOW = new Date("2026-06-01T12:00:00Z");
  const ADULT_DOB = { day: "4", month: "7", year: "1990" };
  const CHILD_DOB = { day: "4", month: "7", year: "2012" };

  async function makeCode(campaignId: string, brandId: string) {
    const code = generatePackCode();
    const batch = await prisma.packBatch.create({
      data: { brandId, campaignId, label: `age-${suffix}-${code.slice(0, 4)}`, quantity: 1 },
    });
    await prisma.packCode.create({ data: { brandId, campaignId, batchId: batch.id, code, status: "UNSCANNED" } });
    return code;
  }

  beforeAll(async () => {
    restricted = await prisma.brand.create({
      data: { name: "Campari", slug: `age-on-${suffix}`, minimumAge: 18 },
    });
    open = await prisma.brand.create({ data: { name: "Chicken Licken", slug: `age-off-${suffix}` } });

    for (const [brand, holder] of [[restricted, "campaign"], [open, "openCampaign"]] as const) {
      const made = await prisma.campaign.create({
        data: { brandId: brand.id, name: `${holder}-${suffix}`, status: "ACTIVE" },
      });
      await prisma.earnRule.create({
        data: { brandId: brand.id, campaignId: made.id, type: "FLAT_PER_SCAN", unit: "POINTS", amount: 50 },
      });
      if (holder === "campaign") campaign = made;
      else openCampaign = made;
    }

    adult = await prisma.person.create({ data: { phoneHash: `age-adult-${suffix}`, phoneEncrypted: "x" } });
    child = await prisma.person.create({ data: { phoneHash: `age-child-${suffix}`, phoneEncrypted: "x" } });
  });

  afterAll(async () => {
    const brandIds = [restricted.id, open.id];
    const personIds = [adult.id, child.id];
    await prisma.pointsTransaction.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.packCode.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.packBatch.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.earnRule.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.brandMembership.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.campaign.deleteMany({ where: { brandId: { in: brandIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.brand.deleteMany({ where: { id: { in: brandIds } } });
  });

  it("asks a shopper it has not asked before", async () => {
    expect(await needsAgeStep(restricted.id, adult.id)).toBe(true);
  });

  it("never asks on behalf of a brand with no minimum", async () => {
    expect(await needsAgeStep(open.id, adult.id)).toBe(false);
  });

  it("refuses the ledger before the age step is done, and does not burn the code", async () => {
    // The point of the whole design. The engine refuses, the transaction
    // rolls back, and the shopper still holds a code worth something -
    // rather than one spent on an award they never received.
    const code = await makeCode(campaign.id, restricted.id);
    const result = await redeemPackCode(code, adult.id, NOW, restricted.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("AGE_UNCONFIRMED");

    const row = await prisma.packCode.findFirstOrThrow({ where: { code } });
    expect(row.status).toBe("UNSCANNED");
    expect(await prisma.pointsTransaction.count({ where: { brandId: restricted.id } })).toBe(0);
  });

  it("keeps the answer and not the date of birth", async () => {
    const decision = await submitAgeCheck(adult.id, restricted.id, ADULT_DOB, NOW);
    expect(decision.ok).toBe(true);

    const row = await prisma.person.findUniqueOrThrow({ where: { id: adult.id } });
    expect(row.ageConfirmedAt).not.toBeNull();
    expect(row.ageConfirmedMinimum).toBe(18);

    // The date they typed appears nowhere on the row. Asserted against the
    // serialised record rather than a column list, so a column added later
    // to "help" cannot quietly reintroduce it.
    expect(JSON.stringify(row)).not.toContain("1990");
  });

  it("earns normally once the age is confirmed", async () => {
    const code = await makeCode(campaign.id, restricted.id);
    const result = await redeemPackCode(code, adult.id, NOW, restricted.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.amount).toBe(50);
  });

  it("turns a child away and writes nothing about them but the refusal", async () => {
    const decision = await submitAgeCheck(child.id, restricted.id, CHILD_DOB, NOW);
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reason).toBe("TOO_YOUNG");

    const row = await prisma.person.findUniqueOrThrow({ where: { id: child.id } });
    expect(row.ageConfirmedAt).toBeNull();
    expect(row.ageConfirmedMinimum).toBeNull();
    expect(row.ageRefusedAt).not.toBeNull();
    // Not their birth year, not their age, nothing that describes a child.
    expect(JSON.stringify(row)).not.toContain("2012");
  });

  it("will not let a refused shopper guess again immediately", async () => {
    // Without this the gate is a form that says no and hands itself back,
    // which is a quiz with the answer printed on the bottle.
    const decision = await submitAgeCheck(child.id, restricted.id, ADULT_DOB, NOW);
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reason).toBe("COOLDOWN");

    const row = await prisma.person.findUniqueOrThrow({ where: { id: child.id } });
    expect(row.ageConfirmedAt).toBeNull();
  });

  it("lets them answer again once the cooldown has run out", async () => {
    const later = new Date(NOW.getTime() + AGE_REFUSAL_COOLDOWN_MS + 1000);
    const decision = await submitAgeCheck(child.id, restricted.id, ADULT_DOB, later);
    expect(decision.ok).toBe(true);

    const row = await prisma.person.findUniqueOrThrow({ where: { id: child.id } });
    expect(row.ageConfirmedMinimum).toBe(18);
    // Cleared, so a refusal cannot outlive the question it was about.
    expect(row.ageRefusedAt).toBeNull();
  });

  it("does not record a refusal for a date that was simply mistyped", async () => {
    const fresh = await prisma.person.create({
      data: { phoneHash: `age-typo-${suffix}`, phoneEncrypted: "x" },
    });
    const decision = await submitAgeCheck(fresh.id, restricted.id, { day: "31", month: "2", year: "1990" }, NOW);
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reason).toBe("INVALID");

    // A typo has established nothing, so it must not cost a day of the
    // promotion.
    const row = await prisma.person.findUniqueOrThrow({ where: { id: fresh.id } });
    expect(row.ageRefusedAt).toBeNull();

    await prisma.person.delete({ where: { id: fresh.id } });
  });

  it("does not treat an answer to 18 as an answer to 21", async () => {
    // A brand raising its threshold is asking a question this shopper has
    // not been asked. Inheriting the old answer would be the easy bug.
    await prisma.brand.update({ where: { id: restricted.id }, data: { minimumAge: 21 } });
    expect(await needsAgeStep(restricted.id, adult.id)).toBe(true);
    await prisma.brand.update({ where: { id: restricted.id }, data: { minimumAge: 18 } });
  });

  it("leaves an unrestricted brand's shoppers completely alone", async () => {
    const stranger = await prisma.person.create({
      data: { phoneHash: `age-open-${suffix}`, phoneEncrypted: "x" },
    });
    const code = await makeCode(openCampaign.id, open.id);
    const result = await redeemPackCode(code, stranger.id, NOW, open.id);

    expect(result.ok).toBe(true);

    const row = await prisma.person.findUniqueOrThrow({ where: { id: stranger.id } });
    expect(row.ageConfirmedAt).toBeNull();

    await prisma.pointsTransaction.deleteMany({ where: { brandMembership: { personId: stranger.id } } });
    await prisma.brandMembership.deleteMany({ where: { personId: stranger.id } });
    await prisma.person.delete({ where: { id: stranger.id } });
  });
});
