import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/security/logger";

/**
 * Deleting a shopper, and what that can honestly mean.
 *
 * The privacy notice promises deletion and this is the code that keeps it.
 * It does not run `DELETE FROM "Person"`, and the reason is worth setting
 * out, because "we deleted everything" is the easy sentence and the wrong
 * one.
 *
 * ── Why the row survives ─────────────────────────────────────────────────
 *
 * Every ledger entry hangs off a BrandMembership, which hangs off a Person,
 * with `onDelete: Cascade` the whole way down. Deleting the person would
 * therefore delete the brand's record of what it issued. A brand that gave
 * away R80,000 last quarter would find that number had changed because
 * somebody left this quarter, their outstanding liability would move
 * underneath them, and nothing in the system could explain the difference.
 * The shopper's right to disappear does not extend to rewriting somebody
 * else's books.
 *
 * So what is deleted is everything that makes the row a person: the number,
 * the hash of the number, the name, the suburb. What is kept is a row that
 * records that *somebody* earned R25 at a store on a date - which is a
 * financial fact about the brand, and is no longer about anyone.
 *
 * That is erasure rather than deletion, and the privacy notice now says so
 * in those words. The version it says it under was bumped for exactly this
 * reason: the old wording promised more than any system holding a financial
 * record can deliver, and correcting a promise is a change of substance.
 *
 * ── Why it is unreachable, not just flagged ──────────────────────────────
 *
 * `erasedAt` is a record of intent. It is not the enforcement. The
 * enforcement is that `phoneHash` is overwritten with a value no phone
 * number can hash to, so every lookup in the system - login, the inbound
 * SMS channel, anything added later - simply fails to find it, without any
 * of them having to remember to check a flag. A guard that has to be
 * remembered is a guard that will be forgotten by whoever writes the next
 * channel.
 *
 * The number is therefore free again. Somebody signing in on it afterwards
 * gets a new, empty account, which is the correct answer both for a person
 * who changed their mind and for whoever is issued that number next.
 */

/** Deliberately not hex: nothing HMAC-SHA256 ever produces can collide with it. */
function unreachableHash(): string {
  return `erased:${randomUUID()}`;
}

export type EraseResult = {
  /** Sessions ended by this. Logged rather than shown - it is an operator's number. */
  sessionsRevoked: number;
};

/**
 * Erase one shopper, by their own request.
 *
 * Idempotent: erasing an already-erased person is a no-op rather than an
 * error, because the caller is a form that can be submitted twice and the
 * second submission should not look like a failure.
 */
export async function erasePerson(personId: string, now: Date = new Date()): Promise<EraseResult> {
  return prisma.$transaction(async (tx) => {
    const person = await tx.person.findUnique({
      where: { id: personId },
      select: { id: true, erasedAt: true },
    });

    if (!person || person.erasedAt) {
      return { sessionsRevoked: 0 };
    }

    // Deleted outright rather than revoked. Everywhere else in this system a
    // session is revoked with a stamp, because "ended deliberately at 14:05"
    // and "never existed" are different answers and the first one is what a
    // shopper reporting a stolen phone needs. That reasoning inverts here:
    // the rows are a list of when this person used the service and from
    // where, which is precisely the kind of record they have just asked us
    // not to keep.
    const { count } = await tx.shopperSession.deleteMany({ where: { personId } });

    await tx.person.update({
      where: { id: personId },
      data: {
        phoneHash: unreachableHash(),
        // Not a marker anybody could mistake for ciphertext. decryptPhone()
        // on this throws, which is the right outcome for every caller: the
        // number is gone, and a caller that wanted it should fail loudly
        // rather than carry on with a plausible-looking empty string.
        phoneEncrypted: "",
        firstName: null,
        suburb: null,
        // consentGivenAt and consentVersion stay. They are not about the
        // person any more - with the identifiers gone they say only that
        // the rows beneath them were collected lawfully and under which
        // text, which is the question an audit asks about retained data.
        erasedAt: now,
      },
    });

    // The personId is logged and it is not an identifier of a person any
    // more: after this transaction nothing in the system can turn it back
    // into a number or a name. It is what makes "who complained that their
    // erasure did not work" answerable.
    logger.info("shopper erased at their own request", { personId, sessionsRevoked: count });

    return { sessionsRevoked: count };
  });
}
