import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { listProgrammes } from "@/lib/consumer/membership";
import { getConsumerSessionDetail, listActiveSessions } from "@/lib/consumer/session";
import { PRODUCT_NAME } from "@/lib/product";
import { Wordmark } from "../../wordmark";
import { signOutEverywhere } from "../actions";
import { OptOutForm } from "./opt-out-form";

export const metadata: Metadata = {
  title: `Your details · ${PRODUCT_NAME}`,
};

/**
 * The screen where the privacy notice's promises become buttons.
 *
 * It said a shopper could ask what is held about them, and stop taking
 * part, at any time. Both were true on paper and neither existed. Putting
 * them on one page — rather than behind a support address — is the
 * difference between a right and a form to request one.
 */
export default async function MePage() {
  const session = await getConsumerSessionDetail();
  if (!session) {
    redirect("/wallet/login");
  }
  const { personId, sessionId } = session;

  const [programmes, sessions] = await Promise.all([listProgrammes(personId), listActiveSessions(personId)]);

  return (
    <>
      <Wordmark caption="Your details" />

      <section className="sc-card">
        <h2 className="sc-h2">Your rewards programmes</h2>
        {programmes.length === 0 ? (
          <p className="sc-body">You haven&apos;t joined any yet. Scanning a code joins you to that brand.</p>
        ) : (
          programmes.map((programme) => (
            <div key={programme.brandId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="sc-row">
                <div className="sc-row-main">
                  <span>{programme.brandName}</span>
                  <span className="sc-label">
                    {programme.optedOutAt
                      ? "Opted out"
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
          Download everything {PRODUCT_NAME} holds about you — your number, every scan, every reward, and every time
          you signed in. It comes as a file you can keep.
        </p>
        {/* A plain link, not a button: this is a file download, and letting
            the browser do what it already does well beats reimplementing it. */}
        <a href="/api/consumer/export" className="sc-btn" download>
          Download my data
        </a>
        <p className="sc-label">
          {/* Explicit space: the transform drops a literal one that follows
              an element here, and "privacy notice— deletion" is what shipped
              on the stores page for the same reason. */}
          Want your account deleted instead? Read the <Link href="/legal/privacy">privacy notice</Link>{" "}
          — deletion has to reckon with rewards a brand has already honoured, so it isn&apos;t instant.
        </p>
      </section>

      {sessions.length > 1 && (
        <section className="sc-card">
          <h2 className="sc-h2">Signed in on {sessions.length} devices</h2>
          <div className="sc-rows">
            {sessions.map((s) => (
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
          <form action={signOutEverywhere}>
            <button type="submit" className="sc-btn sc-btn-quiet">
              Sign out everywhere
            </button>
          </form>
        </section>
      )}

      <Link href="/wallet" className="sc-btn sc-btn-ghost">
        Back to my rewards
      </Link>
    </>
  );
}
