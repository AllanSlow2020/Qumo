/**
 * The drawings in the guide.
 *
 * HTML with small inline SVG pictograms rather than whole diagrams drawn in
 * SVG. Text inside an SVG is text that does not reflow, does not grow with
 * the reader's own font size, cannot be selected or searched, and has to be
 * positioned by hand at every breakpoint. So the words are real HTML and
 * only the drawn parts are SVG, which is also what lets the same figure work
 * in a column 300px wide and one twice that.
 *
 * Every pictogram is aria-hidden and every figure carries its meaning in the
 * captions beside it. A diagram whose point is only visible in the picture
 * is a diagram half the readers do not get.
 *
 * Colour comes from the console's own tokens, never a hex, so these follow
 * the theme the operator chose rather than quietly assuming a light one.
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** A square-ish code, the mark every one of these shares. */
function CodeGlyph() {
  return (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" {...stroke} />
      <rect x="17" y="4" width="7" height="7" rx="1.5" {...stroke} />
      <rect x="4" y="17" width="7" height="7" rx="1.5" {...stroke} />
      <path d="M17 17h3v3h-3zM23 17v1M17 23h1M21 21h3v3" {...stroke} />
    </>
  );
}

function Poster() {
  return (
    <svg viewBox="0 0 48 40" className="cn-fig-art" aria-hidden="true">
      <rect x="11" y="2" width="26" height="33" rx="2" {...stroke} />
      <g transform="translate(12 6) scale(0.72)">
        <CodeGlyph />
      </g>
      <path d="M16 30h16M16 33.5h10" {...stroke} />
    </svg>
  );
}

function Pack() {
  return (
    <svg viewBox="0 0 48 40" className="cn-fig-art" aria-hidden="true">
      {/* A box with the code under the flap: the whole idea is that reaching
          it means having the thing. */}
      <path d="M8 13.5 24 7l16 6.5v16L24 36 8 29.5z" {...stroke} />
      <path d="M8 13.5 24 20l16-6.5M24 20v16" {...stroke} />
      <g transform="translate(17 21) scale(0.42)">
        <CodeGlyph />
      </g>
    </svg>
  );
}

function Slip() {
  return (
    <svg viewBox="0 0 48 40" className="cn-fig-art" aria-hidden="true">
      {/* A receipt, torn at the bottom, with a total above the code - the
          basket value is the thing only this one carries. */}
      <path d="M13 3h22v31l-3-2-3 2-3-2-3 2-3-2-3 2-3-2-1 .7z" {...stroke} />
      <path d="M17 9h14M17 13h9M24 17h7" {...stroke} />
      <g transform="translate(18 19) scale(0.4)">
        <CodeGlyph />
      </g>
    </svg>
  );
}

type Kind = { name: string; who: string; proves: string; awards: string; art: React.ReactNode; pays: boolean };

const KINDS: Kind[] = [
  {
    name: "A poster code",
    who: "Anybody walking past, and anybody they send a photo to",
    proves: "Nothing",
    awards: "Never awards. Explains what is running and takes a sign-up.",
    art: <Poster />,
    pays: false,
  },
  {
    name: "A pack code",
    who: "Whoever has the item in their hands",
    proves: "That it was bought",
    awards: "A fixed amount, once. Needs nothing from your till.",
    art: <Pack />,
    pays: true,
  },
  {
    name: "A till slip code",
    who: "Whoever took the receipt",
    proves: "That it was bought, and what it came to",
    awards: "A share of the basket, or a fixed amount. Needs a till that signs.",
    art: <Slip />,
    pays: true,
  },
];

/**
 * The three codes side by side.
 *
 * Laid out as three columns of the same four rows, because the comparison is
 * the content: a reader is meant to run their eye along "proves" and see
 * that one of them says Nothing.
 */
export function CodeKinds() {
  return (
    <figure className="cn-fig">
      <div className="cn-fig-kinds">
        {KINDS.map((k) => (
          <div key={k.name} className={`cn-fig-kind${k.pays ? "" : " cn-fig-kind-off"}`}>
            {k.art}
            <p className="cn-fig-name">{k.name}</p>
            <dl className="cn-fig-dl">
              <dt>Who can scan it</dt>
              <dd>{k.who}</dd>
              <dt>What it proves</dt>
              <dd>{k.proves}</dd>
              <dt>What it can award</dt>
              <dd>{k.awards}</dd>
            </dl>
          </div>
        ))}
      </div>
      <figcaption className="cn-fig-cap">
        The middle column is where most brands start: it proves a purchase and asks nothing of your point of sale.
      </figcaption>
    </figure>
  );
}

const STEPS = [
  { art: <Pack />, title: "A code goes out", body: "Under a label, or printed on the receipt. Each one works once." },
  {
    art: (
      <svg viewBox="0 0 48 40" className="cn-fig-art" aria-hidden="true">
        <rect x="15" y="3" width="18" height="34" rx="3" {...stroke} />
        <path d="M21 7h6" {...stroke} />
        <g transform="translate(17.5 12) scale(0.5)">
          <CodeGlyph />
        </g>
      </svg>
    ),
    title: "They scan it",
    body: "With the camera already on their phone. Nothing to install.",
  },
  {
    art: (
      <svg viewBox="0 0 48 40" className="cn-fig-art" aria-hidden="true">
        <rect x="9" y="11" width="30" height="18" rx="3" {...stroke} />
        <path d="M15 20h8M15 24h5" {...stroke} />
        <circle cx="31" cy="20" r="3.5" {...stroke} />
        <path d="M29.6 20l1 1 2-2.2" {...stroke} />
      </svg>
    ),
    title: "Once, a phone number",
    body: "A passcode by SMS. No password, no card, no loyalty number. The code waits for them.",
  },
  {
    art: (
      <svg viewBox="0 0 48 40" className="cn-fig-art" aria-hidden="true">
        <rect x="8" y="9" width="32" height="22" rx="3" {...stroke} />
        <path d="M8 16h32" {...stroke} />
        <circle cx="16" cy="24" r="2.6" {...stroke} />
        <circle cx="24" cy="24" r="2.6" {...stroke} />
        <circle cx="32" cy="24" r="2.6" strokeDasharray="2 2" {...stroke} />
      </svg>
    ),
    title: "It lands in their rewards",
    body: "At your address, wearing your name. They see what it was worth and what they have now.",
  },
];

/** The journey, end to end, which is four steps and no more. */
export function ScanJourney() {
  return (
    <figure className="cn-fig">
      <ol className="cn-fig-steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="cn-fig-step">
            <span className="cn-fig-num" aria-hidden="true">
              {i + 1}
            </span>
            {s.art}
            <p className="cn-fig-name">{s.title}</p>
            <p className="cn-fig-body">{s.body}</p>
          </li>
        ))}
      </ol>
      <figcaption className="cn-fig-cap">
        The third step happens once, ever. After that a scan is one tap and they are back in their rewards.
      </figcaption>
    </figure>
  );
}

/**
 * Why a twelfth stamp is not wasted.
 *
 * The carry-over is the part of the mechanic that prose struggles with and a
 * picture settles: a card's worth is deducted, the remainder stays.
 */
export function CardCarry() {
  return (
    <figure className="cn-fig">
      <div className="cn-fig-carry">
        <div className="cn-fig-carry-row">
          <span className="cn-fig-carry-label">They collect 12</span>
          <span className="cn-fig-marks" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} className="cn-fig-mark cn-fig-mark-on" />
            ))}
          </span>
        </div>
        <div className="cn-fig-carry-row">
          <span className="cn-fig-carry-label">A card takes 10</span>
          <span className="cn-fig-marks" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} className={`cn-fig-mark${i < 10 ? " cn-fig-mark-spent" : " cn-fig-mark-on"}`} />
            ))}
          </span>
        </div>
        <div className="cn-fig-carry-row">
          <span className="cn-fig-carry-label">2 carry over</span>
          <span className="cn-fig-marks" aria-hidden="true">
            {Array.from({ length: 2 }, (_, i) => (
              <i key={i} className="cn-fig-mark cn-fig-mark-on" />
            ))}
            {Array.from({ length: 8 }, (_, i) => (
              <i key={`e${i}`} className="cn-fig-mark" />
            ))}
          </span>
        </div>
      </div>
      <figcaption className="cn-fig-cap">
        Ten are deducted and the reward is issued. The eleventh and twelfth start the next card, so a customer who
        keeps going is never collecting into nothing.
      </figcaption>
    </figure>
  );
}

/**
 * The loop, which is the business case in one picture.
 *
 * Drawn as a cycle rather than the four-step strip further down, because
 * these are different claims. The strip is one customer's path through one
 * scan; this is why a brand would want any of it - the fourth arrow is the
 * whole product, and a line of boxes would end at "they earned something"
 * and stop making the argument.
 */
export function TheLoop() {
  const stages = [
    { n: "They buy something", d: "Which they were going to do anyway." },
    { n: "A code proves it", d: "Under the label, or on the receipt." },
    { n: "They earn with you", d: "Not with a scheme, not with a bank." },
    { n: "They come back", d: "Because the thing they earned is only good here." },
  ];
  return (
    <figure className="cn-fig">
      <ol className="cn-fig-loop">
        {stages.map((s, i) => (
          <li key={s.n} className="cn-fig-loop-step">
            <span className="cn-fig-loop-dot" aria-hidden="true" />
            <p className="cn-fig-name">{s.n}</p>
            <p className="cn-fig-body">{s.d}</p>
            {i === stages.length - 1 && (
              <span className="cn-fig-loop-back" aria-hidden="true">
                <svg viewBox="0 0 24 12" {...{ fill: "none" }}>
                  <path
                    d="M22 2v4a4 4 0 0 1-4 4H2m0 0 3-3M2 10l3 3"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
          </li>
        ))}
      </ol>
      <figcaption className="cn-fig-cap">
        Closed-loop on purpose: what they earn is only good with you, which is the difference between a rewards
        programme and a discount.
      </figcaption>
    </figure>
  );
}

/** The three award shapes, and the one thing each needs. */
export function AwardShapes() {
  const shapes = [
    {
      head: "A share of what they spend",
      eg: "5% of the basket",
      needs: "A till slip, because it is the only code that knows the basket",
    },
    { head: "A fixed amount per scan", eg: "R5 a code", needs: "Nothing. Works on a pack code" },
    { head: "A stamp toward a card", eg: "1 stamp, 10 completes", needs: "Nothing, plus a reward to finish into" },
  ];
  return (
    <figure className="cn-fig">
      <div className="cn-fig-shapes">
        {shapes.map((s) => (
          <div key={s.head} className="cn-fig-shape">
            <p className="cn-fig-name">{s.head}</p>
            <p className="cn-fig-eg">{s.eg}</p>
            <p className="cn-fig-body">
              <span className="cn-fig-needs">Needs</span> {s.needs}
            </p>
          </div>
        ))}
      </div>
      <figcaption className="cn-fig-cap">A promotion is one of these, not a mix.</figcaption>
    </figure>
  );
}

/**
 * The ceiling, and what happens either side of it.
 *
 * A bar rather than a sentence because the question it answers is "how
 * close am I", and that is a proportion.
 */
export function Ceiling() {
  return (
    <figure className="cn-fig">
      <div className="cn-fig-ceiling">
        <div className="cn-fig-ceiling-bar" aria-hidden="true">
          <span className="cn-fig-ceiling-fill" style={{ width: "72%" }} />
          <span className="cn-fig-ceiling-cap" />
        </div>
        <div className="cn-fig-ceiling-keys">
          <p className="cn-fig-body">
            <span className="cn-fig-key cn-fig-key-fill" aria-hidden="true" /> Issued so far. The Overview tells you
            when this passes 80%.
          </p>
          <p className="cn-fig-body">
            <span className="cn-fig-key cn-fig-key-cap" aria-hidden="true" /> The ceiling. Past it the promotion
            stops awarding, and a customer scanning is told it is not running - not that it ran out.
          </p>
        </div>
      </div>
      <figcaption className="cn-fig-cap">
        Set it to a number you would be comfortable seeing on an invoice. Nothing else in the engine bounds it.
      </figcaption>
    </figure>
  );
}

/** What ending a programme does to somebody two stamps from a reward. */
export function HonourWindow({ days }: { days: number }) {
  return (
    <figure className="cn-fig">
      <div className="cn-fig-time">
        <div className="cn-fig-time-track" aria-hidden="true">
          <span className="cn-fig-time-mark" />
          <span className="cn-fig-time-span" />
          <span className="cn-fig-time-mark cn-fig-time-end" />
        </div>
        <div className="cn-fig-time-keys">
          <div>
            <p className="cn-fig-name">You stop it</p>
            <p className="cn-fig-body">Nothing new is earned from this moment.</p>
          </div>
          <div>
            <p className="cn-fig-name">{days} days</p>
            <p className="cn-fig-body">Everything already earned can still be used, and they are told the date.</p>
          </div>
          <div>
            <p className="cn-fig-name">It closes</p>
            <p className="cn-fig-body">Balances end. Nothing is deleted - your record of what you issued stays.</p>
          </div>
        </div>
      </div>
      <figcaption className="cn-fig-cap">
        The window is why a card somebody is two stamps from finishing does not vanish the day you stop.
      </figcaption>
    </figure>
  );
}
