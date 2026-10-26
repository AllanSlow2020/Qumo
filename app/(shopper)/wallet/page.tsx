import type { LedgerUnit } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBrand } from "@/lib/brand/current";
import { getConsumerSession } from "@/lib/consumer/session";
import {
  getWallet,
  getWalletHistory,
  formatLedgerAmount,
  splitLedgerAmount,
  type BrandWallet,
  type WalletEntry,
} from "@/lib/consumer/wallet";
import { cardStanding, getCardTarget, type CardTarget } from "@/lib/consumer/progress";
import { getPendingSpend } from "@/lib/wallet/spend";
import { REDEMPTION_AVAILABLE } from "@/lib/wallet/availability";
import { getProgrammeState } from "@/lib/subscriptions/manage";
import { BrandHeader } from "../brand-header";
import { signOut } from "./actions";
import { SignOutButton } from "./sign-out-button";
import { abandonSpend } from "./spend/actions";
import { SpendForm } from "./spend/spend-form";

// The ledger's reason codes are internal enum values; a shopper should read
// what happened, not what the column says.
const REASON_LABELS: Record<string, string> = {
  COUPON_UNLOCKED: "Reward unlocked",
  PACK_SCAN_AWARDED: "Pack scan",
  PURCHASE_ACCRUAL: "Purchase",
  WALLET_SPENT: "Spent at the till",
};

/**
 * The two rows where the event outranks the place.
 *
 * Everywhere else the most useful heading is where it happened - a shopper
 * checking a statement is matching it against their own week, and "Sea
 * Point" is a thing they either did or did not do. But a completed card and
 * a spend are events in their own right, and heading both with the store
 * name would put two rows reading "Sea Point" next to each other for the
 * same scan, one of them negative. The store still appears, one line down.
 */
const EVENT_TITLES: Record<string, string> = {
  COUPON_UNLOCKED: "Reward unlocked",
  WALLET_SPENT: "Spent at the till",
};

/**
 * What one line of the history says, in the order a shopper reads it.
 *
 * The fallbacks are a ladder from most specific to least, and each rung is
 * the truth about a real path rather than a guess: a till slip knows its
 * store, a pack code knows only its promotion, and a row from neither - an
 * older one, or an adjustment - has nothing but its reason. Nothing is
 * invented to fill a gap; the line just gets shorter.
 */
function describeEntry(entry: WalletEntry): { title: string; detail: string } {
  const title =
    EVENT_TITLES[entry.reason] ??
    entry.storeName ??
    entry.campaignName ??
    REASON_LABELS[entry.reason] ??
    entry.reason;

  const detail = [
    entry.createdAt.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }),
    // Only when the title is not already the store.
    entry.storeName && title !== entry.storeName ? entry.storeName : null,
    // The answer to "why that much", and only on the row that earned it -
    // on a card completion the basket explains the stamp, not the deduction.
    entry.amount > 0 && entry.amountCents != null
      ? `${formatLedgerAmount(entry.amountCents, "CENTS")} purchase`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { title, detail };
}

const UNIT_LABELS: Record<string, string> = {
  CENTS: "Wallet",
  STAMPS: "Stamp card",
  POINTS: "Points",
};

/** Cents to the plain decimal an amount input expects. */
function centsToRands(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * A figure, with its unit set as a word rather than as more monospace.
 *
 * See splitLedgerAmount: rands come back with no suffix and render exactly
 * as they always did, so this is a no-op for the balance a shopper checks
 * most often and a correction for the two that read as typesetting faults.
 */
function Figure({
  amount,
  unit,
  className,
  sign,
}: {
  amount: number;
  unit: LedgerUnit;
  className: string;
  sign?: boolean;
}) {
  const { figure, suffix } = splitLedgerAmount(amount, unit);
  return (
    <p className={className}>
      {sign && amount > 0 ? "+" : ""}
      {figure}
      {/* A real space, not only the CSS margin: the margin is invisible to
          anything reading the text rather than the pixels, so a screen
          reader and a copy-paste both got "+1stamp". */}
      {suffix && <span className="sc-figure-unit"> {suffix}</span>}
    </p>
  );
}

/**
 * The stamp card, drawn as a card.
 *
 * The thing a shopper is actually collecting is a row of gaps, and the only
 * question they open this screen to answer is how many are left. A count in
 * a monospace face answers it in principle and in no other way: "5 stamps"
 * is a fact about a ledger, and nobody has ever walked back into a shop
 * because of a fact about a ledger.
 *
 * The marks are the one place the brand's colour is allowed on this surface
 * besides a button - see the note at the top of shopper.css, which reserved
 * the accent for exactly this before anything used it. Money stays ink;
 * progress is the brand's.
 */
function StampCard({ target, have }: { target: CardTarget; have: number }) {
  const { filled, total, remaining, line } = cardStanding(target, have);
  // Ten across is as many as fits a 360px phone legibly. Beyond that the
  // row wraps rather than shrinking the marks to confetti.
  const columns = Math.min(total, 10);

  return (
    <section className="sc-card">
      <div className="sc-card-head">
        <h2 className="sc-h2">{target.campaignName}</h2>
        <span className="sc-count">
          {filled}/{total}
        </span>
      </div>

      {/* One element per mark, because that is what it is. The row carries
          the label and the marks are decoration under it, so a screen
          reader is told "5 of 10" once rather than ten times. */}
      <div
        className="sc-stamps"
        role="img"
        aria-label={`${filled} of ${total} collected`}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, maxWidth: columns * 38 + (columns - 1) * 8 }}
      >
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`sc-stamp${i < filled ? " sc-stamp-on" : ""}`} aria-hidden="true" />
        ))}
      </div>

      <p className="sc-body">{line}</p>
    </section>
  );
}

type PendingSpendView = { id: string; code: string; amountCents: number; expiresAt: Date };

/**
 * A live spend request. The code is the largest thing on the screen because
 * a cashier reads it across a counter, and the amount sits beside it so both
 * people can agree before anything is debited.
 */
function PendingSpendCard({ spend }: { spend: PendingSpendView }) {
  return (
    <div className="sc-tile">
      <p className="sc-label">Show this to the cashier</p>
      <p className="sc-code">{spend.code}</p>
      <p className="sc-body">
        for {formatLedgerAmount(spend.amountCents, "CENTS")} · expires{" "}
        {spend.expiresAt.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
      </p>
      <p className="sc-label">Nothing comes off your balance until the cashier confirms it.</p>
      <form action={abandonSpend}>
        <input type="hidden" name="spendId" value={spend.id} />
        <button type="submit" className="sc-btn sc-btn-quiet">
          Cancel
        </button>
      </form>
    </div>
  );
}

/**
 * The balances, with no brand name on them.
 *
 * It used to carry a heading with the brand's name, because the screen was a
 * list of brands and each card had to say which one it was. There is exactly
 * one brand on this page now and its name is already at the top of it -
 * repeating it here would read as though there might be another.
 */
function Balances({
  wallet,
  balances,
  pendingSpend,
  canRedeem,
}: {
  wallet: BrandWallet;
  /**
   * What to show here, which is not always everything the shopper holds. A
   * unit that has a stamp card drawn for it below is deliberately absent:
   * the same five stamps printed twice, once as a figure and once as a row
   * of marks, reads as two different things to anybody who does not already
   * know it is one.
   */
  balances: BrandWallet["balances"];
  pendingSpend: PendingSpendView | null;
  canRedeem: boolean;
}) {
  const cents = wallet.balances.find((b) => b.unit === "CENTS")?.amount ?? 0;
  // Cash first, because it is the balance a shopper can spend today; the
  // ordering is otherwise whatever the ledger returned.
  const ordered = [...balances].sort((a, b) => (a.unit === "CENTS" ? -1 : b.unit === "CENTS" ? 1 : 0));
  const [hero, ...rest] = ordered;

  return (
    <section className="sc-card">
      {!hero ? (
        <>
          <h2 className="sc-h2">Nothing earned yet</h2>
          <p className="sc-body">Scan a code on a till slip, a pack or a tag and your balance starts here.</p>
        </>
      ) : (
        <>
          {/* One hero figure, then the rest at a smaller size. Giving three
              balances equal 44px weight made the card as tall as the phone
              and left a shopper scrolling to find the number they actually
              came to check. Spendable cash leads where it exists, since it
              is the only balance they can do something with today. */}
          <div className="sc-balance">
            <Figure amount={hero.amount} unit={hero.unit} className="sc-figure" />
            <p className="sc-label">{UNIT_LABELS[hero.unit] ?? hero.unit}</p>
          </div>
          {rest.length > 0 && (
            <div className="sc-balances">
              {rest.map((balance) => (
                <div className="sc-balance" key={balance.unit}>
                  <Figure amount={balance.amount} unit={balance.unit} className="sc-figure-sm" />
                  <p className="sc-label">{UNIT_LABELS[balance.unit] ?? balance.unit}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Only a cash balance is spendable at a till. Stamps and points are
          earned toward a reward, not handed over at a counter.

          REDEMPTION_AVAILABLE gates the whole thing: there is no cashier
          screen, so offering a shopper a spend code would be offering them
          a code nobody can accept. See lib/wallet/availability.ts. */}
      {REDEMPTION_AVAILABLE &&
        cents > 0 &&
        canRedeem &&
        (pendingSpend ? (
          <PendingSpendCard spend={pendingSpend} />
        ) : (
          <SpendForm brandId={wallet.brandId} maxRands={centsToRands(cents)} />
        ))}
    </section>
  );
}

export default async function WalletPage() {
  const personId = await getConsumerSession();
  if (!personId) {
    redirect("/wallet/login");
  }

  // One brand, decided by the host and nothing else. This is the inversion:
  // the page used to ask "what does this shopper have everywhere" and now
  // asks "what does this shopper have here", which is the only question a
  // brand's own site has any business answering.
  const brand = await requireBrand();

  const [wallets, history, programme, cardTarget] = await Promise.all([
    getWallet(personId, brand.id),
    getWalletHistory(personId, 50, brand.id),
    getProgrammeState(brand.id),
    getCardTarget(brand.id),
  ]);
  // A shopper who signed in but has never scanned here has no membership at
  // this brand at all. An empty wallet stands in for one, so the page reads
  // as "nothing yet" rather than erroring on a row that was never created.
  const wallet: BrandWallet = wallets[0] ?? {
    brandId: brand.id,
    brandName: brand.name,
    brandSlug: brand.slug,
    joinedAt: new Date(),
    balances: [],
  };

  const pendingSpend =
    wallets.length > 0 && programme.canRedeem ? await getPendingSpend(personId, brand.id) : null;

  // The card is drawn only while the programme can still earn: a row of
  // empty marks on a closed programme invites somebody to collect something
  // that can never complete.
  const showCard = cardTarget !== null && programme.canEarn;
  const cardHave = cardTarget ? (wallet.balances.find((b) => b.unit === cardTarget.unit)?.amount ?? 0) : 0;
  const otherBalances = showCard ? wallet.balances.filter((b) => b.unit !== cardTarget.unit) : wallet.balances;

  return (
    <>
      <BrandHeader caption="Your rewards" />

      {/* Said at the top of the balance they are looking at, not buried in a
          footer. A shopper who reads "R42.00" and nothing else will find out
          the hard way, at a till, with a queue behind them. */}
      {!programme.canEarn && (
        <section className="sc-card">
          <h2 className="sc-h2">{brand.name} has ended this programme</h2>
          {programme.canRedeem && programme.honourUntil ? (
            <p className="sc-body">
              You can still spend what you&apos;ve earned until{" "}
              <strong style={{ color: "var(--sc-ink)" }}>
                {programme.honourUntil.toLocaleDateString("en-ZA", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </strong>
              . After that this balance closes. You won&apos;t earn anything new in the meantime.
            </p>
          ) : (
            <p className="sc-body">
              This balance can no longer be spent. Nothing has been deleted, and if {brand.name} starts again it will
              be here exactly as you left it.
            </p>
          )}
        </section>
      )}

      {/* Skipped entirely when the only thing this shopper holds is the
          card drawn below. The empty state ("Nothing earned yet") would
          otherwise sit directly above a half-full stamp card and call it
          nothing. */}
      {(otherBalances.length > 0 || !showCard) && (
        <Balances
          wallet={wallet}
          balances={otherBalances}
          pendingSpend={pendingSpend}
          canRedeem={programme.canRedeem}
        />
      )}

      {/* Under the balances rather than above them. Spendable cash is what
          somebody standing at a till needs first; the card is what brings
          them back next week. Drawn only while the programme can still earn
          - a row of empty marks on a closed programme is an invitation to
          collect something that will never complete. */}
      {showCard && <StampCard target={cardTarget} have={cardHave} />}

      {history.length > 0 && (
        <section className="sc-card">
          <h2 className="sc-h2">Activity</h2>
          <div className="sc-rows">
            {history.map((entry) => {
              const { title, detail } = describeEntry(entry);
              return (
              <div className="sc-row" key={entry.id}>
                <div className="sc-row-main">
                  <span>{title}</span>
                  <span className="sc-label">{detail}</span>
                </div>
                <Figure
                  amount={entry.amount}
                  unit={entry.unit}
                  sign
                  className={`sc-row-amt${entry.amount > 0 ? " sc-pos" : ""}`}
                />
              </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="sc-card">
        <h2 className="sc-h2">Your details</h2>
        <p className="sc-body">
          Signed-in devices, leaving {brand.name}&apos;s rewards, and a copy of everything we hold about you.
        </p>
        <Link href="/wallet/me" className="sc-btn sc-btn-ghost">
          Manage
        </Link>
      </section>

      <SignOutButton action={signOut}>Sign out</SignOutButton>
    </>
  );
}
