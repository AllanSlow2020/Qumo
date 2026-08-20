import { Prisma, type LedgerUnit } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/security/crypto";
import { isSerializationConflict, MAX_SERIALIZATION_ATTEMPTS } from "@/lib/db/serialization";
import { applyAccrual, AccrualRefused, percentOfSpend } from "@/lib/ledger/accrue";
import { checkCampaignWindow } from "@/lib/packs/scan";
import { parseReceiptPayload, signingMessage, verifySignature } from "./payload";

/**
 * Redeeming a scanned till slip — the shopper-facing half of the
 * Chicken Licken path.
 *
 * Three defences, and it is worth being clear which one does what, because
 * only two of them are always available:
 *
 *   1. The signature stops a shopper editing `c=8500` to `c=85000` before
 *      scanning. Available only where the store has a signing secret.
 *   2. The unique constraint on (storeId, externalTxnId) stops the same
 *      slip being scanned twice, or photographed and shared. Always
 *      available, and it is a database constraint rather than a check
 *      because two phones scanning one photo at the same instant would
 *      sail past an `if`.
 *   3. The freshness window stops a hoard of old slips being scanned the
 *      day a campaign launches. Always available.
 *
 * An unsigned store therefore still gets real protection — a slip works
 * once, and only once, and only if it is recent. What it loses is
 * protection against a shopper who edits the amount on their own receipt.
 * That is a meaningful downgrade and the dashboard names it, but it is a
 * long way from nothing, and it is the difference between shipping to a
 * brand whose vendor cannot sign and not shipping to them at all.
 */

export type ReceiptFailureReason =
  | "MALFORMED"
  | "UNKNOWN_STORE"
  | "STORE_INACTIVE"
  | "BAD_SIGNATURE"
  | "SIGNATURE_REQUIRED"
  | "ALREADY_SCANNED"
  | "TOO_OLD"
  | "FUTURE_DATED"
  | "NO_CAMPAIGN"
  | "BELOW_MINIMUM"
  | "DAILY_LIMIT"
  | "DAILY_SCAN_LIMIT"
  | "CAMPAIGN_EXHAUSTED"
  | "OPTED_OUT";

export type ReceiptResult =
  | {
      ok: true;
      brandId: string;
      brandName: string;
      storeName: string;
      campaignName: string;
      amountCents: number;
      awarded: number;
      unit: LedgerUnit;
      newBalance: number;
      coupon: { code: string; name: string } | null;
      /**
       * True when this slip had already been redeemed by this same shopper
       * and we are showing them the award again rather than making a new
       * one. Not an error: re-opening a scanned slip is a normal thing to
       * do, and "you earned R6.00 from this" stays true however many times
       * it is asked.
       */
      alreadyEarned: boolean;
    }
  | { ok: false; reason: ReceiptFailureReason };

export const RECEIPT_FAILURE_MESSAGES: Record<ReceiptFailureReason, string> = {
  MALFORMED: "We couldn't read that slip. Try scanning it again.",
  UNKNOWN_STORE: "We don't recognise that store.",
  STORE_INACTIVE: "That store isn't taking scans at the moment.",
  BAD_SIGNATURE: "That slip couldn't be verified. Please show it to a staff member.",
  SIGNATURE_REQUIRED: "That slip couldn't be verified. Please show it to a staff member.",
  ALREADY_SCANNED: "This slip has already been scanned.",
  TOO_OLD: "This slip is too old to earn on.",
  FUTURE_DATED: "We couldn't read the date on that slip.",
  NO_CAMPAIGN: "There's no rewards promotion running here right now.",
  BELOW_MINIMUM: "This purchase is below the minimum for this promotion.",
  DAILY_LIMIT: "You've reached today's limit for this promotion. Your slip will still work tomorrow.",
  DAILY_SCAN_LIMIT: "You've scanned as many slips as this promotion allows today. Try again tomorrow.",
  CAMPAIGN_EXHAUSTED: "This promotion has reached its limit and isn't giving out any more.",
  OPTED_OUT: "You've opted out of this brand's rewards. Opt back in to start earning again.",
};

/**
 * How long a slip stays scannable. Generous, because a shopper who finds a
 * receipt in a coat pocket a fortnight later and earns from it is a good
 * outcome — but not unbounded, or a campaign launch invites everyone to
 * scan a year of hoarded slips at once.
 */
const MAX_RECEIPT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Small tolerance for a till whose clock is a few minutes fast. */
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;

/**
 * A slip resolves to a store by its code alone, before any brand context
 * exists — the same narrow, documented exception to forBrand() that pack
 * codes and the login-by-email lookup already are. Everything after this is
 * scoped by the store's own brandId.
 */
async function findStore(storeCode: string) {
  return prisma.store.findUnique({
    where: { code: storeCode },
    include: { brand: { select: { id: true, name: true } } },
  });
}

/**
 * The brand's live percent-of-spend campaign. At most one can be active at
 * a time — enforced when a rule is configured (lib/stores/manage.ts), so
 * that this resolution is never ambiguous and a slip can never be worth a
 * different amount depending on which campaign happened to be found first.
 */
async function findSpendCampaign(brandId: string, now: Date) {
  const campaigns = await prisma.campaign.findMany({
    where: { brandId, status: "ACTIVE", earnRule: { type: "PERCENT_OF_SPEND" } },
    include: {
      earnRule: true,
      reward: {
        select: { id: true, couponName: true, codePrefix: true, couponExpiryDate: true, maxCoupons: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return campaigns.find((campaign) => checkCampaignWindow(campaign, now) === null) ?? null;
}

/**
 * Answers "what happened to this slip?" for a slip that has already been
 * redeemed.
 *
 * The distinction that matters is whose it was. For the person who redeemed
 * it, this is a receipt: the same award, shown again, flagged so the page
 * can word it as history rather than news. For anyone else it is exactly
 * the refusal the unique constraint exists to produce — a photographed or
 * shared slip earning twice is the thing being stopped.
 */
async function describeExistingScan(
  storeId: string,
  externalTxnId: string,
  personId: string,
  store: { brandId: string; name: string; brand: { name: string } },
  campaign: { name: string },
  unit: LedgerUnit,
): Promise<ReceiptResult> {
  const existing = await prisma.purchaseScan.findUnique({
    where: { storeId_externalTxnId: { storeId, externalTxnId } },
    include: { brandMembership: { select: { personId: true, id: true } } },
  });

  if (!existing || existing.brandMembership.personId !== personId) {
    return { ok: false, reason: "ALREADY_SCANNED" };
  }

  // Read back rather than recomputed: the earn rule may have changed since,
  // and this has to answer what they got, not what the same basket would be
  // worth today.
  const totals = await prisma.pointsTransaction.aggregate({
    where: { brandMembershipId: existing.brandMembershipId, unit: existing.awardedUnit ?? unit },
    _sum: { amount: true },
  });

  return {
    ok: true,
    brandId: store.brandId,
    brandName: store.brand.name,
    storeName: store.name,
    campaignName: campaign.name,
    amountCents: existing.amountCents,
    awarded: existing.awardedAmount ?? 0,
    unit: existing.awardedUnit ?? unit,
    newBalance: totals._sum.amount ?? 0,
    // Deliberately not re-issued. A coupon is a one-time thing and showing
    // it again would invite a second redemption attempt at a counter.
    coupon: null,
    alreadyEarned: true,
  };
}

export async function redeemReceipt(
  rawQuery: string | URLSearchParams,
  personId: string,
  now: Date = new Date(),
): Promise<ReceiptResult> {
  const params = typeof rawQuery === "string" ? new URLSearchParams(rawQuery) : rawQuery;
  const parsed = parseReceiptPayload(params);
  if (typeof parsed === "string") {
    return { ok: false, reason: "MALFORMED" };
  }

  const store = await findStore(parsed.storeCode);
  if (!store) {
    return { ok: false, reason: "UNKNOWN_STORE" };
  }
  if (!store.isActive) {
    return { ok: false, reason: "STORE_INACTIVE" };
  }

  // Signature check before anything else touches the amount, so a forged
  // total is rejected without ever being read as a number that matters.
  let wasSigned = false;
  if (store.signingSecretEncrypted) {
    if (!parsed.signature) {
      // A signed store that receives an unsigned slip is being probed:
      // someone has worked out that dropping `g` might skip the check.
      return { ok: false, reason: "SIGNATURE_REQUIRED" };
    }
    const secret = decryptSecret(store.signingSecretEncrypted);
    const message = signingMessage({
      storeCode: parsed.storeCode,
      externalTxnId: parsed.externalTxnId,
      amountCents: parsed.amountCents,
      purchasedAtUnix: Math.floor(parsed.purchasedAt.getTime() / 1000),
    });
    if (!verifySignature(secret, message, parsed.signature)) {
      return { ok: false, reason: "BAD_SIGNATURE" };
    }
    wasSigned = true;
  }

  const age = now.getTime() - parsed.purchasedAt.getTime();
  if (age > MAX_RECEIPT_AGE_MS) {
    return { ok: false, reason: "TOO_OLD" };
  }
  if (age < -MAX_CLOCK_SKEW_MS) {
    return { ok: false, reason: "FUTURE_DATED" };
  }

  const campaign = await findSpendCampaign(store.brandId, now);
  const rule = campaign?.earnRule;
  // basisPoints is nullable on the model because a FLAT_PER_SCAN rule has
  // no use for it; a PERCENT_OF_SPEND rule without one is a half-configured
  // campaign, and awarding nothing is the right answer until it is fixed.
  if (!campaign || !rule || rule.basisPoints == null) {
    return { ok: false, reason: "NO_CAMPAIGN" };
  }

  if (rule.minSpendCents != null && parsed.amountCents < rule.minSpendCents) {
    return { ok: false, reason: "BELOW_MINIMUM" };
  }

  const awarded = percentOfSpend(parsed.amountCents, rule.basisPoints);
  if (awarded <= 0) {
    // A basket small enough that the percentage rounds to nothing. Told as
    // a minimum rather than as a zero award, which would read as a bug.
    return { ok: false, reason: "BELOW_MINIMUM" };
  }

  const brandId = store.brandId;

  for (let attempt = 0; attempt < MAX_SERIALIZATION_ATTEMPTS; attempt += 1) {
    try {
      const claimed = await prisma.$transaction(
        async (tx) => {
          const membership = await tx.brandMembership.upsert({
            where: { brandId_personId: { brandId, personId } },
            update: {},
            create: { brandId, personId },
          });

          // The replay guard. Inserted before anything is awarded, so the
          // unique constraint — not a prior read — is what decides whether
          // this slip has been seen. A duplicate throws P2002 and the whole
          // transaction rolls back, awarding nothing.
          const scan = await tx.purchaseScan.create({
            data: {
              brandId,
              storeId: store.id,
              brandMembershipId: membership.id,
              campaignId: campaign.id,
              externalTxnId: parsed.externalTxnId,
              amountCents: parsed.amountCents,
              purchasedAt: parsed.purchasedAt,
              scannedAt: now,
              wasSigned,
            },
          });

          const accrued = await applyAccrual(tx, {
            brandId,
            campaignId: campaign.id,
            brandMembershipId: membership.id,
            optedOutAt: membership.optedOutAt,
            rule: {
              unit: rule.unit,
              amount: awarded,
              completesAt: rule.completesAt,
              maxPerPersonPerDay: rule.maxPerPersonPerDay,
              maxScansPerPersonPerDay: rule.maxScansPerPersonPerDay,
              maxTotalAmount: rule.maxTotalAmount,
            },
            reward: campaign.reward,
            reason: "PURCHASE_ACCRUAL",
          });

          // Written after the accrual because that is when the amount is
          // known, and inside the same transaction because a scan row that
          // survives without its award would be the incomplete record this
          // column exists to prevent.
          await tx.purchaseScan.update({
            where: { id: scan.id },
            data: { awardedAmount: awarded, awardedUnit: rule.unit },
          });

          return accrued;
        },
        { isolationLevel: "Serializable" },
      );

      return {
        ok: true,
        brandId,
        brandName: store.brand.name,
        storeName: store.name,
        campaignName: campaign.name,
        amountCents: parsed.amountCents,
        awarded,
        unit: rule.unit,
        newBalance: claimed.newBalance,
        coupon: claimed.coupon,
        alreadyEarned: false,
      };
    } catch (err) {
      // Thrown from inside the transaction on purpose: the rollback is what
      // leaves the slip scannable tomorrow instead of burnt on an award the
      // shopper never received.
      if (err instanceof AccrualRefused) {
        return { ok: false, reason: err.refusal };
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // The replay guard fired. Before calling that a failure, ask whose
        // scan it was: a shopper re-opening their own slip — by refreshing,
        // by going back, or because the framework rendered this page twice
        // on one navigation — has done nothing wrong and should see what
        // they earned, not an accusation.
        return describeExistingScan(store.id, parsed.externalTxnId, personId, store, campaign, rule.unit);
      }
      if (isSerializationConflict(err) && attempt < MAX_SERIALIZATION_ATTEMPTS - 1) {
        continue;
      }
      throw err;
    }
  }

  return { ok: false, reason: "ALREADY_SCANNED" };
}
