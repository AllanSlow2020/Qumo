import { afterAll, describe, expect, it } from "vitest";
import { ShopperSessionRevokeReason } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  createSession,
  listActiveSessions,
  revokeAllSessions,
  resolveSessionToken,
  revokeSessionByToken,
  SESSION_RETENTION_MS,
  sweepExpiredSessions,
  verifySessionToken,
} from "@/lib/consumer/session";
import { encryptPhone, hashPhone } from "@/lib/security/crypto";

/**
 * Sessions hang off a real Person by foreign key, so these need real rows.
 * Numbers are untruncated and tracked for teardown — a truncated timestamp
 * repeats every hundred seconds or so, and two runs a minute apart then
 * collide in a way that reads as a logic bug.
 */
let counter = 0;
const run = Date.now();
const personIds: string[] = [];

async function makePerson(): Promise<string> {
  counter += 1;
  const phone = `+27${run}${counter}`;
  const person = await prisma.person.create({
    data: { phoneHash: hashPhone(phone), phoneEncrypted: encryptPhone(phone) },
  });
  personIds.push(person.id);
  return person.id;
}

describe("lib/consumer/session", () => {
  afterAll(async () => {
    // ShopperSession cascades from Person, so this clears both.
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  });

  it("round-trips a personId", async () => {
    const personId = await makePerson();
    const token = await createSession(personId);
    expect(await verifySessionToken(token)).toBe(personId);
  });

  it("issues a different token every time", async () => {
    // Two sign-ins on two devices must be two independently revocable
    // sessions. Deriving the token from the personId would make them one.
    const personId = await makePerson();
    const first = await createSession(personId);
    const second = await createSession(personId);
    expect(first).not.toBe(second);
    expect(await verifySessionToken(first)).toBe(personId);
    expect(await verifySessionToken(second)).toBe(personId);
  });

  it("never stores the token itself", async () => {
    // The point of hashing: a database dump must not yield live sessions.
    const personId = await makePerson();
    const token = await createSession(personId);
    const rows = await prisma.shopperSession.findMany({ where: { personId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).not.toBe(token);
    expect(rows[0]!.tokenHash).not.toContain(token);
  });

  it("identifies which session a token is, not just whose", async () => {
    // The wallet screen marks one row "this device" with it. Without it,
    // two sign-ins on the same day are indistinguishable lines and the
    // sign-out-everywhere prompt asks a question nobody can answer.
    const personId = await makePerson();
    const token = await createSession(personId);

    const identity = await resolveSessionToken(token);
    const rows = await listActiveSessions(personId);
    expect(identity).toEqual({ sessionId: rows[0]!.id, personId });
  });

  it("resolves nothing for a revoked token", async () => {
    const personId = await makePerson();
    const token = await createSession(personId);
    await revokeSessionByToken(token);
    expect(await resolveSessionToken(token)).toBeNull();
  });

  it("rejects a token that matches no session", async () => {
    expect(await verifySessionToken("a".repeat(64))).toBeNull();
  });

  it("rejects malformed tokens without throwing", async () => {
    for (const token of ["", "nonsense", "a.b", "a.b.c.d", "../../etc/passwd", "0"]) {
      expect(await verifySessionToken(token), `token: ${token}`).toBeNull();
    }
  });

  it("rejects a revoked session", async () => {
    // The whole reason this table exists. Under the old stateless token
    // this test was impossible to write.
    const personId = await makePerson();
    const token = await createSession(personId);
    expect(await verifySessionToken(token)).toBe(personId);

    await revokeSessionByToken(token);
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects an expired session", async () => {
    const personId = await makePerson();
    const token = await createSession(personId, new Date(Date.now() - 400 * 24 * 60 * 60 * 1000));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("records why a session was revoked, and does not overwrite it", async () => {
    // "Ended deliberately at 14:05" and "never existed" are different
    // answers when a shopper reports a stolen phone. A second sign-out must
    // not relabel the first one.
    const personId = await makePerson();
    const token = await createSession(personId);

    expect(await revokeSessionByToken(token, ShopperSessionRevokeReason.SIGNED_OUT)).toBe(true);
    const first = await prisma.shopperSession.findFirst({ where: { personId } });
    expect(first!.revokedReason).toBe(ShopperSessionRevokeReason.SIGNED_OUT);

    expect(await revokeSessionByToken(token, ShopperSessionRevokeReason.SIGNED_OUT_EVERYWHERE)).toBe(false);
    const second = await prisma.shopperSession.findFirst({ where: { personId } });
    expect(second!.revokedReason).toBe(ShopperSessionRevokeReason.SIGNED_OUT);
    expect(second!.revokedAt!.getTime()).toBe(first!.revokedAt!.getTime());
  });

  it("revoking one session leaves the others alone", async () => {
    const personId = await makePerson();
    const phone = await createSession(personId);
    const laptop = await createSession(personId);

    await revokeSessionByToken(phone);

    expect(await verifySessionToken(phone)).toBeNull();
    expect(await verifySessionToken(laptop)).toBe(personId);
  });

  it("signing out everywhere ends every session for that person", async () => {
    const personId = await makePerson();
    const tokens = [await createSession(personId), await createSession(personId), await createSession(personId)];

    expect(await revokeAllSessions(personId)).toBe(3);

    for (const token of tokens) {
      expect(await verifySessionToken(token)).toBeNull();
    }
  });

  it("signing out everywhere touches nobody else's sessions", async () => {
    // A personId arriving from the wrong place must not be able to sign the
    // whole platform out. The action reads it from a verified session for
    // exactly this reason; this pins the layer underneath.
    const mine = await makePerson();
    const theirs = await makePerson();
    const myToken = await createSession(mine);
    const theirToken = await createSession(theirs);

    await revokeAllSessions(mine);

    expect(await verifySessionToken(myToken)).toBeNull();
    expect(await verifySessionToken(theirToken)).toBe(theirs);
  });

  it("lists only live sessions, newest first", async () => {
    const personId = await makePerson();
    const older = await createSession(personId, new Date(Date.now() - 60_000));
    await createSession(personId);
    const revoked = await createSession(personId);
    await revokeSessionByToken(revoked);

    const active = await listActiveSessions(personId);
    expect(active).toHaveLength(2);
    expect(active[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(active[1]!.createdAt.getTime());
    expect(await verifySessionToken(older)).toBe(personId);
  });

  it("sweeps rows well past expiry but keeps recent ones", async () => {
    const personId = await makePerson();
    // Created far enough back that expiresAt has cleared the retention
    // window; SESSION_TTL_MS is inside SESSION_RETENTION_MS, so dating the
    // creation by retention alone is not enough.
    const ancient = await createSession(personId, new Date(Date.now() - SESSION_RETENTION_MS * 3));
    const current = await createSession(personId);

    await sweepExpiredSessions();

    expect(await prisma.shopperSession.count({ where: { personId } })).toBe(1);
    expect(await verifySessionToken(current)).toBe(personId);
    expect(await verifySessionToken(ancient)).toBeNull();
  });

  it("never sweeps a session that is still valid", async () => {
    // The sweep deletes rows; a bug here signs live shoppers out.
    const personId = await makePerson();
    const token = await createSession(personId);

    await sweepExpiredSessions();

    expect(await verifySessionToken(token)).toBe(personId);
  });
});
