import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/security/logger";
import { erasePerson } from "./erase";

/**
 * Letting go of a shopper who stopped coming.
 *
 * POPIA section 14 is the obligation: a record must not be kept longer than
 * is necessary for the purpose it was collected for. A phone number
 * collected to run a rewards programme has no purpose left once the person
 * has not touched the programme in years, and "we might as well keep it"
 * is not one.
 *
 * ── Why this is erasure and not deletion ─────────────────────────────────
 *
 * It calls erasePerson(), which is the same thing a shopper's own Delete
 * button calls, for the reasons set out at the top of lib/consumer/erase.ts:
 * every ledger entry hangs off the person, so removing the row would move a
 * brand's record of what it issued. The number, the hash, the name and the
 * suburb go; an anonymous financial fact stays. Nobody's books move because
 * somebody stopped shopping.
 *
 * ── Why the window is not decided here ───────────────────────────────────
 *
 * How long is too long is a business and legal question, not an engineering
 * one, and docs/popia.md records it as open. So the mechanism exists and the
 * number does not: with QUMO_DORMANT_ERASE_AFTER_DAYS unset this sweep does
 * nothing at all and says so. Setting it is a deliberate act with a date
 * attached, which is what a retention policy is.
 *
 * ── The floor, and why there is one ──────────────────────────────────────
 *
 * A mistyped value in an environment variable is the whole risk of this
 * file. "30" instead of "1095" would erase most of a brand's customer base
 * overnight, irreversibly, through a cron nobody was watching. So anything
 * under a year is refused outright rather than clamped - clamping would
 * carry out an instruction nobody meant to give, quietly.
 */

/** Below this, a configured window is treated as a mistake rather than a policy. */
export const MIN_DORMANT_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

export type DormancySweepResult =
  | { ran: false; reason: "not_configured" | "window_too_short" }
  | { ran: true; erased: number; cutoff: Date };

/**
 * Reads the configured window, refusing anything that looks like a slip.
 *
 * Exported so the sweep's behaviour can be tested without reaching for the
 * process environment inside an assertion.
 */
export function dormancyWindowDays(raw: string | undefined): number | null {
  const parsed = Number(raw?.trim());
  if (!raw?.trim() || !Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < MIN_DORMANT_DAYS) {
    return null;
  }
  return parsed;
}

/**
 * Erases shoppers who have shown no sign of life inside the window.
 *
 * "No sign of life" is four separate things, and all four have to be true.
 * Three of them are activity; the fourth is the one that stops this being a
 * way to destroy something a person still owns:
 *
 *   - no ledger entry, ever, inside the window. Earning or spending is the
 *     clearest possible evidence that somebody is still a customer.
 *   - no session created inside the window. Opening the wallet to look at a
 *     balance leaves no ledger row, and somebody checking their stamps is
 *     plainly still using this.
 *   - no consent given or re-affirmed inside the window, which also covers
 *     an account created recently that has not scanned anything yet.
 *   - no reward they can still claim. A shopper sitting on an unexpired
 *     coupon has something of value here, dormant or not, and erasing them
 *     would leave a code nobody can be matched to.
 *
 * Done one person at a time rather than in a bulk update, deliberately.
 * erasePerson() is a transaction that revokes sessions, destroys the
 * passcode trail and overwrites the hash, and reimplementing any of that
 * here is how the two drift apart - the second copy being the one that
 * forgets a table, which is exactly the bug this whole piece of work came
 * out of. A sweep that runs nightly over a handful of rows has no reason to
 * be clever.
 */
export async function sweepDormantShoppers(now: Date = new Date()): Promise<DormancySweepResult> {
  const raw = process.env.QUMO_DORMANT_ERASE_AFTER_DAYS;
  if (!raw?.trim()) {
    return { ran: false, reason: "not_configured" };
  }

  const days = dormancyWindowDays(raw);
  if (days === null) {
    logger.warn("dormancy sweep: refusing a window under the floor", { raw, floor: MIN_DORMANT_DAYS });
    return { ran: false, reason: "window_too_short" };
  }

  const cutoff = new Date(now.getTime() - days * DAY_MS);

  const dormant = await prisma.person.findMany({
    where: {
      erasedAt: null,
      createdAt: { lt: cutoff },
      // An account that has never consented is still an account, so this is
      // "not recently", not "never" - a null consentGivenAt passes.
      OR: [{ consentGivenAt: null }, { consentGivenAt: { lt: cutoff } }],
      brandMemberships: {
        none: {
          OR: [
            { pointsTransactions: { some: { createdAt: { gte: cutoff } } } },
            { coupons: { some: { status: "ISSUED", OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] } } },
          ],
        },
      },
      shopperSessions: { none: { createdAt: { gte: cutoff } } },
    },
    select: { id: true },
  });

  let erased = 0;
  for (const person of dormant) {
    await erasePerson(person.id, now);
    erased += 1;
  }

  logger.info("dormancy sweep: run complete", { days, cutoff, erased });
  return { ran: true, erased, cutoff };
}
