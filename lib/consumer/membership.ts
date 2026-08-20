import { prisma } from "@/lib/db/client";
import { forPerson } from "./scope";

/**
 * A shopper leaving, and rejoining, one brand's programme.
 *
 * Per membership rather than per Person, because opting out of one brand
 * says nothing about the others — that is the whole point of a brand-scoped
 * programme, and a single global switch would make "stop emailing me about
 * chicken" also stop a completely unrelated coffee card.
 *
 * Withdrawal never touches the ledger. Someone who opts out keeps every row
 * they earned, and finds the balance where they left it if they come back.
 * Deleting it would be tidier and wrong twice over: it destroys the audit
 * trail behind coupons a brand has already honoured, and it silently
 * confiscates value the shopper earned in good faith. Erasure is a
 * different, slower request that has to reckon with both.
 */

/** The brands this person has a membership with, and whether it is live. */
export async function listProgrammes(
  personId: string,
): Promise<{ brandId: string; brandName: string; optedOutAt: Date | null; joinedAt: Date }[]> {
  const memberships = await forPerson(personId).brandMembership.findMany({
    include: { brand: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return memberships.map((m) => ({
    brandId: m.brand.id,
    brandName: m.brand.name,
    optedOutAt: m.optedOutAt,
    joinedAt: m.joinedAt,
  }));
}

/**
 * Both directions through one function, because they are the same decision
 * and splitting them invites the pair to drift — an opt-out that clears a
 * field its opt-in counterpart forgot to set is the kind of bug nobody
 * finds until someone cannot rejoin.
 *
 * The membership is resolved through the consumer lens first, so a person
 * can only ever move their own; the write then targets that verified id.
 * Same shape as cancelWalletSpend().
 */
export async function setOptOut(personId: string, brandId: string, optedOut: boolean): Promise<boolean> {
  const membership = await forPerson(personId).brandMembership.findFirst({ where: { brandId } });
  if (!membership) {
    return false;
  }

  const result = await prisma.brandMembership.updateMany({
    where: { id: membership.id, personId },
    data: { optedOutAt: optedOut ? new Date() : null },
  });
  return result.count === 1;
}
