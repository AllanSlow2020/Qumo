import { decryptPhone } from "@/lib/security/crypto";
import { prisma } from "@/lib/db/client";
import { forPerson } from "./scope";

/**
 * Everything held about one shopper, in a file they can keep.
 *
 * The privacy notice already told them they could ask for this
 * (lib/consumer/consent.ts, "Your choices"). Nothing implemented it, which
 * made the notice a claim the code could not honour - the exact failure
 * that file's own comment warns about. This is the code catching up with
 * what was promised.
 *
 * Deliberately a plain JSON download rather than an email or a support
 * queue: a request that completes while the person is still looking at the
 * screen is one nobody has to chase, and there is no operational process
 * to forget to run.
 *
 * The phone number is decrypted into the export on purpose. It is the one
 * piece of genuine PII held, the person asking is the person it belongs to,
 * and an export that withheld it would be answering a different question
 * than the one asked.
 */

export type PersonExport = {
  exportedAt: string;
  you: {
    phone: string;
    firstName: string | null;
    joinedAt: string;
    consent: { givenAt: string | null; version: string | null };
  };
  brands: {
    brand: string;
    joinedAt: string;
    optedOut: string | null;
    balances: { unit: string; amount: number }[];
    activity: {
      at: string;
      what: string;
      unit: string;
      amount: number;
      /** The store, for a row that came from a till slip. Null otherwise. */
      where: string | null;
      /** What that basket came to, in cents. Null otherwise. */
      purchaseCents: number | null;
    }[];
    rewards: { code: string; status: string; issuedAt: string }[];
  }[];
  signIns: { startedAt: string; endedAt: string | null }[];
};

/**
 * Read through forPerson() wherever the lens covers the model, so an export
 * cannot become the one place a shopper sees somebody else's rows. Person
 * and ShopperSession are keyed directly by the id from the verified
 * session, which the lens does not cover and does not need to.
 */
export async function exportPerson(personId: string): Promise<PersonExport | null> {
  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person) {
    return null;
  }

  const scoped = forPerson(personId);
  const [memberships, ledger, coupons, sessions] = await Promise.all([
    scoped.brandMembership.findMany({
      include: { brand: { select: { name: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    // Held, therefore exported. The link from a ledger row back to the scan
    // that produced it is data about this person as much as the amount is,
    // and an export that listed "PURCHASE_ACCRUAL, R8.50" while we quietly
    // knew which shop it was in would be answering a narrower question than
    // the one the law says was asked.
    scoped.pointsTransaction.findMany({
      orderBy: { createdAt: "asc" },
      include: { purchaseScan: { select: { amountCents: true, store: { select: { name: true } } } } },
    }),
    scoped.coupon.findMany({ orderBy: { issuedAt: "asc" } }),
    prisma.shopperSession.findMany({
      where: { personId },
      select: { createdAt: true, revokedAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const byMembership = <T extends { brandMembershipId: string }>(rows: T[], id: string) =>
    rows.filter((row) => row.brandMembershipId === id);

  return {
    exportedAt: new Date().toISOString(),
    you: {
      phone: decryptPhone(person.phoneEncrypted),
      firstName: person.firstName,
      joinedAt: person.createdAt.toISOString(),
      consent: {
        givenAt: person.consentGivenAt?.toISOString() ?? null,
        version: person.consentVersion,
      },
    },
    brands: memberships.map((membership) => {
      const rows = byMembership(ledger, membership.id);

      // Summed per unit here rather than read from anywhere, for the same
      // reason the wallet screen does it: there is no stored balance, and
      // an export that invented one could disagree with the rows printed
      // directly beneath it.
      const balances = new Map<string, number>();
      for (const row of rows) {
        balances.set(row.unit, (balances.get(row.unit) ?? 0) + row.amount);
      }

      return {
        brand: membership.brand.name,
        joinedAt: membership.joinedAt.toISOString(),
        optedOut: membership.optedOutAt?.toISOString() ?? null,
        balances: [...balances].map(([unit, amount]) => ({ unit, amount })),
        activity: rows.map((row) => ({
          at: row.createdAt.toISOString(),
          what: row.reason,
          unit: row.unit,
          amount: row.amount,
          where: row.purchaseScan?.store.name ?? null,
          purchaseCents: row.purchaseScan?.amountCents ?? null,
        })),
        rewards: byMembership(coupons, membership.id).map((coupon) => ({
          code: coupon.code,
          status: coupon.status,
          issuedAt: coupon.issuedAt.toISOString(),
        })),
      };
    }),
    // Included because "who has been signed in as me?" is a question a
    // shopper has a real interest in and cannot otherwise answer for
    // sessions that have already ended.
    signIns: sessions.map((s) => ({
      startedAt: s.createdAt.toISOString(),
      endedAt: s.revokedAt?.toISOString() ?? null,
    })),
  };
}
