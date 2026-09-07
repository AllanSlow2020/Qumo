import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { forBrand, getMemberProfile, TENANT_SCOPED_MODELS, TenantScopeViolation } from "@/lib/db/tenant";
import { encryptPhone, hashPhone } from "@/lib/security/crypto";

// The single most important test in the repository: it proves brand A can
// never read, count, or write brand B's rows through the tenant-scoped
// client, no matter what a call site tries to pass in.
//
// Store stands in for "any tenant-owned table" here, where CIOS used
// Product. The guard does not care which model it is — it rewrites the same
// `where` for every name in TENANT_SCOPED_MODELS — so one representative is
// enough, and a store is the one a brand actually configures.

describe("tenant isolation", () => {
  const suffix = Date.now();
  let brandA: { id: string };
  let brandB: { id: string };

  beforeAll(async () => {
    brandA = await prisma.brand.create({
      data: { name: "Brand A", slug: `brand-a-${suffix}` },
    });
    brandB = await prisma.brand.create({
      data: { name: "Brand B", slug: `brand-b-${suffix}` },
    });

    await forBrand(brandA.id).store.create({
      data: { name: "A's Store", code: `A-STORE-${suffix}`, brandId: brandA.id },
    });
    await forBrand(brandB.id).store.create({
      data: { name: "B's Store", code: `B-STORE-${suffix}`, brandId: brandB.id },
    });
  });

  afterAll(async () => {
    await prisma.store.deleteMany({ where: { brandId: { in: [brandA.id, brandB.id] } } });
    await prisma.brandMembership.deleteMany({ where: { brandId: { in: [brandA.id, brandB.id] } } });
    await prisma.brand.deleteMany({ where: { id: { in: [brandA.id, brandB.id] } } });
    await prisma.$disconnect();
  });

  it("only returns the scoped brand's stores", async () => {
    const asA = await forBrand(brandA.id).store.findMany({});
    expect(asA.map((s) => s.name)).toEqual(["A's Store"]);

    const asB = await forBrand(brandB.id).store.findMany({});
    expect(asB.map((s) => s.name)).toEqual(["B's Store"]);
  });

  it("cannot read the other brand's store by id", async () => {
    const bStore = await forBrand(brandB.id).store.findFirstOrThrow({});
    const asA = await forBrand(brandA.id).store.findUnique({ where: { id: bStore.id } });
    expect(asA).toBeNull();
  });

  it("refuses to create a row for a different brandId instead of silently reassigning it", async () => {
    await expect(
      forBrand(brandA.id).store.create({
        data: { name: "Sneaky", code: `SNEAKY-${suffix}`, brandId: brandB.id },
      }),
    ).rejects.toThrow(TenantScopeViolation);

    const leaked = await forBrand(brandB.id).store.findFirst({
      where: { code: `SNEAKY-${suffix}` },
    });
    expect(leaked).toBeNull();
  });

  it("cannot update or delete the other brand's row via a guessed id", async () => {
    const bStore = await forBrand(brandB.id).store.findFirstOrThrow({});

    const updateResult = await forBrand(brandA.id).store.updateMany({
      where: { id: bStore.id },
      data: { name: "Hijacked" },
    });
    expect(updateResult.count).toBe(0);

    const deleteResult = await forBrand(brandA.id).store.deleteMany({
      where: { id: bStore.id },
    });
    expect(deleteResult.count).toBe(0);

    const stillThere = await prisma.store.findUnique({ where: { id: bStore.id } });
    expect(stillThere?.name).toBe("B's Store");
  });

  it("getMemberProfile only returns a Person for a brand with a real membership", async () => {
    const phone = `+2782${suffix}`.slice(0, 12);
    const person = await prisma.person.create({
      data: { phoneHash: hashPhone(phone), phoneEncrypted: encryptPhone(phone), firstName: "Shared" },
    });
    await forBrand(brandA.id).brandMembership.create({
      data: { personId: person.id, brandId: brandA.id },
    });

    const viaA = await getMemberProfile(brandA.id, person.id);
    expect(viaA?.firstName).toBe("Shared");

    const viaB = await getMemberProfile(brandB.id, person.id);
    expect(viaB).toBeNull();

    await prisma.person.delete({ where: { id: person.id } });
  });
});

/**
 * The guard has two halves that must agree: the list of models it claims to
 * scope, and the `$extends` block that actually intercepts them. They are
 * deliberately separate — a literal object per model, so a typo in a name
 * is a type error rather than a silent no-op — and separate things drift.
 *
 * They did. `auditEvent` was added to the list and not to the block, which
 * left an entire table listed as tenant-scoped while every query against it
 * ran unscoped: one brand could read another's audit history, and the
 * append-only rule that lives in the same code path never ran either. No
 * type error, because the omission is a missing line rather than a wrong
 * one, and nothing else would have noticed.
 */
describe("every scoped model is actually wired into the guard", () => {
  it.each([...TENANT_SCOPED_MODELS])("%s goes through the tenant guard", async (model) => {
    const scoped = forBrand("some-brand-id") as unknown as Record<
      string,
      { findFirst: (args: unknown) => Promise<unknown> }
    >;

    // A where naming a different brand must be refused. If the model is not
    // intercepted the query simply runs and resolves, which is the bug.
    await expect(
      scoped[model]!.findFirst({ where: { brandId: "a-different-brand" } }),
    ).rejects.toThrow(TenantScopeViolation);
  });
});
