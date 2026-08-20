import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { encryptPhone, decryptPhone, hashPhone } from "@/lib/security/crypto";

describe("database round-trip", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("writes and reads a Brand", async () => {
    const brand = await prisma.brand.create({
      data: { name: "Test Brand", slug: `test-brand-${Date.now()}` },
    });
    const found = await prisma.brand.findUniqueOrThrow({ where: { id: brand.id } });
    expect(found.name).toBe("Test Brand");
    await prisma.brand.delete({ where: { id: brand.id } });
  });

  it("stores a Person's phone number encrypted, with a stable lookup hash", async () => {
    const phone = "+27821234567";
    const phoneHash = hashPhone(phone);
    const phoneEncrypted = encryptPhone(phone);

    // The ciphertext must not just be the plaintext with a bow on it.
    expect(phoneEncrypted).not.toContain(phone);

    const person = await prisma.person.create({
      data: { phoneHash, phoneEncrypted, firstName: "Test" },
    });

    const found = await prisma.person.findUniqueOrThrow({ where: { phoneHash } });
    expect(decryptPhone(found.phoneEncrypted)).toBe(phone);

    await prisma.person.delete({ where: { id: person.id } });
  });
});
