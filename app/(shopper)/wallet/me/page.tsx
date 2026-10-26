import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireBrand } from "@/lib/brand/current";
import { brandTitle } from "@/lib/brand/theme";
import { listProgrammes } from "@/lib/consumer/membership";
import { getConsumerSessionDetail, listActiveSessions } from "@/lib/consumer/session";
import { PRODUCT_NAME } from "@/lib/product";
import { BrandHeader } from "../../brand-header";
import { signOutEverywhere } from "../actions";
import { SignOutButton } from "../sign-out-button";
import { DeleteAccountForm } from "./delete-account-form";
import { OptOutForm } from "./opt-out-form";

// Async, because the title has to name the brand: a static one would put
// "Qumo" in the tab of a page that says Copper Kettle everywhere else.
export async function generateMetadata(): Promise<Metadata> {
  return { title: brandTitle(await requireBrand(), "Your details") };
}

/**
 * The screen where the privacy notice's promises become buttons.
 *
 * It said a shopper could ask what is held about them, and stop taking
 * part, at any time. Both were true on paper and neither existed. Putting
 * them on one page - rather than behind a support address - is the
 * difference between a right and a form to request one.
 */
export default async function MePage() {
  const session = await getConsumerSessionDetail();
  if (!session) {
    redirect("/wallet/login");
  }
  const { personId, sessionId } = session;

  const brand = await requireBrand();
  const [programmes, sessions] = await Promise.all([
    listProgrammes(personId, brand.id),
    listActiveSessions(personId),
  ]);

  /*
   * The current device, then the three most recent others.
   *
   * The list is newest first, and the current session is not necessarily the
   * newest one - sign in on a second phone, come back to this one, and it
   * drops down the list. A plain slice would then show four rows reading
   * "Signed in" and never say which one you are on, which is the single
   * thing this card is for.
   */
  const current = sessions.find((s) => s.id === sessionId);
  const others = sessions.filter((s) => s.id !== sessionId);
  const shownSessions = [...(current ? [current] : []), ...others.slice(0, current ? 3 : 4)];
  const hiddenSessions = sessions.length - shownSessions.length;

  return (
    <>
      <BrandHeader caption="Your details" />

      <section className="sc-card">
        <h2 className="sc-h2">{brand.name} rewards</h2>
        {programmes.length === 0 ? (
          <p className="sc-body">
            You haven&apos;t joined yet. Scanning a code on a slip, a pack or a tag joins you to {brand.name}.
          </p>
        ) : (
          programmes.map((programme) => (
            <div key={programme.brandId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="sc-row">
                <div className="sc-row-main">
                  {/* Not the brand's name: it is already the heading of this
                      card and the mark at the top of the page, and a third
                      copy reads as though there might be a second row. */}
                  <span>{programme.optedOutAt ? "Opted out" : "Earning"}</span>
                  <span className="sc-label">
                    {programme.optedOutAt
                      ? `Left ${programme.optedOutAt.toLocaleDateString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}`
                      : `Joined ${programme.joinedAt.toLocaleDateString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}`}
                  </span>
                </div>
              </div>
              <OptOutForm
                brandId={programme.brandId}
                brandName={programme.brandName}
                optedOut={programme.optedOutAt !== null}
              />
            </div>
          ))
        )}
      </section>

      <section className="sc-card">
        <h2 className="sc-h2">Your data</h2>
        <p className="sc-body">
          Download everything {PRODUCT_NAME} holds about you: your number, every scan, every reward, and every time
          you signed in. It comes as a file you can keep.
        </p>
        {/* Said out loud because it is the one thing on this page wider than
            the page: the rest of this screen shows {brand.name} only, and
            the export deliberately does not. Narrowing it to match would be
            tidier and would answer a different question than the one a
            request for your data actually asks. {brand.name} never sees it -
            it is generated for the signed-in shopper and sent to them. */}
        <p className="sc-label">
          This covers every brand you&apos;ve joined through {PRODUCT_NAME}, not just {brand.name}.
        </p>
        {/* A plain link, not a button: this is a file download, and letting
            the browser do what it already does well beats reimplementing it.

            Ghost rather than the brand's colour. Nothing on this page is the
            page's purpose - it is the drawer somebody opens to leave, to
            take a copy, or to sign a lost phone out - and a solid brand-red
            block made a data export the loudest thing on the screen, louder
            than the balance it was reached from. The one primary button
            here is the way back to the rewards. */}
        <a href="/api/consumer/export" className="sc-btn sc-btn-ghost" download>
          Download my data
        </a>
      </section>

      {/* Its own card rather than a line under the export. They read as one
          pair - "what you hold" and "stop holding it" - and putting the
          irreversible one inside the same box as a download invites the
          wrong click. */}
      <section className="sc-card">
        <h2 className="sc-h2">Delete my account</h2>
        <p className="sc-body">
          This removes your number, your name and everything else that identifies you, across every brand you have
          joined through {PRODUCT_NAME}. It cannot be undone, and any rewards you have not used go with it.
        </p>
        <p className="sc-label">
          Download your data first if you want a copy. The <Link href="/legal/privacy">privacy notice</Link>{" "}
          explains what each brand keeps afterwards and why.
        </p>
        <DeleteAccountForm productName={PRODUCT_NAME} />
      </section>

      {sessions.length > 1 && (
        <section className="sc-card">
          <h2 className="sc-h2">Signed in on {sessions.length} devices</h2>
          {/* Four, then a count.

              We cannot name a device - nothing is stored that would let us
              say "Safari on an iPhone" - so every row past the current one
              reads "Signed in" and a date. Eight of those is not a list, it
              is a wall, and it buries the only control on the card that can
              do anything about it. The ones that matter are the current
              device and the most recent few; the rest are a number. */}
          <div className="sc-rows">
            {shownSessions.map((s) => (
              <div className="sc-row" key={s.id}>
                <div className="sc-row-main">
                  <span>{s.id === sessionId ? "This device" : "Signed in"}</span>
                  <span className="sc-label">
                    {s.createdAt.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                    {s.createdAt.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {hiddenSessions > 0 && (
            <p className="sc-label">
              and {hiddenSessions} older {hiddenSessions === 1 ? "one" : "ones"}. Signing out everywhere ends all of
              them, including this device.
            </p>
          )}
          <SignOutButton action={signOutEverywhere} variant="quiet">
            Sign out everywhere
          </SignOutButton>
        </section>
      )}

      {/* The one button on this page in the brand's own colour, and the
          comment on the export above depends on it staying that way. Every
          control here is a drawer somebody opened to leave, take a copy or
          sign a lost phone out; the way back to the rewards is the only
          thing on the screen anybody is pleased to press. */}
      <Link href="/wallet" className="sc-btn">
        Back to my {brand.name} rewards
      </Link>
    </>
  );
}
