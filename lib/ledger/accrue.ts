import type { LedgerUnit, PointsReason, Prisma } from "@prisma/client";
import { createCouponWithRetry } from "@/lib/coupons/issue";
import { programmeState, type SubscriptionRow } from "@/lib/subscriptions/state";

/**
 * The one place a scan turns into ledger movement.
 *
 * There are two ways to earn now — a code under a pack label, and a share
 * of a scanned till slip — and the design note's whole premise is that they
 * are the same event past the point where the amount is decided. Keeping
 * two copies of "write the row, re-read the balance, complete the card,
 * deduct it" is how that premise quietly stops being true: one of them
 * gains a fix the other doesn't, and a stamp earned by scanning a pack
 * starts behaving differently from one earned at a till.
 *
 * Runs inside a caller-supplied transaction, always. It reads a balance and
 * writes based on it, so it must be inside the same Serializable
 * transaction that claimed whatever is being redeemed — otherwise two
 * concurrent scans could each see nine stamps and issue two coupons for
 * one card.
 */

/**
 * Structural, so both scan paths can pass their own transaction client —
 * they reach here with clients extended in different ways and naming a
 * concrete Prisma type would force one of them into a cast.
 *
 * The `data` shapes are Prisma's own input types rather than a loose
 * record: a parameter accepting anything cannot stand in for one accepting
 * something specific, so a looser type here does not widen what callers may
 * pass, it just fails to compile.
 */
type LedgerWindow = {
  brandMembershipId?: string;
  campaignId?: string;
  unit: LedgerUnit;
  amount?: { gt: number };
  createdAt?: { gte: Date };
};

type AccrualTx = {
  pointsTransaction: {
    create: (args: { data: Prisma.PointsTransactionUncheckedCreateInput }) => Promise<unknown>;
    aggregate: (args: {
      where: LedgerWindow;
      _sum: { amount: true };
    }) => Promise<{ _sum: { amount: number | null } }>;
    count: (args: { where: LedgerWindow }) => Promise<number>;
  };
  coupon: {
    count: (args: { where: { rewardId: string } }) => Promise<number>;
    create: (args: { data: Prisma.CouponUncheckedCreateInput }) => Promise<unknown>;
  };
  subscription: {
    findUnique: (args: {
      where: { brandId: string };
      select: { status: true; cancelledAt: true; honourRedemptionUntil: true };
    }) => Promise<SubscriptionRow>;
  };
};

/**
 * Why a scan earned nothing. Each maps to a sentence a shopper can act on,
 * which is the point of distinguishing them: "you have reached today's
 * limit" and "this promotion has ended" ask for completely different things
 * from the person holding the slip.
 */
export type AccrualRefusal =
  | "DAILY_LIMIT"
  | "DAILY_SCAN_LIMIT"
  | "CAMPAIGN_EXHAUSTED"
  | "OPTED_OUT"
  | "PROGRAMME_CLOSED";

/**
 * Thrown, not returned, and deliberately.
 *
 * Every caller reaches applyAccrual having already written something that
 * must not survive a refusal — the PurchaseScan row that the replay guard
 * keys on, or the claim on a single-use pack code. Throwing rolls the whole
 * transaction back, so a shopper who hits a ceiling keeps a slip they can
 * scan tomorrow instead of one silently burnt on an award they never got.
 *
 * A returned value would leave that rollback to each caller to remember,
 * and the failure mode of forgetting is invisible: the scan looks fine and
 * the shopper is quietly robbed of a real purchase.
 */
export class AccrualRefused extends Error {
  constructor(readonly refusal: AccrualRefusal) {
    super(`Accrual refused: ${refusal}`);
    this.name = "AccrualRefused";
  }
}

/**
 * A rolling twenty-four hours rather than a calendar day. A calendar
 * boundary hands anyone who notices it a doubled allowance at midnight, and
 * the shopper it inconveniences — someone who bought lunch at 13:00
 * yesterday and again today — is exactly the one it should not.
 */
const WINDOW_MS = 24 * 60 * 60 * 1000;

export type AccrualRule = {
  unit: LedgerUnit;
  /** Already resolved to an integer in `unit` by the caller. */
  amount: number;
  /** Card size, or null for a campaign that only accrues. */
  completesAt: number | null;
  /** Value in `unit` one person may accrue per rolling day. Null is uncapped. */
  maxPerPersonPerDay?: number | null;
  /** Accrual events per person per rolling day. Null is uncapped. */
  maxScansPerPersonPerDay?: number | null;
  /** Total value in `unit` this campaign may ever issue. Null is uncapped. */
  maxTotalAmount?: number | null;
};

export type AccrualReward = {
  id: string;
  couponName: string | null;
  codePrefix: string | null;
  couponExpiryDate: Date | null;
  /** The brand's liability cap. Null means uncapped. */
  maxCoupons: number | null;
} | null;

export type AccrualResult = {
  /** Balance in the rule's unit after the award and any completion. */
  newBalance: number;
  coupon: { code: string; name: string } | null;
};

/**
 * The four gates between a valid scan and a ledger row.
 *
 * Every query here runs on the caller's transaction client, which is always
 * Serializable. That is the whole design: read the totals and write the row
 * as one indivisible step, so two scans arriving together cannot each read a
 * total below the ceiling and both write. Checked outside the transaction
 * these are decoration — the race they exist to stop is precisely the one an
 * attacker will drive.
 *
 * Only positive rows count toward a ceiling. Spending a wallet balance and
 * completing a stamp card both write negative rows, and letting a redemption
 * quietly restore someone's daily allowance would make the cap a suggestion.
 */
async function assertWithinCeilings(
  tx: AccrualTx,
  input: {
    campaignId: string;
    brandMembershipId: string;
    rule: AccrualRule;
    optedOutAt: Date | null;
    now: Date;
  },
): Promise<void> {
  const { campaignId, brandMembershipId, rule, optedOutAt, now } = input;

  // Read from the row the caller upserted inside this same transaction, so
  // it is as transactional as a query here would be — and one round trip
  // cheaper on every scan.
  if (optedOutAt) {
    throw new AccrualRefused("OPTED_OUT");
  }

  // A rule that awards nothing cannot breach a ceiling, and asking three
  // questions to establish that wastes a round trip on every stamp scan.
  const capped =
    rule.maxPerPersonPerDay != null || rule.maxScansPerPersonPerDay != null || rule.maxTotalAmount != null;
  if (!capped) {
    return;
  }

  const since = new Date(now.getTime() - WINDOW_MS);
  const window: LedgerWindow = {
    brandMembershipId,
    campaignId,
    unit: rule.unit,
    amount: { gt: 0 },
    createdAt: { gte: since },
  };

  if (rule.maxScansPerPersonPerDay != null) {
    const scans = await tx.pointsTransaction.count({ where: window });
    if (scans >= rule.maxScansPerPersonPerDay) {
      throw new AccrualRefused("DAILY_SCAN_LIMIT");
    }
  }

  if (rule.maxPerPersonPerDay != null) {
    const earned = await tx.pointsTransaction.aggregate({ where: window, _sum: { amount: true } });
    // The award about to be written is included, so a ceiling is a ceiling
    // rather than a threshold you are allowed to cross once.
    if ((earned._sum.amount ?? 0) + rule.amount > rule.maxPerPersonPerDay) {
      throw new AccrualRefused("DAILY_LIMIT");
    }
  }

  if (rule.maxTotalAmount != null) {
    const issued = await tx.pointsTransaction.aggregate({
      where: { campaignId, unit: rule.unit, amount: { gt: 0 } },
      _sum: { amount: true },
    });
    if ((issued._sum.amount ?? 0) + rule.amount > rule.maxTotalAmount) {
      throw new AccrualRefused("CAMPAIGN_EXHAUSTED");
    }
  }
}

export async function applyAccrual(
  tx: AccrualTx,
  input: {
    brandId: string;
    campaignId: string;
    brandMembershipId: string;
    /** From the membership row the caller already read in this transaction. */
    optedOutAt?: Date | null;
    rule: AccrualRule;
    reward: AccrualReward;
    reason: PointsReason;
    /** Injectable so the ceiling window is testable without waiting a day. */
    now?: Date;
  },
): Promise<AccrualResult> {
  const { brandId, campaignId, brandMembershipId, rule, reward, reason } = input;
  const now = input.now ?? new Date();

  // A backstop, not the primary check. Both scan paths already refuse a
  // closed programme *before* they burn anything, which is what stops a
  // single-use code being destroyed on the way to a refusal. This is here so
  // that a caller added later — an SMS adapter, an import, a manual
  // adjustment — cannot accrue for a brand that has stopped paying just by
  // forgetting to ask. Reading it inside the transaction also closes the
  // window where a brand cancels between the outer check and the write.
  const subscription = await tx.subscription.findUnique({
    where: { brandId },
    select: { status: true, cancelledAt: true, honourRedemptionUntil: true },
  });
  if (!programmeState(subscription, now).canEarn) {
    throw new AccrualRefused("PROGRAMME_CLOSED");
  }

  await assertWithinCeilings(tx, {
    campaignId,
    brandMembershipId,
    rule,
    optedOutAt: input.optedOutAt ?? null,
    now,
  });

  await tx.pointsTransaction.create({
    data: { brandId, brandMembershipId, campaignId, amount: rule.amount, unit: rule.unit, reason },
  });

  // Re-read inside the transaction, so the number reported is the one this
  // award produced rather than a racing total.
  const totals = await tx.pointsTransaction.aggregate({
    where: { brandMembershipId, unit: rule.unit },
    _sum: { amount: true },
  });
  let balance = totals._sum.amount ?? 0;

  let coupon: AccrualResult["coupon"] = null;

  // A completed card: issue the campaign's coupon and deduct the card's
  // worth. At most one card per scan — a rule whose award exceeds a whole
  // card leaves the surplus on the balance, carrying toward the next one,
  // rather than issuing a handful of coupons from a single scan.
  if (rule.completesAt != null && reward && balance >= rule.completesAt) {
    const issuedCount = await tx.coupon.count({ where: { rewardId: reward.id } });
    const withinBudget = reward.maxCoupons == null || issuedCount < reward.maxCoupons;

    if (withinBudget) {
      const code = await createCouponWithRetry(tx, {
        brandId,
        campaignId,
        rewardId: reward.id,
        brandMembershipId,
        codePrefix: reward.codePrefix,
        expiresAt: reward.couponExpiryDate,
      });

      // Deducted as a ledger row, never as a reset of a counter — so
      // "balance = sum of transactions" survives completion, and the
      // shopper's history explains where the stamps went.
      await tx.pointsTransaction.create({
        data: {
          brandId,
          brandMembershipId,
          campaignId,
          amount: -rule.completesAt,
          unit: rule.unit,
          reason: "COUPON_UNLOCKED",
        },
      });

      balance -= rule.completesAt;
      coupon = { code, name: reward.couponName ?? "Reward" };
    }
    // Over budget: the stamps stay on the balance rather than vanishing.
    // The shopper earned them, and the brand can raise the cap.
  }

  return { newBalance: balance, coupon };
}

/**
 * What a basket is worth under a percent-of-spend rule, in the rule's unit.
 *
 * Rounds down. A shopper who is short a cent on a rounding boundary never
 * notices; a brand paying out a cent more than the rule says on every one
 * of a million transactions eventually does. Basis points rather than a
 * float percentage for the same reason the ledger is integer cents: 5% of
 * 8500 has to be exactly 425 every time, on every machine.
 */
export function percentOfSpend(amountCents: number, basisPoints: number): number {
  return Math.floor((amountCents * basisPoints) / 10_000);
}
