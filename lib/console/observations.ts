import { forBrand } from "@/lib/db/tenant";
import type { LedgerUnit } from "@prisma/client";

/**
 * What is worth looking at, for a brand whose programme is already running.
 *
 * The getting-started guide answers "what do I do first" and then disappears
 * at the first scan, which left the landing page with five metrics and two
 * warnings and nothing at all to say about what to do next. An operator with
 * a live programme is asking "is this working" and "what should I change",
 * and a number on its own answers neither.
 *
 * Everything here is derived from the brand's own rows. That is the whole
 * point and the whole constraint: generic advice about loyalty programmes is
 * worth nothing and ages badly, while "nobody has finished a card and you
 * have issued 286 stamps" is worth something and is only knowable from here.
 *
 * ── What is deliberately absent ──────────────────────────────────────────
 *
 * Two obvious candidates are not here because they would be dishonest.
 *
 * "Shoppers are holding R420 and none of it has been spent" reads as a
 * brand problem and is ours: redemption is switched off on purpose, because
 * the cashier half of the flow was never built (lib/wallet/availability.ts).
 * Telling a brand to chase redemptions they cannot offer is blaming them for
 * our own unfinished feature.
 *
 * Repeat rate belongs to the performance page, which already breaks members
 * into once, twice-to-three and four-or-more. Repeating it here would make
 * two screens the source of one number.
 */

/** Below this share of its budget, a promotion is not worth mentioning. */
const BUDGET_NEAR = 0.8;
/** Same, for a printed run of pack codes. */
const BATCH_NEAR = 0.8;
/**
 * How much of a card's worth of stamps has to be out before "nobody has
 * completed one" means anything. A card that has issued nine stamps against
 * a threshold of ten has not failed, it has barely started.
 */
const CARD_EVIDENCE = 3;
/** A live promotion silent for this long, while others are not. */
const QUIET_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ObservationFacts = {
  cards: { campaignId: string; name: string; completesAt: number; unit: LedgerUnit; issued: number; coupons: number }[];
  budgets: { campaignId: string; name: string; unit: LedgerUnit; issued: number; cap: number }[];
  batches: { batchId: string; label: string; total: number; scanned: number }[];
  /** Live promotions that award something, and when each last did. */
  live: { campaignId: string; name: string; lastAwardAt: Date | null }[];
  now: Date;
};

export type Observation = {
  id: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  /** warn is "this will stop working"; note is "this is worth a thought". */
  tone: "warn" | "note";
};

function amount(value: number, unit: LedgerUnit): string {
  if (unit === "CENTS") return `R${(value / 100).toFixed(2)}`;
  const word = unit === "STAMPS" ? "stamp" : "point";
  return `${value.toLocaleString("en-ZA")} ${word}${value === 1 ? "" : "s"}`;
}

/**
 * Pure, so the wording and the thresholds can be tested without a database.
 * The wording is the part that can be wrong in a way a brand acts on.
 *
 * Ordered by what stops working soonest. A budget and a batch both end with
 * the programme quietly ceasing to award, which is worse than a promotion
 * that is merely doing badly, because nothing on the shopper's side says why.
 */
export function observations(f: ObservationFacts): Observation[] {
  const out: Observation[] = [];

  for (const b of f.budgets) {
    const share = b.issued / b.cap;
    if (share < BUDGET_NEAR) continue;
    out.push({
      id: `budget-${b.campaignId}`,
      tone: "warn",
      title: `${b.name} has issued ${Math.round(share * 100)}% of its budget`,
      detail: `${amount(b.issued, b.unit)} of ${amount(b.cap, b.unit)}. At 100% it stops awarding, and a shopper scanning a code after that is told the promotion is not running - not that it ran out. Raise the ceiling or let it end on purpose.`,
      href: "/promotions",
      cta: "Open promotions",
    });
  }

  for (const batch of f.batches) {
    const share = batch.scanned / batch.total;
    if (batch.total === 0 || share < BATCH_NEAR) continue;
    out.push({
      id: `batch-${batch.batchId}`,
      tone: "warn",
      title: `${batch.label} is ${Math.round(share * 100)}% scanned`,
      detail: `${batch.scanned.toLocaleString("en-ZA")} of ${batch.total.toLocaleString("en-ZA")} codes used, and each one works once. Printing takes a lead time that running out does not wait for.`,
      href: "/codes",
      cta: "Print another run",
    });
  }

  /*
   * A promotion that has gone quiet, judged against the others rather than
   * against the calendar.
   *
   * The comparison is what makes it worth saying. A fortnight of silence
   * across the whole programme is a quiet fortnight and the brand already
   * knows; one promotion silent while the others are earning is a code
   * somebody never put out, a batch that never shipped, or a till that
   * stopped sending.
   */
  const cutoff = new Date(f.now.getTime() - QUIET_DAYS * DAY_MS);
  const anyRecent = f.live.some((c) => c.lastAwardAt !== null && c.lastAwardAt >= cutoff);
  if (anyRecent) {
    for (const c of f.live) {
      if (c.lastAwardAt !== null && c.lastAwardAt >= cutoff) continue;
      out.push({
        id: `quiet-${c.campaignId}`,
        tone: "note",
        title: `${c.name} has awarded nothing in ${QUIET_DAYS} days`,
        detail: c.lastAwardAt
          ? "It is switched on and your other promotions are earning, so this is usually a code that never made it out - a batch still in a box, or a till that stopped sending slips."
          : "It has never awarded anything since it was switched on. Check the codes for it actually reached somewhere a customer can scan them.",
        href: "/promotions",
        cta: "Open promotions",
      });
    }
  }

  for (const card of f.cards) {
    // Not "nobody has completed one" on its own - that is true of every card
    // on its first day. It needs enough stamps out that somebody should have.
    if (card.coupons > 0 || card.issued < card.completesAt * CARD_EVIDENCE) continue;
    out.push({
      id: `card-${card.campaignId}`,
      tone: "note",
      title: `Nobody has finished a ${card.name} yet`,
      detail: `${amount(card.issued, card.unit)} issued and a card takes ${card.completesAt}, so the stamps are spread thinner than one card's worth per person. That usually means the card is longer than people come, rather than that they stopped collecting.`,
      href: "/promotions",
      cta: "Change the card",
    });
  }

  return out;
}

export async function getObservationFacts(brandId: string, now: Date = new Date()): Promise<ObservationFacts> {
  const scoped = forBrand(brandId);

  const [campaigns, issuedRows, couponRows, batchRows, scannedRows, lastRows] = await Promise.all([
    scoped.campaign.findMany({
      where: { status: "ACTIVE", earnRule: { isNot: null } },
      select: {
        id: true,
        name: true,
        earnRule: { select: { unit: true, completesAt: true, maxTotalAmount: true } },
      },
    }),
    // Credits only. A redemption is not an issue, and netting them would
    // make a budget look further from its ceiling than it is.
    scoped.pointsTransaction.groupBy({ by: ["campaignId"], where: { amount: { gt: 0 } }, _sum: { amount: true } }),
    scoped.coupon.groupBy({ by: ["campaignId"], _count: { _all: true } }),
    scoped.packBatch.findMany({ select: { id: true, label: true, quantity: true, campaignId: true } }),
    scoped.packCode.groupBy({ by: ["batchId"], where: { status: "SCANNED" }, _count: { _all: true } }),
    scoped.pointsTransaction.groupBy({ by: ["campaignId"], where: { amount: { gt: 0 } }, _max: { createdAt: true } }),
  ]);

  // campaignId is nullable on PointsTransaction - it is SetNull, so a
  // deleted promotion leaves its ledger rows behind with no campaign. Those
  // rows belong to no promotion on this page.
  const issuedBy = new Map(issuedRows.filter((r) => r.campaignId).map((r) => [r.campaignId!, r._sum.amount ?? 0]));
  const couponsBy = new Map(couponRows.map((r) => [r.campaignId, r._count._all]));
  const lastBy = new Map(lastRows.filter((r) => r.campaignId).map((r) => [r.campaignId!, r._max.createdAt]));
  const scannedBy = new Map(scannedRows.map((r) => [r.batchId, r._count._all]));

  const cards: ObservationFacts["cards"] = [];
  const budgets: ObservationFacts["budgets"] = [];
  const live: ObservationFacts["live"] = [];

  for (const c of campaigns) {
    const rule = c.earnRule;
    if (!rule) continue;
    const issued = issuedBy.get(c.id) ?? 0;
    live.push({ campaignId: c.id, name: c.name, lastAwardAt: lastBy.get(c.id) ?? null });
    if (rule.completesAt) {
      cards.push({
        campaignId: c.id,
        name: c.name,
        completesAt: rule.completesAt,
        unit: rule.unit,
        issued,
        coupons: couponsBy.get(c.id) ?? 0,
      });
    }
    if (rule.maxTotalAmount) {
      budgets.push({ campaignId: c.id, name: c.name, unit: rule.unit, issued, cap: rule.maxTotalAmount });
    }
  }

  const batches = batchRows.map((b) => ({
    batchId: b.id,
    label: b.label,
    total: b.quantity,
    scanned: scannedBy.get(b.id) ?? 0,
  }));

  return { cards, budgets, batches, live, now };
}
