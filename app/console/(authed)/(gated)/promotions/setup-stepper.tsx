"use client";

import type { PromotionStep, StepId, StepState } from "@/lib/console/promotion-steps";
import { StepIcon } from "./step-icons";

/**
 * The five steps, as a rail you can read and click.
 *
 * ── Why the state is not carried by colour alone ─────────────────────────
 *
 * Four of the five states have to be distinguishable by somebody who
 * cannot tell the accent blue from the warning amber, so each one changes
 * the marker's *shape* as well as its colour: done is filled, the open step
 * is a thick ring, a skipped step is dashed, and a locked one is faint with
 * a dimmed label. The two that carry a consequence also get a glyph - a
 * tick for done, an exclamation for attention - which is a third channel
 * and the one that survives a greyscale print of a screenshot.
 *
 * ── Why a locked step is rendered at all ─────────────────────────────────
 *
 * It would be tidier to show three steps and grow to five. It would also
 * hide the shape of the job from the person doing it for the first time,
 * which is the entire reason this page became a stepper. Five visible
 * steps, two of them not yet reachable, answers "how much of this is left"
 * before the first field is filled in.
 */

/** The word a screen reader hears after the step's name. */
const SPOKEN: Record<StepState, string> = {
  done: "done",
  todo: "to do",
  attention: "needs attention",
  skipped: "skipped",
  locked: "not available yet",
};

function Marker({ step, open }: { step: PromotionStep; open: boolean }) {
  return (
    <span className={`cn-flow-mark${open ? " cn-flow-mark-open" : ""}`} data-state={step.state}>
      <StepIcon id={step.id} />
      {/* A second channel on the two states that cost something. Positioned
          over the marker's corner rather than replacing the icon, so the
          step is still identifiable by its own picture. */}
      {step.state === "done" && (
        <svg className="cn-flow-badge" viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
          <path
            d="M2.5 6.3 4.7 8.5 9.5 3.7"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {step.state === "attention" && (
        <svg className="cn-flow-badge" viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
          <path d="M6 2.6v4.2" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          <circle cx="6" cy="9.4" r="1.05" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

export function SetupStepper({
  steps,
  open,
  onPick,
}: {
  steps: PromotionStep[];
  /** The step whose panel is showing. */
  open: StepId;
  onPick: (id: StepId) => void;
}) {
  return (
    <nav aria-label="Setting up this promotion">
      <ol className="cn-flow-rail">
        {steps.map((step, i) => {
          const locked = step.state === "locked";
          const isOpen = step.id === open;
          return (
            <li
              key={step.id}
              className="cn-flow-step"
              data-state={step.state}
              /* On the <li> rather than the button, because the step is
                 the thing in the sequence; the button is how you reach it. */
              aria-current={isOpen ? "step" : undefined}
            >
              <button
                type="button"
                className="cn-flow-btn"
                onClick={() => onPick(step.id)}
                disabled={locked}
                aria-disabled={locked || undefined}
              >
                <Marker step={step} open={isOpen} />
                <span className="cn-flow-text">
                  <span className="cn-flow-n">Step {i + 1}</span>
                  <span className="cn-flow-title">{step.title}</span>
                  {/* Only worth saying while it is still a choice. Once the
                      card is set up, "optional" is noise about a decision
                      already taken. */}
                  {step.optional && step.state !== "done" && <span className="cn-flow-opt">Optional</span>}
                </span>
                <span className="cn-sr">{SPOKEN[step.state]}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
