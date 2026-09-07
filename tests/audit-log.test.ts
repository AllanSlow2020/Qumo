import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { forBrand, TenantScopeViolation } from "@/lib/db/tenant";
import { record, recordSystem } from "@/lib/audit/record";
import { describeAction, listAuditEvents } from "@/lib/audit/read";
import { createStoreForSession, rotateStoreSecretForSession } from "@/lib/stores/manage";

const run = randomUUID().slice(0, 8);
let brand: { id: string };
let otherBrand: { id: string };

const actor = (brandId: string) => ({
  id: `${brandId}-owner`,
  brandId,
  role: "OWNER",
  name: "Thandi Mokoena",
  email: "thandi@example.com",
});

beforeAll(async () => {
  brand = await prisma.brand.create({ data: { name: `Audit ${run}`, slug: `audit-${run}` } });
  otherBrand = await prisma.brand.create({ data: { name: `Other ${run}`, slug: `other-${run}` } });
});

afterAll(async () => {
  for (const id of [brand.id, otherBrand.id]) {
    await prisma.auditEvent.deleteMany({ where: { brandId: id } });
    await prisma.store.deleteMany({ where: { brandId: id } });
    await prisma.brand.delete({ where: { id } });
  }
});

describe("the log is append-only", () => {
  /**
   * The guarantee the whole feature rests on. A log the people it watches
   * can edit is not a log, and "nothing in the app calls update on it" is a
   * property of today's code rather than something anyone can rely on.
   */
  it("refuses an update, wherever it comes from", async () => {
    await record(prisma, actor(brand.id), { action: "test.event" });
    const entry = await forBrand(brand.id).auditEvent.findFirst({ where: { action: "test.event" } });
    expect(entry).not.toBeNull();

    await expect(
      forBrand(brand.id).auditEvent.update({ where: { id: entry!.id }, data: { action: "test.tampered" } }),
    ).rejects.toThrow(TenantScopeViolation);

    // And the row is untouched, not merely un-returned.
    const after = await forBrand(brand.id).auditEvent.findFirst({ where: { id: entry!.id } });
    expect(after!.action).toBe("test.event");
  });

  it("refuses a delete", async () => {
    const entry = await forBrand(brand.id).auditEvent.findFirst({ where: { action: "test.event" } });
    await expect(
      forBrand(brand.id).auditEvent.delete({ where: { id: entry!.id } }),
    ).rejects.toThrow(TenantScopeViolation);
    await expect(
      forBrand(brand.id).auditEvent.deleteMany({ where: { brandId: brand.id } }),
    ).rejects.toThrow(TenantScopeViolation);
  });

  it("refuses an upsert, which is an update wearing a different hat", async () => {
    await expect(
      forBrand(brand.id).auditEvent.upsert({
        where: { id: "whatever" },
        create: { brandId: brand.id, actorName: "x", action: "test.sneaky" },
        update: { action: "test.sneaky" },
      }),
    ).rejects.toThrow(TenantScopeViolation);
  });
});

describe("the log is brand-scoped", () => {
  it("shows one brand its own history and nobody else's", async () => {
    await record(prisma, actor(brand.id), { action: "test.mine" });
    await record(prisma, actor(otherBrand.id), { action: "test.theirs" });

    const mine = await listAuditEvents(brand.id);
    expect(mine.some((r) => r.action === "test.mine")).toBe(true);
    expect(mine.some((r) => r.action === "test.theirs")).toBe(false);
  });
});

describe("what an entry says", () => {
  it("names who acted, as they were at the time", async () => {
    await record(prisma, actor(brand.id), { action: "test.named" });
    const [entry] = await listAuditEvents(brand.id, { limit: 1 });
    expect(entry!.actorName).toBe("Thandi Mokoena");
    expect(entry!.actorEmail).toBe("thandi@example.com");
  });

  /**
   * The copied name is the point of copying it: a log is read months later,
   * by which time the person may have been renamed or deactivated, and "who
   * did this" has to answer with who they were, not who the row points at.
   */
  it("keeps the name it was written with, even after the person is renamed", async () => {
    await record(prisma, { ...actor(brand.id), name: "Old Name" }, { action: "test.renamed" });
    await record(prisma, { ...actor(brand.id), name: "New Name" }, { action: "test.renamed_after" });

    const rows = await listAuditEvents(brand.id, { limit: 2 });
    expect(rows.find((r) => r.action === "test.renamed_after")!.actorName).toBe("New Name");

    const older = await forBrand(brand.id).auditEvent.findFirst({ where: { action: "test.renamed" } });
    expect(older!.actorName).toBe("Old Name");
  });

  it("attributes an automatic action to nobody rather than to somebody", async () => {
    await recordSystem(prisma, brand.id, { action: "test.automatic" });
    const entry = await forBrand(brand.id).auditEvent.findFirst({ where: { action: "test.automatic" } });
    expect(entry!.actorId).toBeNull();
    expect(entry!.actorName).toContain("automatic");
  });

  /**
   * This table is read by a brand's whole team in their console. A rotated
   * signing secret or a generated password appearing in it would defeat the
   * reason those values are generated fresh.
   */
  it("redacts anything sensitive that reaches it", async () => {
    await record(prisma, actor(brand.id), {
      action: "test.redaction",
      detail: { phone: "+27821234567", token: "secret-value", quantity: 500 },
    });
    const entry = await forBrand(brand.id).auditEvent.findFirst({ where: { action: "test.redaction" } });
    const detail = entry!.detail as Record<string, unknown>;

    expect(detail.phone).toBe("[redacted]");
    expect(detail.token).toBe("[redacted]");
    expect(detail.quantity).toBe(500);
  });
});

describe("what the engine records without being asked", () => {
  it("records a store being created, and its secret being rotated", async () => {
    const form = new FormData();
    form.set("name", "Sea Point");
    form.set("code", `SP-${run}`);
    form.set("signed", "on");

    const created = await createStoreForSession({ user: actor(brand.id) }, form);
    await rotateStoreSecretForSession({ user: actor(brand.id) }, created.id);

    const rows = await listAuditEvents(brand.id, { limit: 5 });
    const actions = rows.map((r) => r.action);
    expect(actions).toContain("store.created");
    expect(actions).toContain("store.secret_rotated");

    // The fact, never the value. A rotation exists to keep that secret out
    // of places it can be read later, and this is such a place.
    const rotation = rows.find((r) => r.action === "store.secret_rotated")!;
    expect(JSON.stringify(rotation)).not.toContain(created.signingSecret);
  });
});

describe("describeAction", () => {
  it("turns a stored verb into a sentence", () => {
    expect(describeAction("store.secret_rotated")).toBe("Rotated a store's signing secret");
  });

  it("falls back to the raw name rather than rendering a blank row", () => {
    // Recording a new kind of event is one line at a call site; it must not
    // need a matching phrase before the log is readable.
    expect(describeAction("something.new")).toBe("something.new");
  });
});
