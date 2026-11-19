"use client";

import { useGuide } from "./guide-state";
import { SECTIONS, TOTAL_MINS } from "./sections";

/**
 * "On this page", with how long each part is and where you are.
 *
 * The same list the sections are built from, so it cannot name a section that
 * is not there. Each item is a real link to the section's address, so it works
 * as a link first; the click also asks the provider to open the section,
 * because a link into a folded section that lands on a closed header is a link
 * that did half of what it said.
 *
 * The bar and the "Section 3 of 7" under it follow the section being read,
 * not a scroll percentage: seven sections of very different heights make a
 * percentage say something false about how far through you are.
 */
export function ReadingRail() {
  const guide = useGuide();
  const index = Math.max(0, SECTIONS.findIndex((s) => s.id === guide.current));

  return (
    <nav className="cn-panel" aria-label="On this page">
      <div className="cn-panel-head">
        <h2 className="cn-h2">On this page</h2>
        <span className="cn-rail-total">about {TOTAL_MINS} min</span>
      </div>
      <ol className="cn-toc cn-rail">
        {SECTIONS.map((s, i) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={guide.current === s.id ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault();
                guide.go(s.id);
              }}
            >
              <span className="cn-toc-n" aria-hidden="true">
                {i + 1}
              </span>
              <span className="cn-rail-t">{s.title}</span>
              <span className="cn-rail-m">{s.mins} min</span>
            </a>
          </li>
        ))}
      </ol>
      <div className="cn-rail-foot">
        <div className="cn-rail-bar" aria-hidden="true">
          <span style={{ width: `${((index + 1) / SECTIONS.length) * 100}%` }} />
        </div>
        <div className="cn-rail-foot-row">
          <span>
            Section {index + 1} of {SECTIONS.length}
          </span>
          <button type="button" className="cn-rail-all" onClick={() => guide.setAll(!guide.allOpen)}>
            {guide.allOpen ? "Fold all" : "Open all"}
          </button>
        </div>
      </div>
    </nav>
  );
}
