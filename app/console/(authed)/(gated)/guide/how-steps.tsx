import Link from "next/link";
import { STEPS, type Step } from "./steps";

/**
 * The six steps, as one list where one step is open at a time.
 *
 * Each step is a <details>, and they share a name, which is the whole of the
 * "one at a time" behaviour: opening one closes the others, with no script,
 * and it works before the page has hydrated. The first is open when the page
 * loads, so somebody who has never seen the console is looking at what to do.
 *
 * What opens is passed in by the page as `bodies`, keyed by step number, so
 * the figures (which are components, some of them interactive) stay where the
 * page can compose them and this file only draws the list.
 */

function Chevron() {
  return (
    <svg className="cn-how-chev" viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 5.5l3.5 3.5 3.5-3.5" />
    </svg>
  );
}

function Head({ step }: { step: Step }) {
  return (
    <summary className="cn-how-head">
      <span className="cn-how-n" aria-hidden="true">
        {String(step.n).padStart(2, "0")}
      </span>
      <span className="cn-how-titles">
        <span className="cn-how-t">
          <span className="cn-sr">Step {step.n}: </span>
          {step.title}
        </span>
        <span className="cn-how-sub">{step.sub}</span>
      </span>
      <span className="cn-how-end">
        {step.n === 1 && <span className="cn-how-badge">Start here</span>}
        <Chevron />
      </span>
    </summary>
  );
}

export function HowSteps({ bodies }: { bodies: Record<number, React.ReactNode> }) {
  return (
    <ol className="cn-how">
      {STEPS.map((step) => (
        <li key={step.n}>
          <details className="cn-how-item" name="how-steps" id={`step-${step.n}`} open={step.n === 1}>
            <Head step={step} />
            <div className="cn-how-body">
              <p className="cn-how-text">{step.text}</p>
              <div className="cn-how-act">
                <div className="cn-actions">
                  {step.actions.map((a) => (
                    <Link key={a.href} href={a.href} className={a.quiet ? "cn-btn cn-btn-quiet" : "cn-btn"}>
                      {a.label}
                    </Link>
                  ))}
                </div>
                <p className="cn-how-where">
                  <span>Where</span>
                  {step.screens.map((s) => (
                    <span key={s} className="cn-how-chip">
                      {s}
                    </span>
                  ))}
                </p>
              </div>
              {bodies[step.n]}
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}

/**
 * A fold inside a step, for the reasons. Closed until asked for, so a step
 * shows what to do and the figure, and the explanation is one tap away and
 * not on the page.
 */
export function More({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <details className="cn-how-more" id={id}>
      <summary className="cn-how-more-head">
        <span>{title}</span>
        <Chevron />
      </summary>
      <div className="cn-how-more-body cn-prose">{children}</div>
    </details>
  );
}
