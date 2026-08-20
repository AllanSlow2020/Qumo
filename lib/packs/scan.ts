import type { LedgerUnit, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { applyAccrual, AccrualRefused } from "@/lib/ledger/accrue";
import { isSerializationConflict, MAX_SERIALIZATION_ATTEMPTS } from "@/lib/db/serialization";
import { looksLikePackCode, normalisePackCode } from "./code";

/**
 * Redeeming a pack code: the shopper-facing half of the Campari path.
 *
 * Two things have to be true at once and neither is negotiable:
 *   1. A code awards exactly once, even if it is scanned twice in the same
 *      instant from two phones (a photographed label shared in a group
 *      chat is the obvious attack, and it costs the brand real money).
 *   2. Burning the code and writing the ledger row either both happen or
 *      neither does. A code marked SCANNED with no matching ledger row is
 *      an award the shopper paid attention for and never received, and
 *      there is no way to detect it after the fact.
 * (1) is a compare-and-swap on status, the idiom transitionCoupon() and
 * consumePasswordResetToken() already use. (2) is why both statements sit
 * inside one transaction.
 */

export type ScanFailureReason =
  | "UNKNOWN_CODE"
  | "ALREADY_SCANNED"
  | "VOID"
  | "CAMPAIGN_NOT_ACTIVE"
  | "CAMPAIGN_ENDED"
  | "CAMPAIGN_NOT_STARTED"
  | "NO_EARN_RULE"
  | "DAILY_LIMIT"
  | "DAILY_SCAN_LIMIT"
  | "CAMPAIGN_EXHAUSTED"
  | "OPTED_OUT";

export type ScanResult =
  | {
      ok: true;
      brandId: string;
      brandName: string;
      campaignName: string;
      amount: number;
      unit: LedgerUnit;
      /** The shopper's balance in this unit at this brand, after the award. */
      newBalance: number;
      /**
       * Set when this scan completed a stamp card. The card's worth of
       * stamps has already been deducted from newBalance above — the
       * surplus, if any, carries forward to the next card.
       */
      coupon: { code: string; name: string } | null;
    }
  | { ok: false; reason: ScanFailureReason };

/** Messages a shopper reads. Every one says what happened and what to do. */
export const SCAN_FAILURE_MESSAGES: Record<ScanFailureReason, string> = {
  UNKNOWN_CODE: "We don't recognise that code. Check the label and try again.",
  ALREADY_SCANNED: "This code has already been used.",
  VOID: "This code is no longer valid.",
  CAMPAIGN_NOT_ACTIVE: "This promotion isn't running at the moment.",
  CAMPAIGN_ENDED: "This promotion has ended.",
  CAMPAIGN_NOT_STARTED: "This promotion hasn't started yet.",
  NO_EARN_RULE: "This promotion isn't set up to award anything yet.",
  DAILY_LIMIT: "You've reached today's limit for this promotion. Your code will still work tomorrow.",
  DAILY_SCAN_LIMIT: "You've scanned as many codes as this promotion allows today. Try again tomorrow.",
  CAMPAIGN_EXHAUSTED: "This promotion has reached its limit and isn't giving out any more.",
  OPTED_OUT: "You've opted out of this brand's rewards. Opt back in to start earning again.",
};

/**
 * A pack code arrives as nothing but a string in a URL, so it has to be
 * resolved before any brand context exists — the same narrow exception to
 * "tenant tables only through forBrand()" that the login-by-email lookup
 * already documents. Everything downstream of this read is brand-scoped by
 * the code's own brandId, never by anything the caller supplied.
 */
async function findCode(canonical: string) {
  return prisma.packCode.findUnique({
    where: { code: canonical },
    include: {
      brand: { select: { id: true, name: true } },
      campaign: {
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          earnRule: {
            select: {
              unit: true,
              amount: true,
              completesAt: true,
              maxPerPersonPerDay: true,
              maxScansPerPersonPerDay: true,
              maxTotalAmount: true,
            },
          },
          reward: {
            select: {
              id: true,
              couponName: true,
              codePrefix: true,
              couponExpiryDate: true,
              maxCoupons: true,
            },
          },
        },
      },
    },
  });
}

type CampaignGate = { status: string; startDate: Date | null; endDate: Date | null };

/**
 * Whether a campaign will accept a scan right now. Pure, so the window
 * rules are testable without a database, and separate from status so a
 * shopper who scans a week early is told that rather than "not running".
 */
export function checkCampaignWindow(campaign: CampaignGate, now: Date): ScanFailureReason | null {
  if (campaign.status !== "ACTIVE") {
    return "CAMPAIGN_NOT_ACTIVE";
  }
  if (campaign.startDate && campaign.startDate > now) {
    return "CAMPAIGN_NOT_STARTED";
  }
  if (campaign.endDate && campaign.endDate < now) {
    return "CAMPAIGN_ENDED";
  }
  return null;
}

/**
 * Claims a pack code for a shopper and awards whatever the campaign's
 * EarnRule says it is worth.
 *
 * Creates the BrandMembership on the way through if this is the shopper's
 * first interaction with the brand: a membership is the record of a real
 * relationship, so it is created by a scan and never by signing up.
 */
export async function redeemPackCode(rawCode: string, personId: string, now: Date = new Date()): Promise<ScanResult> {
  const canonical = normalisePackCode(rawCode);

  // Cheap rejection first — /s/<code> is public, and malformed guesses
  // should never reach the table.
  if (!looksLikePackCode(canonical)) {
    return { ok: false, reason: "UNKNOWN_CODE" };
  }

  const packCode = await findCode(canonical);
  if (!packCode) {
    return { ok: false, reason: "UNKNOWN_CODE" };
  }
  if (packCode.status === "VOID") {
    return { ok: false, reason: "VOID" };
  }
  if (packCode.status === "SCANNED") {
    return { ok: false, reason: "ALREADY_SCANNED" };
  }

  const windowFailure = checkCampaignWindow(packCode.campaign, now);
  if (windowFailure) {
    return { ok: false, reason: windowFailure };
  }

  const earnRule = packCode.campaign.earnRule;
  if (!earnRule) {
    return { ok: false, reason: "NO_EARN_RULE" };
  }

  const brandId = packCode.brandId;

  const reward = packCode.campaign.reward;

  // Everything from here is one transaction: the code is burned, the
  // ledger row written, and any completed stamp card settled together —
  // or none of it happens.
  //
  // Serializable, because the completion check reads a balance and then
  // writes based on it. Without it, two scans landing together could each
  // see nine stamps, each decide the card is complete, and issue two
  // coupons for one card. Postgres refuses that interleaving and the
  // attempt is retried — see lib/db/serialization.ts.
  let claimed: { newBalance: number; coupon: { code: string; name: string } | null } | null = null;

  for (let attempt = 0; attempt < MAX_SERIALIZATION_ATTEMPTS; attempt += 1) {
    try {
      claimed = await prisma.$transaction(
        async (tx) => {
          const membership = await upsertMembership(tx, brandId, personId);

          // The real enforcement. Conditioning the update on the status we
          // believe the row has means two concurrent scans of one code
          // cannot both succeed — the loser updates zero rows and is told
          // the code is already used, which is exactly true.
          const burn = await tx.packCode.updateMany({
            where: { id: packCode.id, status: "UNSCANNED" },
            data: { status: "SCANNED", scannedAt: now, scannedByMembershipId: membership.id },
          });
          if (burn.count !== 1) {
            return null;
          }

          // Both scan sources write the ledger through one function, so a
          // stamp earned from a pack behaves identically to one earned at
          // a till — see lib/ledger/accrue.ts.
          return applyAccrual(tx, {
            brandId,
            campaignId: packCode.campaignId,
            brandMembershipId: membership.id,
            optedOutAt: membership.optedOutAt,
            rule: {
              unit: earnRule.unit,
              amount: earnRule.amount,
              completesAt: earnRule.completesAt,
              maxPerPersonPerDay: earnRule.maxPerPersonPerDay,
              maxScansPerPersonPerDay: earnRule.maxScansPerPersonPerDay,
              maxTotalAmount: earnRule.maxTotalAmount,
            },
            reward,
            reason: "PACK_SCAN_AWARDED",
          });
        },
        { isolationLevel: "Serializable" },
      );
      break;
    } catch (err) {
      // The rollback matters more here than on a slip: a pack code is
      // single-use, so a refusal that kept the burn would destroy the only
      // code that box will ever carry.
      if (err instanceof AccrualRefused) {
        return { ok: false, reason: err.refusal };
      }
      if (isSerializationConflict(err) && attempt < MAX_SERIALIZATION_ATTEMPTS - 1) {
        continue;
      }
      throw err;
    }
  }

  if (!claimed) {
    return { ok: false, reason: "ALREADY_SCANNED" };
  }

  return {
    ok: true,
    brandId,
    brandName: packCode.brand.name,
    campaignName: packCode.campaign.name,
    amount: earnRule.amount,
    unit: earnRule.unit,
    newBalance: claimed.newBalance,
    coupon: claimed.coupon,
  };
}

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Find-or-create the membership. upsert rather than a read-then-create,
 * because two codes scanned at once by a brand-new shopper would otherwise
 * both try to create the first membership and one would fail on the
 * unique constraint — losing an award for no reason the shopper could
 * understand.
 */
async function upsertMembership(tx: TxClient, brandId: string, personId: string) {
  return tx.brandMembership.upsert({
    where: { brandId_personId: { brandId, personId } },
    update: {},
    create: { brandId, personId },
  });
}
