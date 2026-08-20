import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand, BrandMembership, Person } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { forPerson, ConsumerScopeViolation } from "@/lib/consumer/scope";

/**
 * The guarantee under test: a shopper's lens can read their own rows across
 * every brand, and cannot reach anyone else's by any route — including by
 * asking for them explicitly.
 */
describe("lib/consumer/scope", () => {
  const suffix = Date.now();
  let brandA: Brand;
  let brandB: Brand;
  let me: Person;
  let someoneElse: Person;
  let myMembershipA: BrandMembership;
  let theirMembershipA: BrandMembership;

  beforeAll(async () => {
    brandA = await prisma.brand.create({ data: { name: "Scope Brand A", slug: `scope-a-${suffix}` } });
    brandB = await prisma.brand.create({ data: { name: "Scope Brand B", slug: `scope-b-${suffix}` } });

    me = await prisma.person.create({
      data: { phoneHash: `scope-me-${suffix}`, phoneEncrypted: "x" },
    });
    someoneElse = await prisma.person.create({
      data: { phoneHash: `scope-them-${suffix}`, phoneEncrypted: "x" },
    });

    myMembershipA = await prisma.brandMembership.create({ data: { brandId: brandA.id, personId: me.id } });
    await prisma.brandMembership.create({ data: { brandId: brandB.id, personId: me.id } });
    theirMembershipA = await prisma.brandMembership.create({
      data: { brandId: brandA.id, personId: someoneElse.id },
    });

    await prisma.pointsTransaction.createMany({
      data: [
        { brandId: brandA.id, brandMembershipId: myMembershipA.id, amount: 30, unit: "POINTS", reason: "PACK_SCAN_AWARDED" },
        { brandId: brandA.id, brandMembershipId: theirMembershipA.id, amount: 999, unit: "POINTS", reason: "PACK_SCAN_AWARDED" },
      ],
    });
  });

  afterAll(async () => {
    const personIds = [me.id, someoneElse.id];
    await prisma.pointsTransaction.deleteMany({ where: { brandId: { in: [brandA.id, brandB.id] } } });
    await prisma.brandMembership.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.brand.deleteMany({ where: { id: { in: [brandA.id, brandB.id] } } });
  });

  it("reads the shopper's own memberships across every brand", async () => {
    const memberships = await forPerson(me.id).brandMembership.findMany();
    expect(memberships).toHaveLength(2);
    expect(new Set(memberships.map((m) => m.brandId))).toEqual(new Set([brandA.id, brandB.id]));
  });

  it("never returns another person's rows, even at the same brand", async () => {
    const memberships = await forPerson(me.id).brandMembership.findMany({ where: { brandId: brandA.id } });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.personId).toBe(me.id);
  });

  it("scopes ledger rows through the membership that owns them", async () => {
    // PointsTransaction has no personId column — this is the relation-filter
    // path, and it has to hold just as firmly as the column one.
    const rows = await forPerson(me.id).pointsTransaction.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toBe(30);
  });

  it("cannot be tricked into reading another person's ledger by naming their membership", async () => {
    const rows = await forPerson(me.id).pointsTransaction.findMany({
      where: { brandMembershipId: theirMembershipA.id },
    });
    expect(rows).toHaveLength(0);
  });

  it("rejects a query that contradicts its own scope instead of silently correcting it", async () => {
    // A caller passing someone else's id is a bug. Quietly rewriting it
    // would hide the bug; forBrand() takes the same position.
    await expect(
      forPerson(me.id).brandMembership.findMany({ where: { personId: someoneElse.id } }),
    ).rejects.toThrow(ConsumerScopeViolation);
  });

  it("scopes counts and sums, not just row reads", async () => {
    const count = await forPerson(me.id).pointsTransaction.count();
    expect(count).toBe(1);

    const grouped = await forPerson(me.id).pointsTransaction.groupBy({
      by: ["unit"],
      _sum: { amount: true },
    });
    // 999 belongs to someone else and must not appear in this total.
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?._sum.amount).toBe(30);
  });

  it("refuses every write operation", async () => {
    // forPerson() is a read-only lens: awarding points is a business rule
    // that belongs to a server action, never to the shopper's own client.
    await expect(
      forPerson(me.id).pointsTransaction.create({
        data: {
          brandId: brandA.id,
          brandMembershipId: myMembershipA.id,
          amount: 1_000_000,
          unit: "CENTS",
          reason: "PACK_SCAN_AWARDED",
        },
      }),
    ).rejects.toThrow(ConsumerScopeViolation);

    await expect(
      forPerson(me.id).brandMembership.deleteMany({ where: { brandId: brandA.id } }),
    ).rejects.toThrow(ConsumerScopeViolation);

    await expect(
      forPerson(me.id).pointsTransaction.updateMany({ data: { amount: 5 } }),
    ).rejects.toThrow(ConsumerScopeViolation);
  });

  it("requires a personId", () => {
    expect(() => forPerson("")).toThrow();
  });
});
