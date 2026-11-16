"use client";

import { useState } from "react";
import { ACTIONS, scanOutcome, type OutcomeTone, type ScanAction, type ScanOutcome } from "@/lib/guide/scan";
import { AWARD_ROWS, CODES, START_HERE, type CodeId, type CodeKind } from "./codes";
import { Pack, Poster, Slip } from "./figures";

/**
 * The three kinds of code as a ladder of proof, with each rung something you
 * can scan.
 *
 * ── Why a ladder ─────────────────────────────────────────────────────────
 *
 * The guide's whole argument is one sentence: what a code can award depends
 * on what it can prove. The comparison table this replaced laid the three
 * codes side by side as equals, and they are not: each proves more than the
 * last, so each can pay for more. Rungs that rise left to right, with a meter
 * that fills, put the ordering in the shape of the thing rather than in a row
 * of words a reader has to compare for themselves.
 *
 * ── Why you can scan them ────────────────────────────────────────────────
 *
 * Three rules are easy to read and hard to believe: a poster never awards, a
 * pack code works once, a till slip with an edited total is refused. Pressing
 * the button and watching it happen is the difference between a reader
 * nodding at that and a reader knowing it. What each press does lives in
 * lib/guide/scan.ts, which is tested against the engine's own rounding.
 *
 * ── What is deliberately not here ────────────────────────────────────────
 *
 * Nothing in this reads a promotion or a ledger. The amounts are examples and
 * the caption says so; the rules are the engine's.
 *
 * ── How the selection works ──────────────────────────────────────────────
 *
 * Native radio buttons, visually replaced by the cards. That is the right
 * element for "exactly one of these", and it brings arrow-key movement and a
 * single tab stop for free, which a row of buttons carrying aria-pressed does
 * not. The card's hit area is its label, stretched in CSS, so the accessible
 * name is the code's name and not a paragraph.
 */

const ART: Record<CodeId, React.ReactNode> = {
  poster: <Poster />,
  pack: <Pack />,
  slip: <Slip />,
};

const BY_ID = Object.fromEntries(CODES.map((c) => [c.id, c])) as Record<CodeId, CodeKind>;

const TONE: Record<OutcomeTone, { text: string; className: string }> = {
  earned: { text: "Earned", className: "cn-pill cn-pill-ok" },
  none: { text: "Nothing", className: "cn-pill cn-pill-off" },
  used: { text: "Already used", className: "cn-pill cn-pill-warn" },
  refused: { text: "Refused", className: "cn-pill cn-pill-warn" },
};

/** Enough to show a pattern, few enough that the newest is still the thing you read. */
const KEEP = 4;

type Entry = ScanOutcome & { id: number };

function Tick() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="cn-rung-tick">
      <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Dash() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="cn-rung-dash">
      <path d="M4 8h8" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function CodeLadder() {
  const [selected, setSelected] = useState<CodeId>(START_HERE);
  const [log, setLog] = useState<Entry[]>([]);
  const [earned, setEarned] = useState(false);
  const [serial, setSerial] = useState(0);

  const code = BY_ID[selected];

  /** A different code is a different thing to scan: its history starts over. */
  function choose(id: CodeId) {
    setSelected(id);
    setLog([]);
    setEarned(false);
  }

  function act(action: ScanAction) {
    const outcome = scanOutcome(selected, action, earned);
    setLog((prev) => [{ ...outcome, id: serial }, ...prev].slice(0, KEEP));
    setSerial(serial + 1);
    if (outcome.tone === "earned") setEarned(true);
  }

  function reset() {
    setLog([]);
    setEarned(false);
  }

  return (
    <figure className="cn-fig cn-ladder">
      <div role="radiogroup" aria-label="Kind of code" className="cn-ladder-rungs">
        {CODES.map((c) => {
          const inputId = `code-kind-${c.id}`;
          const detailId = `code-kind-${c.id}-detail`;
          return (
            <div key={c.id} className="cn-rung" data-level={c.proofLevel} data-selected={selected === c.id}>
              <input
                id={inputId}
                className="cn-rung-input"
                type="radio"
                name="code-kind"
                value={c.id}
                checked={selected === c.id}
                aria-describedby={detailId}
                onChange={() => choose(c.id)}
              />
              <div className="cn-rung-top">
                {ART[c.id]}
                <label className="cn-rung-name" htmlFor={inputId}>
                  {c.name}
                </label>
              </div>

              <div className="cn-rung-body" id={detailId}>
                <div className="cn-rung-row">
                  <span className="cn-rung-k">Who can scan it</span>
                  <span className="cn-rung-v">{c.who}</span>
                </div>

                <div className="cn-rung-row">
                  <span className="cn-rung-k">What it proves</span>
                  <span className="cn-rung-v">
                    <span className="cn-meter" aria-hidden="true">
                      <span className={c.proofLevel >= 1 ? "cn-meter-on" : ""} />
                      <span className={c.proofLevel >= 2 ? "cn-meter-on" : ""} />
                    </span>
                    {c.proves}
                  </span>
                </div>

                <div className="cn-rung-row">
                  <span className="cn-rung-k">What it can award</span>
                  <ul className="cn-rung-awards">
                    {AWARD_ROWS.map((row) => {
                      const yes = c.awards[row.key];
                      return (
                        <li key={row.key} data-yes={yes}>
                          {yes ? <Tick /> : <Dash />}
                          <span>
                            {!yes && <span className="cn-sr">Cannot award </span>}
                            {row.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="cn-ladder-stage">
        <div className="cn-ladder-stage-head">
          <p className="cn-fig-name">Try it</p>
          <p className="cn-fig-body">{code.scene}</p>
        </div>

        <div className="cn-ladder-actions">
          {ACTIONS[selected].map((a) => (
            <button
              key={a.action}
              type="button"
              className={a.action === "scan" ? "cn-btn" : "cn-btn cn-btn-quiet"}
              onClick={() => act(a.action)}
            >
              {a.label}
            </button>
          ))}
          {log.length > 0 && (
            <button type="button" className="cn-btn cn-btn-quiet" onClick={reset}>
              Start again
            </button>
          )}
        </div>

        <ol className="cn-ladder-log" aria-live="polite" aria-label="What happened">
          {log.length === 0 ? (
            <li className="cn-ladder-empty">Nothing scanned yet.</li>
          ) : (
            log.map((entry) => (
              <li key={entry.id} className="cn-ladder-entry" data-tone={entry.tone}>
                <span className={TONE[entry.tone].className}>{TONE[entry.tone].text}</span>
                <span className="cn-ladder-entry-text">
                  <strong>{entry.line}</strong> {entry.detail}
                </span>
              </li>
            ))
          )}
        </ol>
      </div>

      <figcaption className="cn-fig-cap">
        Illustration. Made-up data. Nothing here reads your promotions. The amounts are examples, and the rules are the
        ones the engine applies.
      </figcaption>
    </figure>
  );
}
