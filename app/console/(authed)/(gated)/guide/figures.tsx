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
