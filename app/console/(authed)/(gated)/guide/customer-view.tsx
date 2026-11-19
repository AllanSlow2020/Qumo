import { formatLedgerAmount, splitLedgerAmount } from "@/lib/consumer/wallet";
import { cardStanding } from "@/lib/consumer/progress";
import { CONSENT_CHECKBOX_LABEL } from "@/lib/consumer/consent";
import { findFont, fontStack } from "@/lib/brand/fonts";
import { stampsAfter } from "@/lib/guide/card";
import { percentOfSpend } from "@/lib/ledger/percent";
import { TOUR_BRANDS } from "@/lib/guide/customer";
import { PRODUCT_NAME } from "@/lib/product";
import { PhoneTour, type TourBrand } from "./phone-tour";

/**
 * What the customer sees, as three brands the reader can try.
 *
 * A server component for one reason: the numbers and sentences on the phone
 * are made by the same functions the shopper's own screens call
 * (formatLedgerAmount, cardStanding, percentOfSpend), and those reach the
 * database module, so they cannot be imported into the browser. They run
 * here, once, and the interactive part receives plain finished strings. The
 * page cannot say "6 more stamps and a free coffee is yours" in a way the
 * real wallet would not.
 */

const AMBER_OAK_BASKET_CENTS = 12_000;
const AMBER_OAK_BASIS_POINTS = 500;

function build(spec: (typeof TOUR_BRANDS)[number]): TourBrand {
  const unit = spec.kind === "card" ? ("STAMPS" as const) : ("CENTS" as const);
  // The balance shown is the shopper's own, after this scan.
  const worthAmount = spec.id === "amber-oak" ? percentOfSpend(AMBER_OAK_BASKET_CENTS, AMBER_OAK_BASIS_POINTS) : spec.worth;
  const after = spec.before + worthAmount;

  let balanceAmount = after;
  let card: TourBrand["card"] = null;
  let reward: TourBrand["reward"] = null;

  if (spec.kind === "card" && spec.completesAt) {
    // The ledger's rule: the card's worth comes off when it completes, and
    // what is left is the new card.
    const { completed, onCard } = stampsAfter(after, spec.completesAt);
    balanceAmount = onCard;
    const standing = cardStanding(
      { campaignId: spec.id, campaignName: spec.campaignName, unit, completesAt: spec.completesAt, rewardName: spec.rewardName ?? null },
      onCard,
    );
    card = { filled: standing.filled, total: standing.total, line: standing.line };
    if (completed > 0 && spec.rewardName && spec.rewardCode) reward = { name: spec.rewardName, code: spec.rewardCode };
  }

  const font = findFont(spec.fontId);
  return {
    id: spec.id,
    name: spec.name,
    tagline: spec.tagline,
    accent: spec.accent,
    accentInk: spec.accentInk,
    font: font ? fontStack(font) : "inherit",
    fontLabel: font?.label ?? "",
    kind: spec.kind,
    campaignName: spec.campaignName,
    worth: splitLedgerAmount(worthAmount, unit),
    worthText: formatLedgerAmount(worthAmount, unit),
    balance: splitLedgerAmount(balanceAmount, unit),
    balanceText: formatLedgerAmount(balanceAmount, unit),
    card,
    reward,
  };
}

export function CustomerView() {
  return <PhoneTour brands={TOUR_BRANDS.map(build)} consent={CONSENT_CHECKBOX_LABEL} productName={PRODUCT_NAME} />;
}
