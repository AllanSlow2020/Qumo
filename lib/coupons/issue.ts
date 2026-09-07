import { Prisma } from "@prisma/client";
import { generateCouponCode } from "./code";

/**
 * Issuing a coupon inside an existing transaction.
 *
 * Shared because there is now more than one way to earn one: completing a
 * check-in past a points threshold (lib/conversation/engine.ts) and
 * completing a stamp card by scanning packs (lib/packs/scan.ts). Both need
 * the same collision retry, and a second copy of it is how the two drift.
 *
 * The caller supplies the transaction, deliberately. A coupon is only ever
 * issued as part of a larger decision - deduct the threshold, check the
 * budget, write the ledger - and issuing one outside that transaction
 * would let a coupon exist with no matching deduction behind it.
 */

/**
 * Structurally typed rather than importing Prisma's transaction client:
 * callers reach this with clients extended different ways (brand-scoped in
 * the engine, unscoped-by-code in a pack scan), and naming a concrete
 * client type here would force one of them into a cast.
 */
type CouponCreator = {
  coupon: {
    create: (args: {
      data: {
        brandId: string;
        campaignId: string;
        rewardId: string;
        brandMembershipId: string;
        code: string;
        expiresAt?: Date | null;
      };
    }) => Promise<unknown>;
  };
};

export type IssueCouponInput = {
  brandId: string;
  campaignId: string;
  rewardId: string;
  brandMembershipId: string;
  /** e.g. "FC" - prepended to the generated code when a reward sets one. */
  codePrefix?: string | null;
  expiresAt?: Date | null;
};

/**
 * Creates the coupon and returns its code. Retries on the unique-constraint
 * collision that generateCouponCode()'s keyspace makes unlikely but not
 * impossible - the constraint, not the odds, is what decides.
 */
export async function createCouponWithRetry(tx: CouponCreator, input: IssueCouponInput): Promise<string> {
  const { codePrefix, ...couponData } = input;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = generateCouponCode(codePrefix ?? undefined);
    try {
      await tx.coupon.create({ data: { ...couponData, code } });
      return code;
    } catch (err) {
      const isCollision = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isCollision || attempt === 2) {
        throw err;
      }
    }
  }
  throw new Error("unreachable");
}
