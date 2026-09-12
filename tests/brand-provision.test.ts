import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { CONSOLE_SUBDOMAIN, isValidBrandSlug } from "@/lib/brand/host";
import { provisionBrand, provisionSecretMatches, ProvisionError } from "@/lib/brand/provision";
import { verifyPassword } from "@/lib/staff/password";

/**
 * Creating a tenant, which is the one operation in this system that has no
 * tenant to be scoped to.
 *
 * Everything else is protected by forBrand() or a staff session. This is
 * protected by a secret and by being extremely boring about what it accepts,
 * so most of what follows is refusals. The two that matter: a slug the host
 * resolver cannot route would give somebody a console that prints poster
 * URLs resolving to nothing, and a half-created brand would be a tenant
 * nobody can sign in to and nobody can fix without a database connection.
 */
describe("provisioning a brand", () => {
  const suffix = Date.now();
  const created: string[] = [];

  async function make(overrides: Record<string, unknown> = {}) {
    const brand = await provisionBrand({
      name: "Fresh Brand",
      slug: `fresh-${suffix}`,
      ownerName: "Sam Nkosi",
      ownerEmail: `sam-${suffix}@example.invalid`,
      ...overrides,
    });
    created.push(brand.brandId);
    return brand;
  }

  afterEach(() => vi.unstubAllEnvs());

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { brandId: { in: created } } });
    await prisma.brand.deleteMany({ where: { id: { in: created } } });
    await prisma.rateLimit.deleteMany({ where: { key: "provision" } });
  });

  describe("the setup key", () => {
    it("refuses everything when none is configured", () => {
      vi.stubEnv("PROVISION_SECRET", "");
      // The state a fresh deployment is in. If this ever returned true, the
      // window between deploying and setting the key is an open tenant
      // factory.
      expect(provisionSecretMatches("")).toBe(false);
      expect(provisionSecretMatches("anything")).toBe(false);
    });

    it("accepts only the exact key", () => {
      vi.stubEnv("PROVISION_SECRET", "correct-horse-battery-staple");

      expect(provisionSecretMatches("correct-horse-battery-staple")).toBe(true);
      expect(provisionSecretMatches("correct-horse-battery-stapl")).toBe(false);
      expect(provisionSecretMatches("correct-horse-battery-staplex")).toBe(false);
      expect(provisionSecretMatches("")).toBe(false);
    });
  });

  describe("what it creates", () => {
    it("makes the brand and an owner who must choose a password", async () => {
      const brand = await make({ slug: `made-${suffix}` });

      const row = await prisma.brand.findUnique({ where: { id: brand.brandId } });
      expect(row?.slug).toBe(`made-${suffix}`);
      expect(row?.name).toBe("Fresh Brand");

      const owner = await prisma.user.findFirst({ where: { brandId: brand.brandId } });
      expect(owner?.role).toBe("OWNER");
      // Nothing in the console works until this is replaced, which is what
      // makes a password two people already know acceptable to hand over.
      expect(owner?.mustChangePassword).toBe(true);
    });

    it("hands back a password that actually signs in, and stores only its hash", async () => {
      const brand = await make({ slug: `pw-${suffix}`, ownerEmail: `pw-${suffix}@example.invalid` });
      const owner = await prisma.user.findFirst({ where: { brandId: brand.brandId } });

      expect(await verifyPassword(brand.temporaryPassword, owner!.passwordHash)).toBe(true);
      // The one copy of it in the clear is the value returned above.
      expect(owner!.passwordHash).not.toContain(brand.temporaryPassword);
    });

    it("starts them with nothing, so the console is theirs to fill", async () => {
      const brand = await make({ slug: `empty-${suffix}`, ownerEmail: `empty-${suffix}@example.invalid` });

      expect(await prisma.campaign.count({ where: { brandId: brand.brandId } })).toBe(0);
      expect(await prisma.store.count({ where: { brandId: brand.brandId } })).toBe(0);
      expect(await prisma.packBatch.count({ where: { brandId: brand.brandId } })).toBe(0);
    });
  });

  describe("the address, which cannot be changed later", () => {
    it("refuses a slug the host resolver could never route", async () => {
      for (const slug of ["Chicken Licken", "chicken_licken", "-leading", "trailing-", "", "a".repeat(64)]) {
        await expect(make({ slug })).rejects.toBeInstanceOf(ProvisionError);
      }
    });

    it("refuses a reserved subdomain, including the console's own", async () => {
      // The console's label comes from the environment now, so this is the
      // case that stops a deployment selling a brand the host its own staff
      // sign in on.
      for (const slug of ["www", "api", "admin", CONSOLE_SUBDOMAIN]) {
        expect(isValidBrandSlug(slug)).toBe(false);
        await expect(make({ slug })).rejects.toBeInstanceOf(ProvisionError);
      }
    });

    it("refuses an address already taken, by name", async () => {
      await make({ slug: `taken-${suffix}`, ownerEmail: `first-${suffix}@example.invalid` });

      await expect(
        make({ slug: `taken-${suffix}`, ownerEmail: `second-${suffix}@example.invalid` }),
      ).rejects.toThrow(/already taken/i);
    });
  });

  describe("when it refuses, nothing is left behind", () => {
    it("creates no brand when the owner's email is already in use", async () => {
      const email = `clash-${suffix}@example.invalid`;
      await make({ slug: `clash-a-${suffix}`, ownerEmail: email });

      // Scoped to this file's own slugs, not a global count. Vitest runs
      // test files in parallel against one database, so counting every brand
      // meant any other file creating one between these two reads failed
      // this assertion. It did, once, and a flake in the suite that gates CI
      // is worse than the bug it was pretending to find.
      const mine = { slug: { startsWith: `clash-` }, name: "Fresh Brand" };
      const before = await prisma.brand.count({ where: mine });
      await expect(make({ slug: `clash-b-${suffix}`, ownerEmail: email })).rejects.toThrow(/already has an account/i);

      // The whole reason both rows go in one transaction. A brand with no
      // owner is a tenant nobody can sign in to and nobody can repair from
      // the console.
      expect(await prisma.brand.count({ where: mine })).toBe(before);
      expect(await prisma.brand.findUnique({ where: { slug: `clash-b-${suffix}` } })).toBeNull();
    });

    it("says which thing was wrong, because the fix is different", async () => {
      await expect(make({ ownerEmail: "not-an-email" })).rejects.toThrow(/email address/i);
      await expect(make({ name: "" })).rejects.toThrow(/name/i);
    });
  });
});
