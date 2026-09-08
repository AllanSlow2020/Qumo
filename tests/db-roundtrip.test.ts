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
    // Unique per run, and it has to be. A fixed number collided with a real
    // shopper created by signing in through a browser against the same dev
    // database - a failure that says nothing about the code and everything
    // about the test assuming it is the only thing using it.
    const phone = `+2782${String(Date.now()).slice(-7)}`;
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
