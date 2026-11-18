"use client";

import { useRef, useState } from "react";
import { slipMoney, type Example } from "@/lib/guide/examples";

/**
 * The worked examples, as tabs.
 *
 * Real tabs, with the arrow-key behaviour a tablist is expected to have: one
 * tab stop for the whole list, left and right to move, Home and End to jump.
 * The three panels are all in the page and the inactive ones are `hidden`, so
 * find-in-page, a screen reader's headings and a printed copy still reach
 * them, and switching is not a re-render of anything that has to be rebuilt.
 *
 * The panel plays its arrival animation when it stops being hidden, which is
 * the moment `display` changes, so no state is needed to trigger it.
 */

/** A code, drawn as one: a fixed pattern, because it is an illustration. */
function CodeGlyph() {
  const on = [
    [1, 1, 1, 0, 1, 1, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 1, 1, 0, 1, 1, 1],
    [0, 1, 0, 1, 0, 0, 1],
    [1, 1, 1, 0, 1, 1, 0],
    [1, 0, 1, 1, 0, 1, 1],
    [1, 1, 1, 0, 1, 0, 1],
  ];
  return (
    <svg viewBox="0 0 7 7" width="44" height="44" aria-hidden="true" shapeRendering="crispEdges">
      {on.flatMap((row, y) => row.map((v, x) => (v ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" /> : null)))}
    </svg>
  );
}

function Receipt({ example }: { example: Example }) {
  const r = example.receipt!;
  return (
    <div className="cn-ex-paper cn-ex-slip" role="img" aria-label={`A till slip from ${example.brand}, total ${slipMoney(r.totalCents)}, with a code printed on it`}>
      <p className="cn-ex-slip-brand">{example.brand}</p>
      <div className="cn-ex-slip-rows">
        {r.lines.map((l) => (
          <div key={l.name} className="cn-ex-slip-row">
            <span>{l.name}</span>
            <span>{slipMoney(l.cents)}</span>
          </div>
        ))}
      </div>
      <div className="cn-ex-slip-row cn-ex-slip-total">
        <span>TOTAL</span>
        <span>{slipMoney(r.totalCents)}</span>
      </div>
      <div className="cn-ex-slip-code">
        <CodeGlyph />
        <span>{r.codeText}</span>
      </div>
    </div>
  );
}

function Label({ example }: { example: Example }) {
  const l = example.label_!;
  return (
    <div className="cn-ex-paper cn-ex-pack" role="img" aria-label={`A box of ${example.brand} ${l.product}, with a code printed under the label`}>
      <p className="cn-ex-slip-brand">{example.brand}</p>
      <p className="cn-ex-pack-product">{l.product}</p>
      <p className="cn-ex-pack-detail">{l.detail}</p>
      <div className="cn-ex-slip-code">
        <CodeGlyph />
        <span>{l.codeText}</span>
      </div>
    </div>
  );
}

export function ExampleTabs({ examples }: { examples: Example[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const last = examples.length - 1;
    const next = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <figure className="cn-fig cn-ex">
      <div className="cn-ex-tabs" role="tablist" aria-label="Worked examples">
        {examples.map((ex, i) => (
          <button
            key={ex.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`ex-tab-${ex.id}`}
            aria-selected={i === active}
            aria-controls={`ex-panel-${ex.id}`}
            tabIndex={i === active ? 0 : -1}
            className="cn-ex-tab"
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {ex.label}
          </button>
        ))}
      </div>

      {examples.map((ex, i) => (
        <div
          key={ex.id}
          role="tabpanel"
          id={`ex-panel-${ex.id}`}
          aria-labelledby={`ex-tab-${ex.id}`}
          hidden={i !== active}
          tabIndex={0}
          className="cn-ex-panel"
        >
          <div className="cn-ex-head">
            <p className="cn-ex-brand">{ex.brand}</p>
            <span className="cn-pill">{ex.shape}</span>
            <span className="cn-pill cn-pill-off">{ex.code}</span>
          </div>

          <div className="cn-ex-grid">
            <div className="cn-ex-art">
              {ex.receipt ? <Receipt example={ex} /> : <Label example={ex} />}
              <p className="cn-fig-body">{ex.printed}</p>
            </div>

            <dl className="cn-ex-facts">
              {ex.facts.map((f) => (
                <div key={f.k} className="cn-ex-fact">
                  <dt>{f.k}</dt>
                  <dd>{f.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="cn-ex-stands">
            <strong>Where it stands.</strong> {ex.stands}
          </p>
        </div>
      ))}

      <figcaption className="cn-fig-cap">
        Illustration. Made-up brands and till slips. The figures are worked out by the same code the console uses.
      </figcaption>
    </figure>
  );
}
