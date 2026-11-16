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
