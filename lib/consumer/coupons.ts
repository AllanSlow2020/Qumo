import type { CouponStatus } from "@prisma/client";
import { forPerson } from "./scope";

/**
 * The rewards a shopper is holding, and the ones already handed over.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * A completed card issued a code, showed it once on the page that said the
 * card was complete, and then had nowhere to put it. Close that page and
 * the code was gone: the wallet listed balances and history and no
 * coupons at all. That made the counter's side of redemption useless,
 * because the thing it checks against was unreachable. A code a shopper
 * cannot find is a reward a brand never has to honour, which is precisely
 * the shape of promise the Consumer Protection Act takes an interest in.
 */

export type ShopperCoupon = {
  id: string;
  code: string;
  /** What the shopper was promised, in their words rather than the brand's. */
  rewardName: string;
  terms: string | null;
  /** Where it can be used, where a brand has said. */
  retailers: string[];
  status: CouponStatus;
  issuedAt: Date;
  expiresAt: Date | null;
  settledAt: Date | null;
};

export type ShopperCoupons = {
  /** Still worth showing at a counter. */
  open: ShopperCoupon[];
  /** Taken, cancelled or run out. Kept visible, because "where did my free coffee go" is a question. */
  closed: ShopperCoupon[];
};

/**
 * `now` decides which side of the line an expiry falls on, and is
 * injectable for the same reason it is in the redemption engine: a test
 * should not have to wait a day.
 *
 * An expiry in the past puts a coupon in `closed` even while the row still
 * says ISSUED. Nothing sweeps for expiries, so the row is only corrected
 * when somebody tries to redeem it, and until then a shopper would
 * otherwise be shown a code that the counter will refuse.
 */
export async function listShopperCoupons(
  personId: string,
  brandId: string,
  now: Date = new Date(),
  closedLimit = 5,
): Promise<ShopperCoupons> {
  const rows = await forPerson(personId).coupon.findMany({
    where: { brandId },
    orderBy: { issuedAt: "desc" },
    include: { reward: { select: { rewardName: true, couponDescription: true, retailers: true } } },
  });

  const open: ShopperCoupon[] = [];
  const closed: ShopperCoupon[] = [];

  for (const row of rows) {
    const coupon: ShopperCoupon = {
      id: row.id,
      code: row.code,
      rewardName: row.reward.rewardName,
      terms: row.reward.couponDescription,
      retailers: row.reward.retailers,
      status: row.status,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      settledAt: row.statusChangedAt,
    };

    const stillGood = row.status === "ISSUED" && (!row.expiresAt || row.expiresAt > now);
    if (stillGood) open.push(coupon);
    else closed.push(coupon);
  }

  return { open, closed: closed.slice(0, closedLimit) };
}
