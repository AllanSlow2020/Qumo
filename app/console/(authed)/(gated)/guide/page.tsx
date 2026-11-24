import Link from "next/link";
import { BUDGET_NEAR } from "@/lib/console/observations";
import { HONOUR_WINDOW_DAYS } from "@/lib/subscriptions/state";
import { REDEMPTION_AVAILABLE } from "@/lib/wallet/availability";
import { PRODUCT_NAME } from "@/lib/product";
import { AwardShapes, HonourWindow } from "./figures";
import { CodeLadder } from "./code-ladder";
import { CostCalculator } from "./cost-calculator";
import { CustomerView } from "./customer-view";
import { HowSteps, More } from "./how-steps";
import { LoopDiagram } from "./loop";
import { OpenOnHash } from "./open-on-hash";
import { StampCardPlayground } from "./stamp-card";
import { WorkedExamples } from "./worked-examples";

/**
 * How to use the console: six steps, in order, one open at a time.
 *
 * The page used to be eight sections to read before you decided anything, and
 * the first thing it showed was a lot of text. It is now the order to do
 * things in. Each step says what to do in a sentence and opens onto the figure
 * that helps with it (the loop, the three shapes and the stamp card, the cost
 * calculator, the three kinds of code, the customer's phone), and the reasons
 * the sections used to carry sit inside the step they belong to, behind a fold.
 * Nothing was dropped; it was moved to where somebody is when they need it.
 *
 * The addresses the rest of the console links to (`/guide#cost` and the
 * others) each sit on the element they always meant. See steps.ts.
 *
 * ── Why the numbers in it are imported ───────────────────────────────────
 *
 * Every figure a reader could act on is pulled from the code that enforces
 * it rather than typed into the prose. A guide that says "60 days" beside an
 * engine that honours 90 is worse than no guide: it is a promise the product
 * does not keep, made in the product's own voice. If the constant moves,
 * this page moves with it.
 */

export const metadata = { title: `How to use the console · ${PRODUCT_NAME}` };

export default function ConsoleGuidePage() {
  const bodies = {
    1: (
      <>
        <div id="what" className="cn-how-bleed">
          <LoopDiagram />
        </div>
        <More title="Why it works this way">
    
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
        </More>
        <More id="examples" title="Not sure what to run? Three worked examples">
    <p>
      Three small businesses, each running one promotion. The facts come in the same order every time, so you
      can read across.
    </p>
    
          <WorkedExamples />
        </More>
      </>
    ),
    2: (
      <>
        <div id="awards" className="cn-how-bleed">
          <AwardShapes />
        </div>
        <div id="cards" className="cn-how-bleed">
          <StampCardPlayground />
        </div>
        <More title="Why it works this way">
    <p>
      Three shapes, set under <Link href="/promotions">Promotions</Link>.
    </p>

    
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
    <p>
      <strong>A stamp comes from either door.</strong> A till slip from one of your stores,
      or a code under a pack. If your tills print Qumo codes, only one promotion can earn
      from a slip at a time: a slip says which store and what the basket came to, and
      nothing that says which promotion it belongs to, so a second one would make the same
      receipt worth two different things. The console refuses the second rather than
      picking one.
    </p>
        </More>
      </>
    ),
    3: (
      <>
        <div id="cost" className="cn-how-bleed">
          <CostCalculator budgetNear={BUDGET_NEAR} />
        </div>
        <More title="Why it works this way">
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
    

    <p>
      <strong>A till that cannot sign its slips</strong> is the hole both are protecting.
      Where a point of sale cannot sign, the customer controls every field of the link,
      including what the basket came to - a shopper who has seen one of their own receipts
      can write more. The ceilings bound what that costs; they do not close it.{" "}
      <Link href="/stores">Stores</Link> shows which of yours can sign.
    </p>
        </More>
      </>
    ),
    4: (
      <>
        <div id="codes" className="cn-how-bleed">
          <CodeLadder />
        </div>
        <More title="Why it works this way">
    <p>
      This is the one idea worth getting right, because every other decision follows from
      it.
    </p>

    

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
        </More>
      </>
    ),
    5: null,
    6: (
      <>
        <div id="shopper" className="cn-how-bleed">
          <CustomerView />
        </div>
        <More title="Why it works this way">
    
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
          Spending a rand balance at a counter is not built yet, so today a balance
          accumulates. A completed card is different: it issues a code they can show you,
          and you take it on <Link href="/redeem">Redeem</Link>, which is what stops the
          same code working at the next counter.
        </>
      )}
    </p>
        </More>
      </>
    ),
  };

  return (
    <>
      <div className="cn-how-intro">
        <h1 className="cn-h1">How to use the console</h1>
        <p className="cn-body">Six steps, in order. Start at step 1.</p>
      </div>

      <OpenOnHash />
      <HowSteps bodies={bodies} />

      <section className="cn-how-after" aria-labelledby="how-after">
        <h2 className="cn-how-after-k" id="how-after">
          Once it is running
        </h2>
        <p className="cn-how-after-links">
          <Link href="/redeem">Hand over a reward</Link>
          <Link href="/">See how it is going</Link>
          <Link href="/stores">Get tills signing slips</Link>
          <Link href="/settings">Change how shoppers see it</Link>
          <a href="#ending">Pause or end</a>
        </p>
        <More id="ending" title="Pausing and ending">
    <p>
      Pausing a promotion stops it awarding immediately. Nothing already earned is touched,
      and switching it back on resumes where it left off.
    </p>
    <p>
      Ending the whole programme is different and deliberately gentle: customers keep what
      they earned for {HONOUR_WINDOW_DAYS} days, so a card somebody is two stamps from
      finishing does not vanish the day you stop. They are told the date.
    </p>
    

    <p>
      Deleting a promotion is only possible while it has never run. Once it has awarded
      anything, issued a reward or had codes printed, the console refuses - deleting it
      would take a customer&apos;s unredeemed reward with it and move your own record of
      what you issued.
    </p>
          <HonourWindow days={HONOUR_WINDOW_DAYS} />
        </More>
      </section>
    </>
  );
}
