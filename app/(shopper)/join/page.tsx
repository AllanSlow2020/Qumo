import Link from "next/link";
import type { Metadata } from "next";
import { requireBrand } from "@/lib/brand/current";
import { brandTitle } from "@/lib/brand/theme";
import { PRODUCT_NAME } from "@/lib/product";
import { getMembershipStatus, listOffers } from "@/lib/consumer/join";
import { getProgrammeState } from "@/lib/subscriptions/manage";
import { HONOUR_WINDOW_DAYS } from "@/lib/subscriptions/state";
import { getConsumerSession } from "@/lib/consumer/session";
import { BrandHeader } from "../brand-header";
import { JoinButton } from "./join-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: brandTitle(await requireBrand(), "Join") };
}

/**
 * Where a poster, a table-talker or a plain NFC tag lands.
 *
 * The one shopper route that never awards anything. A poster is a static
 * code anyone can scan without buying anything, so it explains the
 * promotion and takes an opt-in, and earning starts at the next till slip.
 * See lib/consumer/join.ts for why that line is not negotiable.
 */
export default async function JoinPage() {
  const brand = await requireBrand();
  const personId = await getConsumerSession();

  const [offers, status, programme] = await Promise.all([
    listOffers(brand.id),
    personId ? getMembershipStatus(personId, brand.id) : Promise.resolve({ joined: false, optedOut: false }),
    getProgrammeState(brand.id),
  ]);

  return (
    <>
      <BrandHeader caption={brand.tagline ?? "Rewards"} />

      {!programme.canEarn && (
        <section className="sc-card">
          <h1 className="sc-h1">This programme has ended</h1>
          <p className="sc-body">
            {brand.name} isn&apos;t running rewards through {PRODUCT_NAME} at the moment, so there&apos;s nothing to
            join.
          </p>
          {programme.canRedeem && programme.honourUntil && (
            <p className="sc-body">
              If you were already collecting, what you earned is still yours to spend until{" "}
              {programme.honourUntil.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}.
            </p>
          )}
          <Link href="/wallet" className="sc-btn sc-btn-ghost">
            See my rewards
          </Link>
        </section>
      )}

      <section className="sc-card" hidden={!programme.canEarn}>
        {offers.length === 0 ? (
          <>
            <h1 className="sc-h1">Nothing running just yet</h1>
            <p className="sc-body">
              {brand.name} doesn&apos;t have a rewards promotion open at the moment. You can still join, and
              you&apos;ll be set up for the next one.
            </p>
          </>
        ) : (
          <>
            <h1 className="sc-h1">{offers[0]!.headline}</h1>
            {offers[0]!.condition && <p className="sc-body">{offers[0]!.condition}</p>}
            {/* A brand can run more than one thing at once; the poster leads
                with the first and lists the rest rather than pretending
                there is only ever one. */}
            {offers.length > 1 && (
              <div className="sc-rows">
                {offers.slice(1).map((offer) => (
                  <div className="sc-row" key={offer.campaignId}>
                    <div className="sc-row-main">
                      <span>{offer.headline}</span>
                      {offer.condition && <span className="sc-label">{offer.condition}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {status.joined ? (
          <>
            <p className="sc-body">
              You&apos;re already in. Scan the code on your next {brand.name} slip and it lands in your balance.
            </p>
            <Link href="/wallet" className="sc-btn">
              See my rewards
            </Link>
          </>
        ) : (
          <>
            {/* Said before the button, not after it, and said plainly.
                Somebody standing at a till who taps Join and then finds
                nothing in their balance has been misled by omission — the
                poster is the invitation, the slip is what pays. Shown only
                to somebody who has not joined: telling an existing member
                that joining is free reads as though they had not. */}
            <p className="sc-label">
              Joining is free and takes a phone number. You start earning from your next till slip — scan the code
              printed on it.
            </p>
            <JoinButton label={status.optedOut ? `Rejoin ${brand.name} rewards` : `Join ${brand.name} rewards`} />
          </>
        )}
      </section>

      {status.optedOut && (
        <section className="sc-card">
          <h2 className="sc-h2">You left this programme</h2>
          <p className="sc-body">
            Nothing was deleted when you did. Whatever you had earned is still there, and rejoining picks it up where
            you left it.
          </p>
        </section>
      )}

      <p className="sc-label">
        You can leave at any time from <Link href="/wallet/me">your details</Link>, and nothing you&apos;ve earned goes
        away when you do. If {brand.name} ends this programme, you&apos;ll have {HONOUR_WINDOW_DAYS} days to use
        whatever you&apos;ve built up.
      </p>
    </>
  );
}
