"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConsoleCampaign } from "@/lib/campaigns/manage";
import type { PromotionStep } from "@/lib/console/promotion-steps";
import { PROOF_TIERS, TIER_COPY, type ProofTier } from "@/lib/proof/tier";
import {
  PROMOTION_SHAPES,
  SHAPE_COPY,
  shapeOfRule,
  type PromotionShape,
} from "@/lib/console/promotion-shape";
import { renameCampaign, setCard, setLimits, setRule, setShape } from "./actions";
import { DeleteButton } from "./delete-button";
import { StatusButton } from "./status-button";
import { IDLE, type PromoActionState } from "./state";

/**
 * One step's panel: the instruction, then the form that answers it.
 *
 * These used to be three forms stacked in a narrow rail, which worked and
 * explained nothing. A brand setting up their first promotion saw three
 * headings and nine fields at once and had to infer both the order and
 * which parts were optional. The sequence was in a code comment and on the
 * screen nowhere.
 *
 * Splitting them one per step is what makes the stacked layout viable at
 * all: one form is short enough that the list of live promotions still fits
 * under it, which was the objection to moving the list down in the first
 * place.
 *
 * Each form still saves on its own and still carries its own remount key.
 * That key is not decoration - defaultValue is applied by React at mount
 * and never again, so without it a form re-rendered after a save shows the
 * values it was born with while the card beside it shows the new ones.
 */

/** Shared by every step: what this step is for, above the fields. */
function StepIntro({ blurb, state }: { blurb: string; state: PromotionStep["state"] }) {
  return (
    <p className={`cn-body${state === "attention" ? " cn-warn-note" : ""}`} style={{ marginTop: 0 }}>
      {blurb}
    </p>
  );
}

/**
 * Step one on a promotion that already exists.
 *
 * It used to render the name as a sentence and nothing else, which made the
 * first step of a five step sequence the one step that could not be done.
 * The fields are the ones creation asks for, in the same order, so the step
 * looks the same whether you are arriving at it or coming back to it.
 */
function NameForm({ campaign }: { campaign: ConsoleCampaign }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PromoActionState, FormData>(renameCampaign, IDLE);
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form
      /* Keyed on what came back from the server, like every other form
         here: these are defaultValues, so without it a rename would save
         and the boxes would keep showing the old text. */
      key={`name-${campaign.name}-${campaign.description}`}
      action={action}
      className="cn-form"
    >
      <input type="hidden" name="campaignId" value={campaign.id} />

      <div className="cn-field">
        <label htmlFor={`name-${campaign.id}`}>Name</label>
        <input
          id={`name-${campaign.id}`}
          name="name"
          className="cn-input"
          required
          maxLength={120}
          defaultValue={campaign.name}
        />
        <p className="cn-label">For your own reference. Shoppers see what it awards, not what you called it.</p>
      </div>

      <div className="cn-field">
        <label htmlFor={`note-${campaign.id}`}>Note (optional)</label>
        <input
          id={`note-${campaign.id}`}
          name="description"
          className="cn-input"
          maxLength={500}
          defaultValue={campaign.description ?? ""}
        />
      </div>

      {state.ok === false && (
        <p className="cn-err" role="alert">
          {state.error}
        </p>
      )}
      {/* Said here because this is the one form on the page that is safe on
          a live promotion, and somebody editing a running one should know
          that before they press it. */}
      <p className="cn-label">
        Changing these two is safe at any time. Neither touches what the promotion awards or whether it is running.
      </p>
      <button type="submit" className="cn-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : state.ok ? "Saved. Save again" : "Save the name"}
      </button>
    </form>
  );
}

/**
 * Step two, which used to ask the database's question instead of the
 * brand's.
 *
 * It had two selects, "Kind" and "Awarded in", and showed both kinds'
 * fields at once because hiding one behind JavaScript would have made the
 * form behave differently depending on whether the script loaded. The
 * reasoning was sound and the result was a coffee shop being asked for the
 * share of the basket in basis points to set up a stamp card, with a
 * default combination that multiplies stamps by rands.
 *
 * Now it asks one question with three answers. The kind saves on its own,
 * the step redraws, and the second form can only ever carry fields that
 * belong to the kind on screen. No script required, and a submission can
 * no longer assert a kind the promotion is not.
 */
function ShapeForm({ campaign }: { campaign: ConsoleCampaign }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PromoActionState, FormData>(setShape, IDLE);
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const shape = shapeOfRule(campaign.rule);
  const [choice, setChoice] = useState<PromotionShape>(shape ?? "STAMP_CARD");

  // Deliberately unkeyed, unlike every other form on this page. Those
  // carry defaultValues and have to be remounted after a save or they go
  // on showing the values they were born with. This one is controlled, so
  // a remount does the opposite: it throws away the kind the brand just
  // picked and leaves the select disagreeing with the sentence under it.
  return (
    <form action={action} className="cn-form">
      <input type="hidden" name="campaignId" value={campaign.id} />

      <div className="cn-field">
        <label htmlFor={`shape-${campaign.id}`}>What kind of promotion is this?</label>
        <select
          id={`shape-${campaign.id}`}
          name="shape"
          className="cn-input"
          value={choice}
          onChange={(e) => setChoice(e.target.value as PromotionShape)}
        >
          {PROMOTION_SHAPES.map((s) => (
            <option key={s} value={s}>
              {SHAPE_COPY[s].label}
            </option>
          ))}
        </select>
        {/* Both lines, always: what it does, and where the proof has to
            come from. The second one is the thing the old form never said
            anywhere, and not saying it is why somebody configured a share
            of spend in stamps to get stamps out of a till slip. */}
        <p className="cn-label">{SHAPE_COPY[choice].blurb}</p>
        <p className="cn-label">{SHAPE_COPY[choice].door}</p>
      </div>

      {state.ok === false && (
        <p className="cn-err" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="cn-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending
          ? "Saving…"
          : state.ok
            ? "Saved. Save again"
            : shape === choice
              ? "Save the kind"
              : shape
                ? "Change the kind"
                : "Use this kind"}
      </button>
      {shape && shape !== choice && (
        <p className="cn-label cn-warn-note">
          Changing the kind replaces the figures below with that kind&apos;s own, because they do not mean the same
          thing. Anything already earned stays earned.
        </p>
      )}
    </form>
  );
}

/** The figures for a share of spend: a percentage, a floor, and proof. */
function ShareForm({ campaign, photoReady }: { campaign: ConsoleCampaign; photoReady: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PromoActionState, FormData>(setRule, IDLE);
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const rule = campaign.rule;
  const [tier, setTier] = useState<ProofTier>(rule?.minProofTier ?? "UNSIGNED");

  return (
    <form
      key={`share-${rule?.basisPoints}-${rule?.minSpendCents}-${rule?.minProofTier}`}
      action={action}
      className="cn-form"
    >
      <input type="hidden" name="campaignId" value={campaign.id} />

      <div className="cn-field">
        <label htmlFor={`pct-${campaign.id}`}>Share of the basket, as a percentage</label>
        <input
          id={`pct-${campaign.id}`}
          name="percent"
          className="cn-input"
          type="number"
          min={0.01}
          max={100}
          step={0.01}
          defaultValue={rule?.basisPoints ? Number((rule.basisPoints / 100).toFixed(2)) : 5}
        />
        {/* Typed as a percentage and stored as basis points. The ledger
            stays integers; the brand stops doing the arithmetic. */}
        <p className="cn-label">A R100 basket at 5% earns R5.00.</p>
      </div>

      <div className="cn-field">
        <label htmlFor={`min-${campaign.id}`}>Smallest basket that earns, in rands (optional)</label>
        <input
          id={`min-${campaign.id}`}
          name="minimumBasket"
          className="cn-input"
          type="number"
          min={0}
          step={0.01}
          defaultValue={rule?.minSpendCents != null ? Number((rule.minSpendCents / 100).toFixed(2)) : ""}
        />
        <p className="cn-label">Leave empty to award on any basket, however small.</p>
      </div>

      <div className="cn-field">
        <label htmlFor={`proof-${campaign.id}`}>What counts as proof of purchase</label>
        <select
          id={`proof-${campaign.id}`}
          name="minProofTier"
          className="cn-input"
          value={tier}
          onChange={(e) => setTier(e.target.value as ProofTier)}
        >
          {PROOF_TIERS.map((t) => (
            <option key={t} value={t} disabled={t === "PHOTO" && !photoReady}>
              {TIER_COPY[t].label}
              {t === "PHOTO" && !photoReady ? " (not switched on yet)" : ""}
            </option>
          ))}
        </select>
        {/* Both halves, always. A brand choosing how much evidence to
            demand is making a trade, and showing only the upside of the
            option they are hovering over would be selling it to them. */}
        <p className="cn-label">{TIER_COPY[tier].gives}</p>
        <p className="cn-label cn-warn-note">{TIER_COPY[tier].costs}</p>
      </div>

      {state.ok === false && (
        <p className="cn-err" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="cn-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : state.ok ? "Saved. Save again" : "Save what it awards"}
      </button>
    </form>
  );
}

/** The figure for a fixed award: how much, in rands or in points. */
function FixedForm({ campaign }: { campaign: ConsoleCampaign }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PromoActionState, FormData>(setRule, IDLE);
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const rule = campaign.rule;
  const stored = rule?.unit === "POINTS" ? "POINTS" : "CENTS";
  const [unit, setUnit] = useState<"CENTS" | "POINTS">(stored);
  // Only meaningful while the stored unit and the chosen one agree: a
  // promotion holding 500 cents is not holding 500 points, so switching the
  // select has to stop offering the old number as this one's default.
  const shown = unit !== stored ? "" : unit === "CENTS" ? Number(((rule?.amount ?? 500) / 100).toFixed(2)) : (rule?.amount ?? 50);

  return (
    <form key={`fixed-${rule?.unit}-${rule?.amount}`} action={action} className="cn-form">
      <input type="hidden" name="campaignId" value={campaign.id} />

      <div className="cn-field">
        <label htmlFor={`unit-${campaign.id}`}>Awarded in</label>
        <select
          id={`unit-${campaign.id}`}
          name="unit"
          className="cn-input"
          value={unit}
          onChange={(e) => setUnit(e.target.value as "CENTS" | "POINTS")}
        >
          <option value="CENTS">Rands</option>
          <option value="POINTS">Points</option>
        </select>
        <p className="cn-label">
          {unit === "CENTS"
            ? "A balance in rands, which a shopper can be given back at a till once redemption opens."
            : "A balance in points, which means whatever your programme says it means."}
        </p>
      </div>

      <div className="cn-field">
        <label htmlFor={`amt-${campaign.id}`}>{unit === "CENTS" ? "Rands per scan" : "Points per scan"}</label>
        <input
          id={`amt-${campaign.id}`}
          name="amount"
          className="cn-input"
          type="number"
          min={unit === "CENTS" ? 0.01 : 1}
          step={unit === "CENTS" ? 0.01 : 1}
          defaultValue={shown}
        />
        <p className="cn-label">Every valid scan earns this, whatever was bought.</p>
      </div>

      {state.ok === false && (
        <p className="cn-err" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="cn-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : state.ok ? "Saved. Save again" : "Save what it awards"}
      </button>
    </form>
  );
}

function RuleForm({ campaign, photoReady }: { campaign: ConsoleCampaign; photoReady: boolean }) {
  const rule = campaign.rule;
  const shape = shapeOfRule(rule);

  return (
    <>
      {/* A rule that is none of the three, said before the control that
          fixes it rather than after. Only reachable on a promotion
          configured before this step existed, and the console's job is to
          say so rather than redraw it as the nearest thing and rewrite it
          on the next save. */}
      {rule && !shape && (
        <p className="cn-err" role="alert">
          This promotion awards a share of the basket in {rule.unit === "STAMPS" ? "stamps" : "points"}, which is not
          one of the kinds above and is almost certainly not what was meant: the award is multiplied by what was
          spent, so a R100 basket at {Number(((rule.basisPoints ?? 500) / 100).toFixed(2))}% awards{" "}
          {rule.basisPoints ?? 500} of them. Choose a kind below to replace it.
        </p>
      )}

      <ShapeForm campaign={campaign} />

      {shape === "STAMP_CARD" && (
        <p className="cn-body" style={{ marginTop: 0 }}>
          One stamp for every purchase that checks out. How many stamps fill a card, and what a full card is worth,
          are the next step.
        </p>
      )}
      {shape === "SHARE_OF_SPEND" && <ShareForm campaign={campaign} photoReady={photoReady} />}
      {shape === "FIXED_PER_SCAN" && <FixedForm campaign={campaign} />}
    </>
  );
}

function CardForm({ campaign }: { campaign: ConsoleCampaign }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PromoActionState, FormData>(setCard, IDLE);
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const rule = campaign.rule;

  return (
    <form
      /* Namespaced, and that prefix is load-bearing. This key and the
         ceilings key were both three fields wide, so on a promotion with no
         rule yet they both resolved to "undefined-undefined-undefined": two
         siblings with the same key, which React is explicit it will not
         handle predictably. It fired on every draft promotion. */
      key={`card-${rule?.completesAt}-${campaign.reward?.rewardName}-${campaign.reward?.maxCoupons}`}
      action={action}
      className="cn-form"
    >
      <input type="hidden" name="campaignId" value={campaign.id} />

      <div className="cn-field">
        <label htmlFor={`completes-${campaign.id}`}>Stamps that complete a card</label>
        <input
          id={`completes-${campaign.id}`}
          name="completesAt"
          className="cn-input"
          type="number"
          min={1}
          defaultValue={rule?.completesAt ?? ""}
        />
        <p className="cn-label">
          Buy ten, get the tenth free: put 10 here. Leave it empty and this promotion just adds up, with nothing to
          complete.
        </p>
      </div>

      <div className="cn-field">
        <label htmlFor={`reward-${campaign.id}`}>What they get when a card is full</label>
        <input
          id={`reward-${campaign.id}`}
          name="rewardName"
          className="cn-input"
          type="text"
          maxLength={120}
          placeholder="a free coffee"
          defaultValue={campaign.reward?.rewardName ?? ""}
        />
        {/* Lowercase in both the placeholder and the example, and the
            example is the whole reason. This text is dropped into the middle
            of a sentence on somebody's phone, so a capital typed here reads
            as "and A free coffee is yours". Steering the input is better
            than mangling the output: it keeps "exactly as you type it"
            true. */}
        <p className="cn-label">
          Your customers see this exactly as you type it, in the middle of a sentence: &ldquo;2 more stamps and a
          free coffee is yours.&rdquo; Required as soon as there is a number above.
        </p>
      </div>

      <div className="cn-field">
        <label htmlFor={`maxcoupons-${campaign.id}`}>Most rewards this may ever hand out (optional)</label>
        <input
          id={`maxcoupons-${campaign.id}`}
          name="maxCoupons"
          className="cn-input"
          type="number"
          min={1}
          defaultValue={campaign.reward?.maxCoupons ?? ""}
        />
        <p className="cn-label">
          Once reached, cards stop completing and the stamps stay on the balance rather than vanishing.
        </p>
      </div>

      {state.ok === false && (
        <p className="cn-err" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="cn-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : state.ok ? "Saved. Save again" : "Save the card"}
      </button>
    </form>
  );
}

function LimitsForm({ campaign }: { campaign: ConsoleCampaign }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PromoActionState, FormData>(setLimits, IDLE);
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const rule = campaign.rule;

  return (
    <form
      key={`limits-${rule?.maxTotalAmount}-${rule?.maxPerPersonPerDay}-${rule?.maxScansPerPersonPerDay}`}
      action={action}
      className="cn-form"
    >
      <input type="hidden" name="campaignId" value={campaign.id} />

      <div className="cn-field">
        <label htmlFor={`cap-total-${campaign.id}`}>Total this promotion may ever issue</label>
        <input
          id={`cap-total-${campaign.id}`}
          name="maxTotalAmount"
          className="cn-input"
          type="number"
          min={1}
          defaultValue={rule?.maxTotalAmount ?? ""}
          placeholder="e.g. 500000 for R5,000"
        />
        <p className="cn-label">
          In the promotion&apos;s own unit. Once reached, it stops awarding, but it does not stop existing.
        </p>
      </div>

      <div className="cn-field">
        <label htmlFor={`cap-day-${campaign.id}`}>Most one person can earn in a day</label>
        <input
          id={`cap-day-${campaign.id}`}
          name="maxPerPersonPerDay"
          className="cn-input"
          type="number"
          min={1}
          defaultValue={rule?.maxPerPersonPerDay ?? ""}
        />
        <p className="cn-label">Stops one person collecting all day on a code they worked out how to copy.</p>
      </div>

      <div className="cn-field">
        <label htmlFor={`cap-scans-${campaign.id}`}>Most scans one person can make in a day</label>
        <input
          id={`cap-scans-${campaign.id}`}
          name="maxScansPerPersonPerDay"
          className="cn-input"
          type="number"
          min={1}
          defaultValue={rule?.maxScansPerPersonPerDay ?? ""}
        />
      </div>

      {state.ok === false && (
        <p className="cn-err" role="alert">
          {state.error}
        </p>
      )}
      {/* Said next to the button that clears them, because an empty box
          meaning "no ceiling" is the sort of thing people discover
          afterwards. */}
      <p className="cn-label">A box left empty means no ceiling at all. Saving with them empty removes any you had.</p>
      <button type="submit" className="cn-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : state.ok ? "Saved. Save again" : "Save the ceilings"}
      </button>
    </form>
  );
}

/**
 * The last step: what is about to happen, and the switch.
 *
 * Delete lives here rather than in the list. It is the one action that
 * cannot be undone, and it belongs where somebody is already deliberately
 * working on this one promotion, not one mis-click away in a row of four.
 * Still only on a promotion that is off: the engine refuses a live one, and
 * a button that exists to be refused is worse than one that is not there.
 */
function LiveStep({ campaign, onDeleted }: { campaign: ConsoleCampaign; onDeleted: () => void }) {
  const live = campaign.status === "ACTIVE";
  const rule = campaign.rule;

  return (
    <div className="cn-form">
      {rule && (
        <ul className="cn-notes">
          <li>
            {rule.type === "PERCENT_OF_SPEND"
              ? `Awards ${Number((Number(rule.basisPoints ?? 0) / 100).toFixed(2))}% of every qualifying basket.`
              : `Awards ${rule.amount} per scan.`}
          </li>
          <li>
            {rule.completesAt
              ? campaign.reward
                ? `A card completes at ${rule.completesAt}, earning ${campaign.reward.rewardName}.`
                : `A card completes at ${rule.completesAt} and nothing says what it earns.`
              : "Adds up without completing."}
          </li>
          <li>{rule.maxTotalAmount ? `Stops after issuing ${rule.maxTotalAmount}.` : "No total budget set."}</li>
        </ul>
      )}

      <div className="cn-actions">
        <StatusButton key={`${campaign.status}-${rule ? "ruled" : "bare"}`} campaign={campaign} live={live} solid />
        <DeleteButton campaign={campaign} onDeleted={onDeleted} />
      </div>
    </div>
  );
}

/**
 * The body of whichever step is open.
 *
 * Every step has something to do in it, including the first. `name` used to
 * be the exception and read as a dead end: a step you could open, could not
 * act on, and could not fix a typo from.
 */
export function StepBody({
  campaign,
  step,
  photoReady,
  onDeleted,
}: {
  campaign: ConsoleCampaign;
  step: PromotionStep;
  photoReady: boolean;
  onDeleted: () => void;
}) {
  return (
    <>
      <StepIntro blurb={step.blurb} state={step.state} />
      {step.id === "name" && <NameForm campaign={campaign} />}
      {step.id === "award" && <RuleForm campaign={campaign} photoReady={photoReady} />}
      {step.id === "card" && <CardForm campaign={campaign} />}
      {step.id === "cost" && <LimitsForm campaign={campaign} />}
      {step.id === "live" && <LiveStep campaign={campaign} onDeleted={onDeleted} />}
    </>
  );
}
