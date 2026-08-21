import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBrand } from "@/lib/brand/current";
import { getConsumerSession } from "@/lib/consumer/session";
import { getWallet, getWalletHistory, formatLedgerAmount, type BrandWallet } from "@/lib/consumer/wallet";
import { getPendingSpend } from "@/lib/wallet/spend";
import { BrandHeader } from "../brand-header";
import { signOut } from "./actions";
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

/**
 * The balances, with no brand name on them.
 *
 * It used to carry a heading with the brand's name, because the screen was a
 * list of brands and each card had to say which one it was. There is exactly
 * one brand on this page now and its name is already at the top of it —
 * repeating it here would read as though there might be another.
 */
function Balances({ wallet, pendingSpend }: { wallet: BrandWallet; pendingSpend: PendingSpendView | null }) {
  const cents = wallet.balances.find((b) => b.unit === "CENTS")?.amount ?? 0;
  // Cash first, because it is the balance a shopper can spend today; the
  // ordering is otherwise whatever the ledger returned.
  const ordered = [...wallet.balances].sort((a, b) => (a.unit === "CENTS" ? -1 : b.unit === "CENTS" ? 1 : 0));
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

  // One brand, decided by the host and nothing else. This is the inversion:
  // the page used to ask "what does this shopper have everywhere" and now
  // asks "what does this shopper have here", which is the only question a
  // brand's own site has any business answering.
  const brand = await requireBrand();

  const [wallets, history] = await Promise.all([
    getWallet(personId, brand.id),
    getWalletHistory(personId, 50, brand.id),
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

  const pendingSpend = wallets.length > 0 ? await getPendingSpend(personId, brand.id) : null;

  return (
    <>
      <BrandHeader caption="Your rewards" />

      <Balances wallet={wallet} pendingSpend={pendingSpend} />

      {history.length > 0 && (
        <section className="sc-card">
          <h2 className="sc-h2">Activity</h2>
          <div className="sc-rows">
            {history.map((entry) => (
              <div className="sc-row" key={entry.id}>
                <div className="sc-row-main">
                  <span>{REASON_LABELS[entry.reason] ?? entry.reason}</span>
                  <span className="sc-label">
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
          Signed-in devices, leaving {brand.name}&apos;s rewards, and a copy of everything we hold about you.
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
