"use client";

import { useState } from "react";
import {
  BAR_WEEKS,
  CARD_LENGTHS,
  DEFAULT_LENGTH,
  DEFAULT_VISITS,
  VISITS,
  WEEKS_COMPLETES,
  WEEKS_SLOW,
  cardFills,
  cardLine,
  cardVerdict,
  formatDuration,
  markerPercent,
  maxPurchases,
  weeksToComplete,
  type VisitRate,
} from "@/lib/guide/card";
import { Choices, Steady } from "./controls";

/**
 * "How long will a card take?", answered by changing the card.
 *
 * The section says choosing the number of stamps is the whole decision, and
 * that it has to be shorter than the gap between visits. Both are easy to
 * agree with and hard to feel. Pick a length and how often a regular comes in,
 * and the time it takes appears with a verdict; then add purchases and watch a
 * card fill, complete, and the next one start.
 *
 * ── What is the engine's and what is advice ──────────────────────────────
 *
 * The filling and completing is the ledger's own rule (lib/guide/card.ts,
 * tested). The verdict is a rule of thumb the console does not enforce, and
 * the caption says so rather than letting a coloured bar pass as a limit.
 *
 * ── Why the two cards are derived and not stored ─────────────────────────
 *
 * The only state is the choices and a count of purchases. The stamps on each
 * card, the reward badge and the sentence under them are all worked out from
 * those during render, so changing the card length cannot leave the cards
 * showing a state that no longer fits it.
 *
 * ── Motion ───────────────────────────────────────────────────────────────
 *
 * A stamp pops when it lands, a finished card picks up its badge, and the
 * marker slides along the bar. All of it is a CSS transition or keyframe on
 * an attribute, so React only changes data and the browser animates the
 * change. Reduced-motion turns every one of them off in console.css.
 */

/** Every verdict sentence, at the longest, for the reserved space under the time. */
// 43 weeks is ten stamps for a monthly regular, the longest the sentence gets.
const VERDICT_LINES = [1, 10, 43].map((w) => cardVerdict(w).line);

const LENGTHS = CARD_LENGTHS.map((n) => ({ value: n as number, label: `${n} stamps` }));
const VISIT_CHOICES = VISITS.map((v) => ({ value: v.id, label: v.label }));

/** More columns for a longer card, so the grid stays close to square. */
function columns(length: number): number {
  return length <= 6 ? 3 : length <= 8 ? 4 : length <= 10 ? 5 : 6;
}

function Card({ n, length, filled }: { n: number; length: number; filled: number }) {
  const complete = filled === length;
  return (
    <div className="cn-stampcard" data-complete={complete}>
      <div className="cn-stampcard-head">
        <span className="cn-stampcard-n">Card {n}</span>
        {complete && <span className="cn-pill cn-pill-ok cn-stampcard-badge">Reward issued</span>}
      </div>
      <div
        className="cn-stampcard-grid"
        style={{ gridTemplateColumns: `repeat(${columns(length)}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`Card ${n}: ${filled} of ${length} stamps`}
      >
        {Array.from({ length }, (_, i) => (
          <span key={i} className="cn-stamp" data-on={i < filled} />
        ))}
      </div>
    </div>
  );
}

export function StampCardPlayground() {
  const [length, setLength] = useState<number>(DEFAULT_LENGTH);
  const [visit, setVisit] = useState<VisitRate>(DEFAULT_VISITS);
  const [bought, setBought] = useState(0);

  const cap = maxPurchases(length);
  // Derived, not synchronised: shortening the card cannot leave more purchases
  // than two cards can show.
  const purchases = Math.min(bought, cap);
  const [one, two] = cardFills(purchases, length);

  const weeks = weeksToComplete(length, visit);
  const verdict = cardVerdict(weeks);
  const marker = markerPercent(weeks);
  const full = purchases >= cap;

  // Every sentence the line under the cards can be for this card length, from
  // the real function, so the space reserved for it is exactly the largest.
  const lineGhosts = [0, 1, length - 1, length, length + 1, cap - 1, cap].map((p) => cardLine(p, length));

  return (
    <figure className="cn-fig cn-card">
      <div className="cn-card-grid">
        <div className="cn-calc-controls">
          <div className="cn-calc-group">
            <Choices legend="Stamps to complete a card" name="card-length" value={length} options={LENGTHS} onChange={setLength} />
            <Choices
              legend="How often a regular customer visits"
              name="card-visits"
              value={visit}
              options={VISIT_CHOICES}
              onChange={setVisit}
            />
            <p className="cn-calc-hint">
              Change either one and the time, the verdict and the bar move with it. A card has to be shorter than the
              gap between visits, or nobody finishes it.
            </p>
          </div>
        </div>

        <div className="cn-calc-results">
          <div className="cn-card-result" data-tone={verdict.tone}>
            <div className="cn-card-result-head">
              <div className="cn-card-time">
                <span className="cn-card-time-k">One card takes</span>
                <span className="cn-card-time-v">{formatDuration(weeks)}</span>
              </div>
              <span className={`cn-pill cn-card-verdict-pill cn-card-pill-${verdict.tone}`}>
                <span className="cn-card-dot" aria-hidden="true" />
                {verdict.label}
              </span>
            </div>
            <Steady className="cn-card-verdict" ghosts={VERDICT_LINES} live>
              {verdict.line}
            </Steady>

            <div className="cn-card-bar-wrap">
              <div className="cn-card-bar" aria-hidden="true">
                <span className="cn-card-seg cn-card-seg-ok" style={{ width: `${(WEEKS_COMPLETES / BAR_WEEKS) * 100}%` }} />
                <span
                  className="cn-card-seg cn-card-seg-warn"
                  style={{ width: `${((WEEKS_SLOW - WEEKS_COMPLETES) / BAR_WEEKS) * 100}%` }}
                />
                <span className="cn-card-seg cn-card-seg-bad" />
                <span className="cn-card-marker" style={{ left: `${marker}%` }} />
              </div>
              <div className="cn-card-bar-keys" aria-hidden="true">
                <span>Completes</span>
                <span>Slow</span>
                <span>Too long</span>
              </div>
            </div>
          </div>

          <div className="cn-card-try">
            <div className="cn-card-try-head">
              <p className="cn-fig-name">Try it</p>
              <div className="cn-ladder-actions">
                <button type="button" className="cn-btn" disabled={full} onClick={() => setBought(Math.min(cap, purchases + 1))}>
                  Add a purchase
                </button>
                <button
                  type="button"
                  className="cn-btn cn-btn-quiet"
                  disabled={full}
                  onClick={() => setBought(Math.min(cap, purchases + 5))}
                >
                  Add five
                </button>
                {/* Always there, dimmed until there is something to undo, so the
                    row does not change width on the first purchase. */}
                <button type="button" className="cn-btn cn-btn-quiet" disabled={purchases === 0} onClick={() => setBought(0)}>
                  Start again
                </button>
              </div>
            </div>

            <div className="cn-stampcards">
              <Card n={1} length={length} filled={one} />
              <Card n={2} length={length} filled={two} />
            </div>

            <Steady className="cn-card-line" ghosts={lineGhosts} live>
              {cardLine(purchases, length)}
            </Steady>
          </div>
        </div>
      </div>

      <figcaption className="cn-fig-cap">
        Illustration. Made-up data. Each purchase earns one stamp, and a completed card is taken off as a deduction, not
        reset, so anything beyond the line stays for the next card. The time and the verdict are a rule of thumb, not a
        limit the console enforces.
      </figcaption>
    </figure>
  );
}
