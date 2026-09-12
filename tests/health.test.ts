import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import { prisma } from "@/lib/db/client";

/**
 * The one URL that answers "is it the deployment or the database".
 *
 * Written after an outage where every page returned a server error and
 * telling those two apart meant reading deployment logs. Most of what
 * follows is about what it refuses to say: a health endpoint is
 * unauthenticated by design, so every extra field in it is something a
 * stranger learns for free, and none of them help the person who actually
 * needs this.
 */
describe("the health check", () => {
  afterEach(() => vi.restoreAllMocks());

  it("says the database answered", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, database: true });
  });

  it("says it did not, with a status a monitor can act on", async () => {
    // 503 rather than 200-with-a-flag: anything watching a URL watches the
    // status code, and a check that always returns 200 is a check that
    // never fires.
    vi.spyOn(prisma, "$queryRaw").mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"));

    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, database: false });
  });

  it("tells a stranger nothing beyond whether it worked", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.5:5432 for user qumo_app on db qumo_prod"),
    );

    const raw = await (await GET()).text();

    // The driver's message names a host, a port, a user and a database. All
    // of that goes to the log and none of it into the response.
    expect(raw).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|5432|qumo_app|qumo_prod/);
    // And nothing about what is running here either.
    expect(raw).not.toMatch(/prisma|postgres|next/i);
  });

  it("does not hang when the database neither answers nor refuses", async () => {
    // The failure that matters most for a health check, because it is the
    // one an unreachable host actually produces: a connection that is
    // accepted and then never answered. Without the race this would hold
    // the function open until the platform killed it, and the check would
    // report nothing at all rather than reporting a problem.
    vi.spyOn(prisma, "$queryRaw").mockImplementation((() => new Promise(() => {})) as never);

    const started = Date.now();
    const response = await GET();

    expect(response.status).toBe(503);
    expect(Date.now() - started).toBeLessThan(8000);
  }, 15000);
});
