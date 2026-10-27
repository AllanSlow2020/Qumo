import type { StepId } from "@/lib/console/promotion-steps";

/**
 * One icon per step.
 *
 * Inline rather than a sprite or a package: there are five, they are drawn
 * once, and a dependency for five paths is a dependency to upgrade forever.
 *
 * Every one is stroked in `currentColor` with no fill, so the marker's own
 * colour carries it and both themes work without a second set. All of them
 * are aria-hidden: the step's name is beside them in text, and a label on
 * the icon would have a screen reader say everything twice.
 *
 * Drawn on a 24 box and rendered at 20, which keeps the strokes on
 * half-pixels rather than between them.
 */
const PATHS: Record<StepId, React.ReactNode> = {
  // A luggage tag. The one step that is purely a label for the brand's own
  // benefit, and a tag is what a label looks like.
  name: (
    <>
      <path d="M12.6 3.2H20a.8.8 0 0 1 .8.8v7.4a.8.8 0 0 1-.23.57l-8.4 8.4a.8.8 0 0 1-1.14 0L3.26 13a.8.8 0 0 1 0-1.13l8.4-8.4a.8.8 0 0 1 .57-.24Z" />
      <circle cx="16.8" cy="7.2" r="1.4" />
    </>
  ),
  // A coin. Deliberately not a percent sign: a promotion awards a share of
  // a basket or a flat amount, and a percent would be right about half of
  // them.
  award: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.2v9.6M9.2 10.2h5.6M9.2 13.8h5.6" />
    </>
  ),
  // A stamp card, with the stamps it collects. The only icon here that
  // shows a thing a shopper would recognise.
  card: (
    <>
      <rect x="3.2" y="5.4" width="17.6" height="13.2" rx="2" />
      <circle cx="8" cy="10.2" r="1.25" />
      <circle cx="12" cy="10.2" r="1.25" />
      <circle cx="16" cy="10.2" r="1.25" />
      <circle cx="8" cy="14.4" r="1.25" />
      <circle cx="12" cy="14.4" r="1.25" />
      <circle cx="16" cy="14.4" r="1.25" />
    </>
  ),
  // A ceiling with bars rising into it. One bar stops short, which is what
  // a ceiling doing its job looks like.
  cost: (
    <>
      <path d="M3.6 5.4h16.8" />
      <path d="M7.2 20.4v-8.4M12 20.4v-5.4M16.8 20.4v-11" />
    </>
  ),
  // A switch, drawn on. The step is the act of switching, so the icon is
  // the state it puts you in.
  live: (
    <>
      <rect x="2.4" y="8" width="19.2" height="8" rx="4" />
      <circle cx="16.6" cy="12" r="2.6" />
    </>
  ),
};

export function StepIcon({ id }: { id: StepId }) {
  return (
    <svg
      className="cn-flow-icon"
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[id]}
    </svg>
  );
}
