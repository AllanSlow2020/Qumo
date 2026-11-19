/**
 * The two controls the guide's interactive pieces share.
 *
 * Native inputs underneath, always: a radio group for "one of these" and a
 * range for "a number between", so the keyboard, a screen reader and a phone's
 * own controls all work without being rebuilt. The pill and the track are only
 * what they look like. See the .cn-choice and .cn-range rules in console.css.
 */

export function Choices<T extends string | number | null>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <fieldset className="cn-calc-field">
      <legend className="cn-calc-legend">{legend}</legend>
      <div className="cn-calc-choices">
        {options.map((o) => (
          <label key={String(o.value)} className="cn-choice">
            <input type="radio" name={name} checked={o.value === value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Slider({
  id,
  label,
  hint,
  min,
  max,
  step,
  value,
  shown,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  shown: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="cn-calc-field">
      <div className="cn-calc-slider-head">
        <label className="cn-calc-legend" htmlFor={id}>
          {label}
        </label>
        <output className="cn-calc-out" htmlFor={id}>
          {shown}
        </output>
      </div>
      <input
        id={id}
        className="cn-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={shown}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <p className="cn-calc-hint">{hint}</p>}
    </div>
  );
}

/**
 * A line of text whose height never changes, whatever it says.
 *
 * The guide's figures answer to a click by changing a sentence: a verdict, a
 * note on the rounding, what a scan did. The sentences are different lengths,
 * so on a phone one wraps to two lines and the next to five, the box grows, and
 * everything under the figure jumps by however much it grew. The control that
 * was clicked does not move; the page beneath it does, which reads as the page
 * being unsteady.
 *
 * The fix is to reserve the room. Behind the visible text sits an invisible
 * copy of every sentence it could be, stacked in one grid cell, so the cell is
 * always as tall as the tallest and nothing below ever moves. The ghosts are
 * hidden from assistive technology and from clicks, and they are set in the
 * same class as the visible line so they wrap exactly as it will.
 *
 * Callers pass the real variants, not a guess at a height, so it stays right
 * at every width and when the wording changes.
 */
export function Steady({
  ghosts,
  className,
  live,
  children,
}: {
  /** Every sentence the line can be, at its longest. */
  ghosts: string[];
  className?: string;
  /** Announce changes to a screen reader. */
  live?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="cn-steady">
      <p className={className} aria-live={live ? "polite" : undefined}>
        {children}
      </p>
      <div className="cn-steady-ghost" aria-hidden="true">
        {ghosts.map((g) => (
          <p key={g} className={className}>
            {g}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * Alternatives that take turns in the same place, so the space is always the
 * size of the largest and swapping them moves nothing. The inactive ones are
 * invisible and inert: not focusable, not clickable, not read out.
 */
export function Swap({ active, children }: { active: number; children: React.ReactNode[] }) {
  return (
    <div className="cn-swap">
      {children.map((child, i) => (
        <div key={i} className="cn-swap-item" data-active={i === active} inert={i !== active}>
          {child}
        </div>
      ))}
    </div>
  );
}
