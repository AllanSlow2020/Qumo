import Link from "next/link";
import { HONOUR_WINDOW_DAYS } from "@/lib/subscriptions/state";
import { REDEMPTION_AVAILABLE } from "@/lib/wallet/availability";
import { PRODUCT_NAME } from "@/lib/product";
import {
  AwardShapes,
  CardCarry,
  Ceiling,
  CodeKinds,
  HonourWindow,
  ScanJourney,
  TheLoop,
} from "./figures";

/**
 * How the thing works, in one place you can go to rather than on every page
 * you use.
 *
 * The console is a tool somebody opens every day. Explanation that helps in
 * week one is noise in week three, and inline help repeated across nine
 * pages pushes the numbers down the screen for the person who already knows
 * what a pack code is. So the guidance that belongs *in* the flow stays
 * short and tied to a decision being made right now - "500 is 5%", "a card
 * with no reward collects stamps and never pays out" - and the part that
 * explains concepts lives here, linked from the pages it is about.
 *
 * ── Why the numbers in it are imported ───────────────────────────────────
 *
 * Every figure a reader could act on is pulled from the code that enforces
 * it rather than typed into the prose. A guide that says "60 days" beside an
 * engine that honours 90 is worse than no guide: it is a promise the product
 * does not keep, made in the product's own voice. If the constant moves,
 * this page moves with it.
 */

export const metadata = { title: "How it works" };

/**
 * The contents, and the order of the page.
 *
 * One list rather than two. A hand-maintained contents beside hand-written
 * sections is two things that drift, and the one that drifts is the one
 * nobody is looking at.
 */
const CONTENTS = [
  { id: "what", title: "What Qumo actually does" },
  { id: "codes", title: "The three kinds of code" },
  { id: "awards", title: "What a promotion can award" },
  { id: "cards", title: "Stamp cards" },
  { id: "cost", title: "What it can cost you" },
  { id: "shopper", title: "What your customer sees" },
  { id: "ending", title: "Pausing and ending" },
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cn-panel" id={id}>
      <div className="cn-panel-head">
        <h2 className="cn-h2">{title}</h2>
      </div>
      <div className="cn-panel-body cn-prose">{children}</div>
    </section>
  );
}

export default function ConsoleGuidePage() {
  return (
    <>
      <h1 className="cn-h1">How it works</h1>
      <p className="cn-body">
        The ideas behind the console, in the order they matter. Nothing here changes anything - it
        is the page to read before you decide.
      </p>

      {/* The same grid the promotions page uses, so the rail is sticky and
          capped to the window without any layout written twice. Below the
          breakpoint it stacks, and the contents land under the reading
          rather than above it - on a phone a list of seven links before a
          word of the thing is a page you have to scroll past to start. */}
      <div className="cn-split">
        <div className="cn-split-main">
          <Section id="what" title="What Qumo actually does">
            <TheLoop />
            <p>
              You put a code somewhere a customer can only reach by buying something. They scan it
              with the camera they already have. They earn something with you, and both of you can
              see it happen.
            </p>
            <p>
              That is the whole mechanism. There is no app to install, no card to carry and no
              loyalty number to remember - a phone number signs them in and the record lives against
              that.
            </p>
            <p>
              What makes it worth anything is the first sentence:{" "}
              <strong>a code that proves a purchase</strong>. A voucher anybody can photograph off a
              poster rewards people for walking past. The rest of this page is mostly about that
              distinction.
            </p>
          </Section>

          <Section id="codes" title="The three kinds of code, and why only two of them pay">
            <p>
              This is the one idea worth getting right, because every other decision follows from
              it.
            </p>

            <CodeKinds />

            <h3 className="cn-h2">A poster code</h3>
            <p>
              One code, printed once, on a poster or a table-talker or a shelf tag. Anybody who
              walks past can scan it, and so can anybody they send a photograph to. It therefore
              proves nothing, and <strong>it never awards anything</strong>. What it does is explain
              whatever you have running and take a sign-up, which is exactly what a poster is for.
              Yours is on the <Link href="/promotions">promotions page</Link>, ready to print.
            </p>

            <h3 className="cn-h2">A pack code</h3>
            <p>
              A unique code, printed once per item, under a label or inside a sleeve or on the lid.
              Reaching it means having the item. Each one works exactly once, ever - a second scan
              of the same code tells the customer what it was worth and adds nothing.
            </p>
            <p>
              This is the route with no technical work. You print a run from{" "}
              <Link href="/codes">Pack codes</Link>, they go onto the packaging, and nothing has to
              talk to your till. If you are starting, start here.
            </p>

            <h3 className="cn-h2">A till slip code</h3>
            <p>
              A unique code printed per transaction on the receipt, carrying what the basket came
              to. This is the only one that can award a share of what somebody spent, because it is
              the only one that knows.
            </p>
            <p>
              It needs your point of sale to print it, and to sign it with a secret only that till
              holds. The signature is what stops a customer typing their own basket value into the
              link. A till that cannot sign is covered below.
            </p>
          </Section>

          <Section id="awards" title="What a promotion can award">
            <p>
              Three shapes, set under <Link href="/promotions">Promotions</Link>.
            </p>

            <AwardShapes />
            <p>
              <strong>A share of what they spend.</strong> Five percent of the basket, in rands,
              into a balance. Needs a till slip, for the reason above. Set in basis points, so 500
              is 5% - integers all the way down, because a percentage that rounds differently on two
              machines eventually pays two people differently for the same basket.
            </p>
            <p>
              <strong>A fixed amount per scan.</strong> R5 a code, or 50 points, or one stamp. Works
              on anything, including pack codes, because it does not care what was spent. The
              simplest thing to run and the easiest to explain on a sticker.
            </p>
            <p>
              <strong>A stamp toward a card.</strong> The same fixed award, with a finish line.
              Covered next.
            </p>
          </Section>

          <Section id="cards" title="Stamp cards">
            <p>
              Buy ten, get the tenth free. You set how many stamps complete a card and what
              completing one earns, and both live in the same form, because a card with no reward
              collects stamps forever and pays out nothing. The console refuses to switch one on in
              that state.
            </p>
            <p>
              <strong>Choosing the number is the whole decision.</strong> It has to be shorter than
              the gap between visits, or nobody finishes. A ten-stamp card at a coffee shop somebody
              passes daily is two weeks; the same card somewhere people come monthly is most of a
              year, and they will forget it exists. If stamps are going out and nothing is
              completing, the Overview will say so.
            </p>
            <p>
              Completion is recorded as a deduction, not a reset - a card&apos;s worth of stamps is
              taken off and anything over the line carries to the next card, so the eleventh
              purchase in a row is not wasted.
            </p>

            <CardCarry />
          </Section>

          <Section id="cost" title="What it can cost you, and what bounds it">
            <p>
              A promotion issues value. Nothing in the engine limits that except the ceilings you
              set, so those are not housekeeping - they are the answer when somebody asks what this
              can cost.
            </p>
            <p>
              <strong>The total it may ever issue</strong> is the one that matters. When it is
              reached the promotion stops awarding, quietly - a customer scanning afterwards is told
              it is not running, not that it ran out. Set it to a number you would be comfortable
              seeing on an invoice.
            </p>
            <p>
              <strong>The daily per-person cap</strong> bounds one determined individual rather than
              the campaign. It is the difference between someone finding a loophole and someone
              finding a loophole worth their afternoon.
            </p>
            <Ceiling />

            <p>
              <strong>A till that cannot sign its slips</strong> is the hole both are protecting.
              Where a point of sale cannot sign, the customer controls every field of the link,
              including what the basket came to - a shopper who has seen one of their own receipts
              can write more. The ceilings bound what that costs; they do not close it.{" "}
              <Link href="/stores">Stores</Link> shows which of yours can sign.
            </p>
          </Section>

          <Section id="shopper" title="What your customer sees">
            <ScanJourney />
            <p>
              Your name at the top, your colour on the button. Not ours - {PRODUCT_NAME} appears
              once, in small type at the bottom, saying who runs the thing. Set yours under{" "}
              <Link href="/settings">Programme</Link>.
            </p>
            <p>
              They scan, and the page tells them what the code was worth and what their balance is
              now. If they have never been seen before, it asks for a mobile number first and sends
              a passcode - no password, no app. The code they scanned waits for them while they do
              it.
            </p>
            <p>
              After that their rewards live at your address, and a stamp card shows as marks filling
              up rather than a number.
              {!REDEMPTION_AVAILABLE && (
                <>
                  {" "}
                  Spending a balance at a counter is not built yet, so today a balance accumulates
                  and a completed card issues a code they can show you.
                </>
              )}
            </p>
          </Section>

          <Section id="ending" title="Pausing and ending">
            <p>
              Pausing a promotion stops it awarding immediately. Nothing already earned is touched,
              and switching it back on resumes where it left off.
            </p>
            <p>
              Ending the whole programme is different and deliberately gentle: customers keep what
              they earned for {HONOUR_WINDOW_DAYS} days, so a card somebody is two stamps from
              finishing does not vanish the day you stop. They are told the date.
            </p>
            <HonourWindow days={HONOUR_WINDOW_DAYS} />

            <p>
              Deleting a promotion is only possible while it has never run. Once it has awarded
              anything, issued a reward or had codes printed, the console refuses - deleting it
              would take a customer&apos;s unredeemed reward with it and move your own record of
              what you issued.
            </p>
          </Section>
        </div>

        <aside className="cn-split-side">
          <nav className="cn-panel" aria-label="On this page">
            <div className="cn-panel-head">
              <h2 className="cn-h2">On this page</h2>
            </div>
            <ol className="cn-toc">
              {CONTENTS.map((c, i) => (
                <li key={c.id}>
                  <a href={`#${c.id}`}>
                    <span className="cn-toc-n" aria-hidden="true">
                      {i + 1}
                    </span>
                    {c.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
      </div>
    </>
  );
}
