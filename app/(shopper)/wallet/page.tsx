import Link from "next/link";
import { redirect } from "next/navigation";
import { getConsumerSession } from "@/lib/consumer/session";
import { getWallet, getWalletHistory, formatLedgerAmount, type BrandWallet } from "@/lib/consumer/wallet";
import { getPendingSpend } from "@/lib/wallet/spend";
import { Wordmark } from "../wordmark";
import { signOut } from "./actions";
import { abandonSpend } from "./spend/actions";
import { SpendForm } from "./spend/spend-form";

// The ledger's reason codes are internal enum values; a shopper should read
// what happened, not what the column says.
const REASON_LABELS: Record<string, string> = {
  CHECK_IN_COMPLETED: "Check-in",
  COUPON_UNLOCKED: "Reward unlocked",
  PACK_SCAN_AWARDED: "Pack scan",
  PURCHASE_ACCRUAL: "Purchase",
  WALLET_SPENT: "Spent at the till",
};

const UNIT_LABELS: Record<string, string> = {
  CENTS: "Wallet",
  STAMPS: "Stamp card",
  POINTS: "Points",
};

/** Cents to the plain decimal an amount input expects. */
function centsToRands(cents: number): string {
  return (cents / 100).toFixed(2);
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

function BrandCard({ wallet, pendingSpend }: { wallet: BrandWallet; pendingSpend: PendingSpendView | null }) {
  const cents = wallet.balances.find((b) => b.unit === "CENTS")?.amount ?? 0;
  // Cash first, because it is the balance a shopper can spend today; the
  // ordering is otherwise whatever the ledger returned.
  const ordered = [...wallet.balances].sort((a, b) => (a.unit === "CENTS" ? -1 : b.unit === "CENTS" ? 1 : 0));
  const [hero, ...rest] = ordered;

  return (
    <section className="sc-card">
      <h2 className="sc-h2">{wallet.brandName}</h2>

      {!hero ? (
        <p className="sc-body">Nothing earned here yet.</p>
      ) : (
        <>
          {/* One hero figure per brand, then the rest at a smaller size.
              Giving three balances equal 44px weight made the card as tall
              as the phone and left a shopper scrolling to find the number
              they actually came to check. Spendable cash leads where it
              exists, since it is the only balance they can do something
              with today. */}
          <div className="sc-balance">
            <p className="sc-figure">{formatLedgerAmount(hero.amount, hero.unit)}</p>
            <p className="sc-label">{UNIT_LABELS[hero.unit] ?? hero.unit}</p>
          </div>
          {rest.length > 0 && (
            <div className="sc-balances">
              {rest.map((balance) => (
                <div className="sc-balance" key={balance.unit}>
                  <p className="sc-figure-sm">{formatLedgerAmount(balance.amount, balance.unit)}</p>
                  <p className="sc-label">{UNIT_LABELS[balance.unit] ?? balance.unit}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Only a cash balance is spendable at a till. Stamps and points are
          earned toward a reward, not handed over at a counter. */}
      {cents > 0 &&
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

  const [wallets, history] = await Promise.all([getWallet(personId), getWalletHistory(personId)]);
  const brandNames = new Map(wallets.map((w) => [w.brandId, w.brandName]));

  // One live request per brand at most, so this is a lookup rather than a
  // list. Fetched per brand because a shopper with a balance at several
  // could have one open at any of them.
  const pendingSpends = new Map(
    (
      await Promise.all(wallets.map(async (w) => [w.brandId, await getPendingSpend(personId, w.brandId)] as const))
    ).filter(([, spend]) => spend !== null),
  );

  return (
    <>
      <Wordmark caption="Your rewards, in one place" />

      {wallets.length === 0 ? (
        <section className="sc-card">
          <h2 className="sc-h2">Nothing here yet</h2>
          <p className="sc-body">
            You&apos;re signed in, but you haven&apos;t scanned anything yet. Scan a code on a pack or a till slip and
            your balance starts here.
          </p>
        </section>
      ) : (
        wallets.map((wallet) => (
          <BrandCard key={wallet.brandId} wallet={wallet} pendingSpend={pendingSpends.get(wallet.brandId) ?? null} />
        ))
      )}

      {history.length > 0 && (
        <section className="sc-card">
          <h2 className="sc-h2">Activity</h2>
          <div className="sc-rows">
            {history.map((entry) => (
              <div className="sc-row" key={entry.id}>
                <div className="sc-row-main">
                  <span>{REASON_LABELS[entry.reason] ?? entry.reason}</span>
                  <span className="sc-label">
                    {brandNames.get(entry.brandId) ?? "—"} ·{" "}
                    {entry.createdAt.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                <span className={`sc-row-amt${entry.amount > 0 ? " sc-pos" : ""}`}>
                  {entry.amount > 0 ? "+" : ""}
                  {formatLedgerAmount(entry.amount, entry.unit)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="sc-card">
        <h2 className="sc-h2">Your details</h2>
        <p className="sc-body">
          Signed-in devices, leaving a brand&apos;s rewards, and a copy of everything we hold about you.
        </p>
        <Link href="/wallet/me" className="sc-btn sc-btn-ghost">
          Manage
        </Link>
      </section>

      <form action={signOut}>
        <button type="submit" className="sc-btn sc-btn-ghost">
          Sign out
        </button>
      </form>
    </>
  );
}
