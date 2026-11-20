"use client";

import { useState } from "react";
import { Choices, Slider, Steady, Swap } from "./controls";
import {
  COST_CONTROLS,
  COST_DEFAULTS,
  MONTH_DAYS,
  calculateCost,
  formatCount,
  formatPercent,
  formatRand,
  type AwardShape,
  type CostInput,
} from "@/lib/guide/cost";

/**
 * "What can this cost me?", answered by letting a brand move the numbers.
 *
 * The section above this says the total budget is the figure that matters and
 * that the daily limits bound one determined person rather than the campaign.
 * Both are true and neither is felt until you drag one and watch the other
 * stay where it is. So this takes the three ceilings the engine has, the
 * total, a value per person per day and a number of scans per person per day,
 * and shows what each does to the worst case.
 *
 * ── What it is, and is not ───────────────────────────────────────────────
 *
 * A teaching tool and nothing else. It never reads a promotion. Every figure
 * on it is whatever the reader dragged to, and the caption says they are
 * examples. What it is held to is agreeing with the engine, so the maths is in
 * lib/guide/cost.ts (tested) and the one rounding rule it shows is the
 * ledger's own function, not a description of it.
 *
 * ── Why the first screen is a promotion that is fine ─────────────────────
 *
 * It opens on numbers where one person cannot get near the budget. A tool that
 * opens on an alarming default teaches that the thing is alarming; one that
 * opens calm and lets the reader walk it into trouble teaches where the edge
 * is, which is what the section is for.
 */

const SHAPES: { value: AwardShape; label: string }[] = [
  { value: "FLAT", label: "The same amount every scan" },
  { value: "PERCENT", label: "A share of what they spend" },
];

const SCAN_LIMITS = COST_CONTROLS.scansPerDayChoices.map((n) => ({
  value: n,
  label: n === null ? "No limit" : n === 1 ? "1 scan" : `${n} scans`,
}));

/** The console's own names for the two per-person limits, for "stopped by". */
const BINDING_NAME = {
  value: "Per person, per day",
  scans: "Scans per person, per day",
  none: "",
} as const;

/*
 * Every sentence the verdict can be, kept together so the reserved space (see
 * Steady) is made from the same strings that are shown.
 */
const V_NONE = "A scan pays nothing at this basket size, so nothing is earned and nothing is at risk.";
const V_HIGH = "One person could take a large part of it in a month. Lower the daily limit or the scan limit.";
const V_LOW = "One person cannot get near it. The total budget, not the daily limit, is the real ceiling.";
const verdictAll = (days: string) =>
  `One person could use all of it in ${days} days. Lower the daily limit, the scan limit or the budget.`;
const VERDICT_GHOSTS = [V_NONE, V_HIGH, V_LOW, verdictAll("99,999")];

/** The longest each other changing line can get, at the widest numbers the sliders reach. */
const ROUNDING_GHOSTS = [
  "5% of R400 comes to R20.005. The ledger never pays part of a cent, so it rounds down.",
  "Exact, with nothing to round.",
  "The same every time.",
];
const PERSON_LINE_GHOST = "R10,000,000 of R10,000,000 at their daily most of R10,000, stopped by Scans per person, per day.";
const DAYS_GHOST = "To spend the whole budget takes one person 99,999 days, or 99,999 people in a single day.";

/**
 * `budgetNear` is the share of its budget at which the Overview starts saying
 * so (BUDGET_NEAR, in lib/console/observations.ts). It arrives as a prop, from
 * the server page that imports it, because that module reaches the database
 * and a client component cannot.
 */
export function CostCalculator({ budgetNear }: { budgetNear: number }) {
  const [v, setV] = useState<CostInput>(COST_DEFAULTS);
  const set = (patch: Partial<CostInput>) => setV((prev) => ({ ...prev, ...patch }));
  const r = calculateCost(v);

  const percent = v.shape === "PERCENT";
  const exact = r.exactAwardCents;
  const rounded = exact !== null && exact !== r.awardCents;
  const reach = Math.round(r.personMonthReach * 100);

  let verdict: string;
  if (r.awardCents === 0) {
    verdict = V_NONE;
  } else if (r.exposure === "all") {
    verdict = verdictAll(formatCount(r.personDaysToBudget ?? 0));
  } else if (r.exposure === "high") {
    verdict = V_HIGH;
  } else {
    verdict = V_LOW;
  }

  return (
    <figure className="cn-fig cn-calc">
      <div className="cn-calc-grid">
        <div className="cn-calc-controls">
          <div className="cn-calc-group">
            <p className="cn-fig-name">How a scan pays</p>
            <Choices legend="Award" name="calc-shape" value={v.shape} options={SHAPES} onChange={(shape) => set({ shape })} />

            <Swap active={percent ? 1 : 0}>
              {[
                <Choices
                  key="flat"
                  legend="Each scan pays"
                  name="calc-flat"
                  value={v.flatCents}
                  options={COST_CONTROLS.flatChoicesCents.map((c) => ({ value: c, label: formatRand(c) }))}
                  onChange={(flatCents) => set({ flatCents })}
                />,
                <div key="percent" className="cn-swap-group">
                  <Choices
                    legend="A share of the basket, in basis points"
                    name="calc-bps"
                    value={v.basisPoints}
                    options={COST_CONTROLS.basisPointChoices.map((b) => ({
                      value: b,
                      label: `${formatPercent(b)} (${formatCount(b)} bps)`,
                    }))}
                    onChange={(basisPoints) => set({ basisPoints })}
                  />
                  <Slider
                    id="calc-basket"
                    label="A typical basket"
                    min={COST_CONTROLS.basket.minCents}
                    max={COST_CONTROLS.basket.maxCents}
                    step={COST_CONTROLS.basket.stepCents}
                    value={v.basketCents}
                    shown={formatRand(v.basketCents)}
                    onChange={(basketCents) => set({ basketCents })}
                  />
                </div>,
              ]}
            </Swap>
          </div>

          <div className="cn-calc-group">
            <p className="cn-fig-name">Three limits</p>
            <Slider
              id="calc-total"
              label="Total budget"
              hint="The most this promotion may ever issue."
              min={COST_CONTROLS.total.minCents}
              max={COST_CONTROLS.total.maxCents}
              step={COST_CONTROLS.total.stepCents}
              value={v.totalCents}
              shown={formatRand(v.totalCents)}
              onChange={(totalCents) => set({ totalCents })}
            />
            <Slider
              id="calc-daily"
              label="Per person, per day"
              hint="The most one person can earn in a day."
              min={COST_CONTROLS.perPersonPerDay.minCents}
              max={COST_CONTROLS.perPersonPerDay.maxCents}
              step={COST_CONTROLS.perPersonPerDay.stepCents}
              value={v.perPersonPerDayCents}
              shown={formatRand(v.perPersonPerDayCents)}
              onChange={(perPersonPerDayCents) => set({ perPersonPerDayCents })}
            />
            <Choices
              legend="Scans per person, per day"
              name="calc-scans"
              value={v.scansPerDay}
              options={SCAN_LIMITS}
              onChange={(scansPerDay) => set({ scansPerDay })}
            />
            <p className="cn-calc-hint">Catches many small scans, which a value limit alone does not.</p>
          </div>
        </div>

        <div className="cn-calc-results">
          <div className="cn-grid cn-calc-metrics">
            <div className="cn-metric cn-metric-hero">
              <div className="cn-metric-k">The most it can ever cost you</div>
              <div className="cn-metric-v">{formatRand(v.totalCents)}</div>
              <div className="cn-metric-note">
                Then it stops awarding, quietly. A customer who scans afterwards is told it is not running. The
                Overview tells you when a promotion passes {Math.round(budgetNear * 100)}% of it.
              </div>
            </div>

            <div className="cn-metric">
              <div className="cn-metric-k">One scan pays</div>
              <div className="cn-metric-v">{formatRand(r.awardCents)}</div>
              <Steady className="cn-metric-note" ghosts={ROUNDING_GHOSTS}>
                {rounded && exact !== null
                  ? `${formatPercent(v.basisPoints)} of ${formatRand(v.basketCents)} comes to R${Number((exact / 100).toFixed(4))}. The ledger never pays part of a cent, so it rounds down.`
                  : percent
                    ? "Exact, with nothing to round."
                    : "The same every time."}
              </Steady>
            </div>

            <div className="cn-metric">
              <div className="cn-metric-k">Scans before the budget is spent</div>
              <div className="cn-metric-v">{r.scansToBudget === null ? "None" : formatCount(r.scansToBudget)}</div>
              <div className="cn-metric-note">at {formatRand(r.awardCents)} a scan</div>
            </div>
          </div>

          <div className="cn-calc-person" data-exposure={r.exposure}>
            <p className="cn-fig-name">One determined person, for {MONTH_DAYS} days</p>
            <div className="cn-fig-ceiling-bar">
              <div className="cn-fig-ceiling-fill" style={{ width: `${Math.max(reach, r.personMonthCents > 0 ? 1.5 : 0)}%` }} />
              <div className="cn-fig-ceiling-cap" />
            </div>
            <Steady className="cn-calc-person-line" ghosts={[PERSON_LINE_GHOST]}>
              <strong>
                {formatRand(r.personMonthCents)} of {formatRand(v.totalCents)}
              </strong>{" "}
              at their daily most of {formatRand(r.personDailyMaxCents)}
              {r.bindingLimit !== "none" && <>, stopped by {BINDING_NAME[r.bindingLimit]}</>}.
            </Steady>
            <Steady className="cn-calc-verdict" ghosts={VERDICT_GHOSTS} live>
              {verdict}
            </Steady>
            <Steady className="cn-calc-hint" ghosts={[DAYS_GHOST]}>
              {r.personDaysToBudget !== null &&
                `To spend the whole budget takes one person ${formatCount(r.personDaysToBudget)} days, or ${formatCount(r.personDaysToBudget)} people in a single day.`}
            </Steady>
          </div>
        </div>
      </div>

      <figcaption className="cn-fig-cap">
        Illustration. Made-up numbers, and nothing here reads your promotions. The month is {MONTH_DAYS} days to make a
        daily figure easy to picture. The rounding is the ledger&apos;s own.
      </figcaption>
    </figure>
  );
}
