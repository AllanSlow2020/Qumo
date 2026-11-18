import type { CSSProperties } from "react";

/**
 * The loop, drawn large, in the brand's own colour.
 *
 * This is the business case in one picture, and it is the first thing under
 * the first heading, so it gets the room. Four steps in a line and an arrow
 * that brings the fourth back to the first: the fourth arrow is the whole
 * product. A row of boxes would end at "they earned something" and stop making
 * the argument.
 *
 * ── The colour ───────────────────────────────────────────────────────────
 *
 * It is the signed-in brand's accent, handed down as --cn-brand by the layout
 * (validated there, and the dark variant when the console is dark). That is
 * the one place the guide uses a brand's colour for anything but a phone
 * screen, and it is decoration only: the circles and the line. Every word is
 * ink. A brand with no colour set yet gets ink here, not a placeholder.
 *
 * It arrives with a short sequence, the line drawing across and each step
 * landing after the one before. That plays once, when the page does, and
 * reduced motion shows the finished diagram.
 */

const STAGES: { name: string; text: string; icon: React.ReactNode }[] = [
  {
    name: "They buy something",
    text: "Which they were going to do anyway.",
    icon: (
      <>
        <path d="M6 8h12l-1 12H7L6 8z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </>
    ),
  },
  {
    name: "A code proves it",
    text: "Under the label, or on the receipt.",
    icon: (
      <>
        <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" />
        <path d="M8 12h8" />
      </>
    ),
  },
  {
    name: "They earn with you",
    text: "Not with a scheme, not with a bank.",
    icon: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7L12 3z" />,
  },
  {
    name: "They come back",
    text: "Because the thing they earned is only good here.",
    icon: (
      <>
        <path d="M20 12a8 8 0 1 1-2.6-5.9" />
        <path d="M20 4v5h-5" />
      </>
    ),
  },
];

export function LoopDiagram() {
  return (
    <figure className="cn-fig cn-loop">
      <ol className="cn-loop-steps">
        {STAGES.map((s, i) => (
          <li key={s.name} className="cn-loop-step" style={{ "--i": i } as CSSProperties}>
            <span className="cn-loop-dot">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {s.icon}
              </svg>
            </span>
            <span className="cn-loop-k">Step {i + 1}</span>
            <span className="cn-fig-name">{s.name}</span>
            <span className="cn-fig-body">{s.text}</span>
          </li>
        ))}
      </ol>

      {/* The way back, from the fourth step to the first. Wide screens only:
          stacked, the steps are a list and there is no left and right to
          return across. */}
      <div className="cn-loop-back" aria-hidden="true">
        <svg viewBox="0 0 400 34" preserveAspectRatio="none" fill="none">
          <path d="M399 2v10a10 10 0 0 1-10 10H11A10 10 0 0 1 1 12V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d="M-4 11l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="cn-loop-back-t">and round again</span>
      </div>

      <figcaption className="cn-fig-cap">
        Closed-loop on purpose: what they earn is only good with you, which is the difference between a rewards
        programme and a discount.
      </figcaption>
    </figure>
  );
}
