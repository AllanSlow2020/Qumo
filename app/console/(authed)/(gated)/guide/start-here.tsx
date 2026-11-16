import { CODES, START_HERE, type CodeId } from "./codes";
import { Pack, Poster, Slip } from "./figures";

/**
 * The first thing on the guide: which door to open.
 *
 * Everything else on this page explains an idea, in the order the ideas build.
 * A brand owner arriving cold does not yet know there are three doors, so the
 * page opens by naming them and saying which is the cheapest to walk through,
 * and lets everything after it be the detail. The guide already told people
 * "if you are starting, start here" in the middle of a paragraph under the
 * pack code; this puts it where somebody who reads one thing will find it.
 *
 * ── Why it is not interactive ────────────────────────────────────────────
 *
 * The ladder below is, and a second set of controls up here would only be a
 * second place to learn how this page works. These are three cards and a
 * link each, so the whole component is server-rendered and costs the browser
 * nothing.
 *
 * ── Why each card is not one big link ────────────────────────────────────
 *
 * A link wrapped around a card reads, to a screen reader, as the card's whole
 * text as one name. The card is plain markup with a short link inside it, and
 * the link's hit area is stretched over the card in CSS, so a click anywhere
 * on it works and the accessible name stays "See how it works".
 */

const ART: Record<CodeId, React.ReactNode> = {
  poster: <Poster />,
  pack: <Pack />,
  slip: <Slip />,
};

/** The pill under each name says what the code proves, in a word the pill's colour agrees with. */
const PROOF_PILL: Record<CodeId, { text: string; tone: string }> = {
  poster: { text: "Proves nothing", tone: "cn-pill cn-pill-off" },
  pack: { text: "Proves the item", tone: "cn-pill cn-pill-ok" },
  slip: { text: "Proves the amount", tone: "cn-pill cn-pill-ok" },
};

export function StartHere() {
  return (
    <section className="cn-panel cn-start" aria-labelledby="start-here-title">
      <div className="cn-panel-head">
        <h2 className="cn-h2" id="start-here-title">
          Where to start
        </h2>
      </div>
      <div className="cn-panel-body">
        <p className="cn-body cn-start-lead">
          Pick the code you can put to work today. Each one proves something different, and what it proves decides
          what a promotion can award.
        </p>

        <div className="cn-start-grid">
          {CODES.map((code) => (
            <div key={code.id} className={`cn-start-card${code.id === START_HERE ? " cn-start-card-first" : ""}`}>
              <div className="cn-start-top">
                {ART[code.id]}
                {code.id === START_HERE && <span className="cn-start-badge">Start here</span>}
              </div>
              <h3 className="cn-start-name">{code.name}</h3>
              <p className="cn-start-body">{code.summary}</p>
              <span className={PROOF_PILL[code.id].tone}>{PROOF_PILL[code.id].text}</span>
              <dl className="cn-start-effort">
                <dt>Effort</dt>
                <dd>{code.effort}</dd>
              </dl>
              <a className="cn-start-link" href="#codes">
                See how it works
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
