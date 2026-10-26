import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { cardStanding, getCardTarget, type CardTarget } from "@/lib/consumer/progress";
import { splitLedgerAmount } from "@/lib/consumer/wallet";

describe("how far along a stamp card somebody is", () => {
  const target = (over: Partial<CardTarget> = {}): CardTarget => ({
    campaignId: "c1",
    campaignName: "Rounds card",
    unit: "STAMPS",
    completesAt: 10,
    rewardName: null,
    ...over,
  });

  it("names the reward when the brand has named one", () => {
    const { line, remaining } = cardStanding(target({ rewardName: "A free coffee" }), 7);
    expect(remaining).toBe(3);
    expect(line).toBe("3 more stamps and A free coffee is yours.");
  });

  it("promises nothing when the brand has not named a reward", () => {
    // Not a cosmetic difference. A campaign can carry completesAt with no
    // Reward row behind it, and applyAccrual issues nothing on completion in
    // that state - so "and your reward is yours" would be the screen making
    // a promise the engine will not keep.
    const { line } = cardStanding(target(), 7);
    expect(line).toBe("3 more stamps to complete this card.");
    expect(line).not.toMatch(/yours/);
  });

  it("counts one remaining as one, not ones", () => {
    expect(cardStanding(target(), 9).line).toBe("1 more stamp to complete this card.");
  });

  it("never draws more marks than the card holds", () => {
    // The state the demo brand is actually in: a ten-stamp card with no
    // reward behind it never completes, so nothing is ever deducted and the
    // balance climbs straight past the target. Unclamped, eleven stamps
    // render as a row of ten plus an orphan on a second line.
    const standing = cardStanding(target(), 14);
    expect(standing.filled).toBe(10);
    expect(standing.remaining).toBe(0);
    expect(standing.line).toBe("Your card is full.");
  });

  it("treats a card that is exactly full as full", () => {
    expect(cardStanding(target({ rewardName: "A free coffee" }), 10).line).toBe(
      "Your card is full. A free coffee is waiting at the till.",
    );
  });

  it("does not draw a negative card", () => {
    const standing = cardStanding(target(), -3);
    expect(standing.filled).toBe(0);
    expect(standing.remaining).toBe(10);
  });
});

describe("a figure and the word beside it", () => {
  it("leaves rands whole, because they have no word", () => {
    expect(splitLedgerAmount(1050, "CENTS")).toEqual({ figure: "R10.50", suffix: null });
  });

  it("keeps the number on the grid and the word off it", () => {
    // The whole point: "5 stamps" set entirely in Martian Mono drags the
    // word along at display size behind a word space wide enough to read as
    // a fault. Only the figure belongs in the monospace.
    expect(splitLedgerAmount(5, "STAMPS")).toEqual({ figure: "5", suffix: "stamps" });
    expect(splitLedgerAmount(1, "STAMPS")).toEqual({ figure: "1", suffix: "stamp" });
    expect(splitLedgerAmount(-1, "STAMPS")).toEqual({ figure: "-1", suffix: "stamp" });
  });
});

describe("finding the card a brand is running", () => {
  const suffix = Date.now();
  let brand: Brand;

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Copper Kettle", slug: `prog-${suffix}` } });
  });

  afterAll(async () => {
    await prisma.reward.deleteMany({ where: { brandId: brand.id } });
    await prisma.earnRule.deleteMany({ where: { brandId: brand.id } });
    await prisma.campaign.deleteMany({ where: { brandId: brand.id } });
    await prisma.brand.delete({ where: { id: brand.id } });
  });

  async function campaign(name: string, completesAt: number | null, status: "ACTIVE" | "PAUSED" = "ACTIVE") {
    const c = await prisma.campaign.create({ data: { brandId: brand.id, name, status } });
    await prisma.earnRule.create({
      data: { brandId: brand.id, campaignId: c.id, type: "FLAT_PER_SCAN", unit: "STAMPS", amount: 1, completesAt },
    });
    return c;
  }

  it("ignores a promotion that only accrues", async () => {
    await campaign(`Wallet ${suffix}`, null);
    expect(await getCardTarget(brand.id)).toBeNull();
  });

  it("finds the card, with its size and its name", async () => {
    const c = await campaign(`Rounds ${suffix}`, 10);
    const found = await getCardTarget(brand.id);
    expect(found?.campaignId).toBe(c.id);
    expect(found?.completesAt).toBe(10);
    expect(found?.rewardName).toBeNull();
  });

  it("reads an unfilled reward name as no reward name", async () => {
    // rewardName defaults to "" in the schema, so a Reward row nobody filled
    // in is indistinguishable from no row at all to a shopper - and both
    // have to produce the quieter sentence rather than "and  is yours".
    const target = (await getCardTarget(brand.id))!;
    await prisma.reward.create({ data: { brandId: brand.id, campaignId: target.campaignId, rewardName: "" } });
    expect((await getCardTarget(brand.id))?.rewardName).toBeNull();

    await prisma.reward.update({
      where: { campaignId: target.campaignId },
      data: { rewardName: "  A free coffee  " },
    });
    expect((await getCardTarget(brand.id))?.rewardName).toBe("A free coffee");
  });

  it("ignores a card on a paused promotion", async () => {
    const target = (await getCardTarget(brand.id))!;
    await prisma.campaign.update({ where: { id: target.campaignId }, data: { status: "PAUSED" } });
    expect(await getCardTarget(brand.id)).toBeNull();
  });
});
