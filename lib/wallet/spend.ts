import { randomInt } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { forBrand } from "@/lib/db/tenant";
import { forPerson } from "@/lib/consumer/scope";
import { requireRole } from "@/lib/auth/rbac";
import { isSerializationConflict, MAX_SERIALIZATION_ATTEMPTS } from "@/lib/db/serialization";

/**
 * Spending a closed-loop wallet balance at a till, in two steps.
 *
 * Step one is the shopper asking: a PENDING row and a short code, valid
 * for a few minutes. Nothing is debited. Step two is a cashier confirming
 * they actually handed over the discount, and *that* writes the ledger.
 *
 * Doing it the other way round — debiting when the shopper generates the
 * code — looks simpler and is wrong. A code the cashier never honours
 * (the queue moved on, the phone locked, they changed their mind at the
 * counter) would silently destroy real money belonging to a real person,
 * with no event anyone could point at afterwards. An unconfirmed request
 * has to cost nothing.
 *
 * The price of not holding funds is that the balance is only checked when
 * the cashier confirms. Two tills confirming two requests at once could
 * each see enough balance and overdraw between them, so confirmation runs
 * Serializable: read balance, check it, transition status and write the
 * ledger row as one indivisible step, retried if Postgres refuses the
 * interleaving.
 */

export const CONFIRM_SPEND_ROLES: Role[] = ["OWNER", "ADMIN", "MARKETING", "QUALITY"];

export class WalletSpendError extends Error {}

export type StaffSessionLike = { user: { brandId: string; role: string; id: string } };

/** Long enough not to collide in a queue, short enough to read aloud. */
const CODE_DIGITS = 6;
const SPEND_TTL_MS = 5 * 60 * 1000;

/**
 * Digits, not the pack-code alphabet: a cashier types this from a
 * shopper's screen while people wait, and a numeric keypad is faster and
 * less error-prone than hunting for letters. Guessing is not the threat
 * here the way it is for a pack code — a guessed spend code only lets
 * someone spend *another shopper's* balance at a till where staff can see
 * both of them, and it dies in five minutes.
 */
function generateSpendCode(): string {
  return String(randomInt(0, 10 ** CODE_DIGITS)).padStart(CODE_DIGITS, "0");
}

export type PendingSpend = {
  id: string;
  code: string;
  amountCents: number;
  expiresAt: Date;
  brandId: string;
  brandName: string;
};

/**
 * The shopper's half: create a request to spend `amountCents` at `brandId`.
 *
 * Only one request can be live at a time per membership. A shopper at a
 * till is doing one transaction, and allowing several would mean several
 * codes that individually fit the balance but together exceed it — every
 * one of which would pass its own check. Starting a new request cancels
 * the previous one.
 */
export async function createWalletSpend(
  personId: string,
  brandId: string,
  amountCents: number,
  now: Date = new Date(),
): Promise<PendingSpend> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new WalletSpendError("Enter an amount to spend.");
  }

  // Through the consumer lens, so this can only ever resolve a membership
  // belonging to the shopper making the request.
  const membership = await forPerson(personId).brandMembership.findFirst({
    where: { brandId },
    include: { brand: { select: { name: true } } },
  });
  if (!membership) {
    throw new WalletSpendError("You don't have a balance with this brand yet.");
  }

  const balance = await getWalletBalanceCents(prisma, membership.id);
  if (amountCents > balance) {
    // A friendly early rejection. It is not the enforcement — that happens
    // again at confirmation, because the balance can move in between.
    throw new WalletSpendError("That's more than your balance.");
  }

  const spend = await prisma.$transaction(async (tx) => {
    await tx.walletSpend.updateMany({
      where: { brandMembershipId: membership.id, status: "PENDING" },
      data: { status: "CANCELLED" },
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await tx.walletSpend.create({
          data: {
            brandId,
            brandMembershipId: membership.id,
            amountCents,
            code: generateSpendCode(),
            expiresAt: new Date(now.getTime() + SPEND_TTL_MS),
          },
        });
      } catch (err) {
        // Six digits across every live request in the platform will
        // occasionally collide; retry rather than fail a shopper at a till.
        const isCollision =
          err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002";
        if (!isCollision || attempt === 2) {
          throw err;
        }
      }
    }
    throw new WalletSpendError("Couldn't start that payment. Please try again.");
  });

  return {
    id: spend.id,
    code: spend.code,
    amountCents: spend.amountCents,
    expiresAt: spend.expiresAt,
    brandId,
    brandName: membership.brand.name,
  };
}

/** The shopper's live request at a brand, if any — for rendering the code. */
export async function getPendingSpend(personId: string, brandId: string, now: Date = new Date()) {
  return forPerson(personId).walletSpend.findFirst({
    where: { brandId, status: "PENDING", expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
}

export async function cancelWalletSpend(personId: string, spendId: string): Promise<void> {
  // Read through the consumer lens first, so a shopper can only cancel
  // their own request; the write then targets that verified id.
  const spend = await forPerson(personId).walletSpend.findFirst({ where: { id: spendId, status: "PENDING" } });
  if (!spend) {
    return;
  }
  await prisma.walletSpend.updateMany({
    where: { id: spend.id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}

type BalanceReader = {
  pointsTransaction: {
    aggregate: (args: {
      where: { brandMembershipId: string; unit: "CENTS" };
      _sum: { amount: true };
    }) => Promise<{ _sum: { amount: number | null } }>;
  };
};

/** Always derived. There is no balance column and there must never be one. */
async function getWalletBalanceCents(client: BalanceReader, brandMembershipId: string): Promise<number> {
  const totals = await client.pointsTransaction.aggregate({
    where: { brandMembershipId, unit: "CENTS" },
    _sum: { amount: true },
  });
  return totals._sum.amount ?? 0;
}

export type ConfirmResult = {
  amountCents: number;
  memberFirstName: string | null;
  newBalanceCents: number;
};

/**
 * Business outcomes are returned from the transaction rather than thrown
 * inside it. Throwing would roll the transaction back — which silently
 * undid the EXPIRED marking below, leaving a lapsed code sitting at
 * PENDING forever and the shopper's screen disagreeing with the brand's
 * records. Anything the transaction needs to persist on its way to
 * refusing has to commit, so refusal is a value here and an exception only
 * once we are outside.
 */
type ConfirmOutcome =
  | { outcome: "ok"; amountCents: number; memberFirstName: string | null; newBalanceCents: number }
  | { outcome: "not_found" }
  | { outcome: "already_used" }
  | { outcome: "not_pending" }
  | { outcome: "expired" }
  | { outcome: "insufficient" };

const CONFIRM_FAILURE_MESSAGES: Record<Exclude<ConfirmOutcome["outcome"], "ok">, string> = {
  not_found: "We don't recognise that code.",
  already_used: "That code has already been used.",
  not_pending: "That code is no longer valid. Ask the shopper for a new one.",
  expired: "That code has expired. Ask the shopper for a new one.",
  insufficient: "The shopper's balance no longer covers that amount.",
};

/**
 * The cashier's half: confirm a code and debit the ledger. Refuses with a
 * WalletSpendError whose message is written to be read aloud at a counter.
 */
export async function confirmWalletSpend(session: StaffSessionLike, rawCode: string): Promise<ConfirmResult> {
  requireRole(session.user.role as Role, CONFIRM_SPEND_ROLES);

  const code = rawCode.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new WalletSpendError("Enter the 6-digit code from the shopper's screen.");
  }

  for (let attempt = 0; attempt < MAX_SERIALIZATION_ATTEMPTS; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx): Promise<ConfirmOutcome> => {
          // Looked up by code and brand together: a cashier at one brand
          // must not be able to confirm a spend against another brand's
          // balance even if they somehow learned the code.
          const spend = await tx.walletSpend.findFirst({
            where: { code, brandId: session.user.brandId },
          });
          if (!spend) {
            return { outcome: "not_found" };
          }
          if (spend.status === "CONFIRMED") {
            return { outcome: "already_used" };
          }
          if (spend.status !== "PENDING") {
            return { outcome: "not_pending" };
          }
          if (spend.expiresAt <= new Date()) {
            await tx.walletSpend.updateMany({
              where: { id: spend.id, status: "PENDING" },
              data: { status: "EXPIRED" },
            });
            return { outcome: "expired" };
          }

          // The real overdraft check. Inside the Serializable transaction,
          // so a second till confirming at the same instant cannot read
          // this same balance and spend it too.
          const balance = await getWalletBalanceCents(tx, spend.brandMembershipId);
          if (spend.amountCents > balance) {
            return { outcome: "insufficient" };
          }

          const claimed = await tx.walletSpend.updateMany({
            where: { id: spend.id, status: "PENDING" },
            data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedByUserId: session.user.id },
          });
          if (claimed.count !== 1) {
            return { outcome: "already_used" };
          }

          await tx.pointsTransaction.create({
            data: {
              brandId: spend.brandId,
              brandMembershipId: spend.brandMembershipId,
              // Negative: spending is a ledger entry like any other, not a
              // decrement of a stored total.
              amount: -spend.amountCents,
              unit: "CENTS",
              reason: "WALLET_SPENT",
            },
          });

          const membership = await tx.brandMembership.findUnique({
            where: { id: spend.brandMembershipId },
            select: { person: { select: { firstName: true } } },
          });

          return {
            outcome: "ok",
            amountCents: spend.amountCents,
            memberFirstName: membership?.person.firstName ?? null,
            newBalanceCents: balance - spend.amountCents,
          };
        },
        { isolationLevel: "Serializable" },
      );

      if (result.outcome !== "ok") {
        throw new WalletSpendError(CONFIRM_FAILURE_MESSAGES[result.outcome]);
      }
      const { outcome: _outcome, ...confirmed } = result;
      return confirmed;
    } catch (err) {
      // A refused interleaving is the system working — retry the whole
      // attempt. A WalletSpendError is a real answer for the cashier.
      if (isSerializationConflict(err) && attempt < MAX_SERIALIZATION_ATTEMPTS - 1) {
        continue;
      }
      throw err;
    }
  }

  throw new WalletSpendError("The till is busy. Please try again.");
}

/**
 * Marks lapsed requests EXPIRED. Nothing depends on this running — an
 * expired PENDING row is already refused at confirmation, and no money was
 * ever held — so it exists only to keep the shopper's screen and the
 * brand's records honest rather than to protect a balance.
 */
export async function expireLapsedSpends(brandId: string, now: Date = new Date()): Promise<number> {
  const result = await forBrand(brandId).walletSpend.updateMany({
    where: { status: "PENDING", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

// Re-exported so the shopper screen can show a balance without reaching
// past this module for it.
export { getWalletBalanceCents };
