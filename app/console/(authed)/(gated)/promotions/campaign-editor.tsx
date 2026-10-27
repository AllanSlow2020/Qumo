"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConsoleCampaign } from "@/lib/campaigns/manage";
import type { PromotionStep } from "@/lib/console/promotion-steps";
import { deleteCampaign, setCard, setLimits, setRule } from "./actions";
import { StatusButton } from "./status-button";
import { IDLE, type PromoActionState } from "./state";

/**
 * Deleting a promotion, behind a dialogue that has to be answered.
 *
 * A real <dialog> rather than the inline confirm used for rotating a store
 * secret, and the difference is deliberate: rotating a secret is a thing
 * that can be done again, while this cannot. The element earns its keep -
 * focus moves into it and is trapped there, Escape cancels, and the page
 * behind it is inert - all of which would otherwise be a few hundred lines
 * of our own, done worse.
 *
 * The engine's refusal is rendered inside the dialogue rather than closing
 * it, because that refusal is the most useful sentence on the screen: it
 * names what the promotion is still holding and tells them to pause it
 * instead. Closing the dialogue to show it somewhere else would be hiding
 * the answer to the question they just asked.
 */
function DeleteButton({ campaign, onDeleted }: { campaign: ConsoleCampaign; onDeleted: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<PromoActionState, FormData>(deleteCampaign, IDLE);

  // showModal() is the only way to get the backdrop, the focus trap and the
  // inert page; the `open` attribute alone gives a non-modal dialog that
  // does none of it. Calling it from an effect rather than from the click
  // keeps the element and the state in agreement after a re-render.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (state.ok) {
      // Order matters: the rail has to stop pointing at this promotion
      // before the refresh removes it from the list, or it spends a render
      // editing a row that no longer exists.
      onDeleted();
      router.refresh();
    }
  }, [state, router, onDeleted]);

  return (
    <>
      <button type="button" className="cn-btn cn-btn-quiet cn-btn-danger" onClick={() => setOpen(true)}>
        Delete
      </button>

      <dialog
        ref={ref}
        className="cn-dialog"
        aria-labelledby={`del-h-${campaign.id}`}
        /* Fires for Escape and for close() alike, so the state cannot end up
           claiming a dialogue is open after the browser has shut it. */
        onClose={() => setOpen(false)}
        /* Clicking the backdrop lands on the dialog element itself; a click
           on anything inside it lands on a child. Cancelling on the former
           is the behaviour people expect from a modal, and the one the
           element does not give for free. */
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false);
        }}
      >
        <div className="cn-dialog-body">
          <h2 className="cn-h2" id={`del-h-${campaign.id}`}>
            Delete &ldquo;{campaign.name}&rdquo;?
          </h2>
          <p className="cn-body">
            This removes the promotion, what it awards and its ceilings. It can&apos;t be undone.
          </p>
          <p className="cn-label">
            A promotion that has already awarded anything, issued a reward or had pack codes printed can&apos;t be
            deleted. Pause that one instead.
          </p>

          {state.ok === false && (
            <p className="cn-err" role="alert">
              {state.error}
            </p>
          )}

          <div className="cn-dialog-actions">
            <button type="button" className="cn-btn cn-btn-quiet" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </button>
            <form action={action}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <button type="submit" className="cn-btn cn-btn-danger-solid" disabled={pending}>
                {pending ? "Deleting…" : "Delete promotion"}
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}

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

function RuleForm({ campaign }: { campaign: ConsoleCampaign }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PromoActionState, FormData>(setRule, IDLE);
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const rule = campaign.rule;
  const unit = rule?.unit ?? "CENTS";

  return (
    <form
      key={`rule-${rule?.type}-${rule?.unit}-${rule?.amount}-${rule?.basisPoints}-${rule?.minSpendCents}`}
      action={action}
      className="cn-form"
    >
      <input type="hidden" name="campaignId" value={campaign.id} />

      <div className="cn-field">
        <label htmlFor={`type-${campaign.id}`}>Kind</label>
        <select id={`type-${campaign.id}`} name="type" className="cn-input" defaultValue={rule?.type ?? "PERCENT_OF_SPEND"}>
          <option value="PERCENT_OF_SPEND">A share of what they spend, needs a till slip</option>
          <option value="FLAT_PER_SCAN">A fixed amount per scan, works on packs and stickers</option>
        </select>
        <p className="cn-label">
          A share of the basket needs a till slip, because only a slip says what was spent. A fixed amount works on
          anything unique: a code under a pack, a sticker on a bottle.
        </p>
      </div>

      <div className="cn-field">
        <label htmlFor={`unit-${campaign.id}`}>Awarded in</label>
        <select id={`unit-${campaign.id}`} name="unit" className="cn-input" defaultValue={unit}>
          <option value="CENTS">Rands, spendable at the till</option>
          <option value="POINTS">Points</option>
          <option value="STAMPS">Stamps, toward a card</option>
        </select>
        <p className="cn-label">Choose stamps if you want a buy-ten-get-one card. The next step sets the card up.</p>
      </div>

      {/* Both sets of fields are always present. The engine reads only the
          ones its rule type needs, and hiding the others behind JavaScript
          would mean a form that behaves differently depending on whether
          the script loaded. */}
      <div className="cn-field">
        <label htmlFor={`bp-${campaign.id}`}>Share of the basket, in basis points</label>
        <input
          id={`bp-${campaign.id}`}
          name="basisPoints"
          className="cn-input"
          type="number"
          min={1}
          max={10000}
          defaultValue={rule?.basisPoints ?? 500}
        />
        <p className="cn-label">500 is 5%. Only used for a share-of-spend promotion.</p>
      </div>

      <div className="cn-field">
        <label htmlFor={`amt-${campaign.id}`}>Fixed amount per scan</label>
        <input
          id={`amt-${campaign.id}`}
          name="amount"
          className="cn-input"
          type="number"
          min={1}
          defaultValue={rule?.amount || 1}
        />
        <p className="cn-label">In the unit above: cents, points or stamps. Only used for a fixed promotion.</p>
      </div>

      <div className="cn-field">
        <label htmlFor={`min-${campaign.id}`}>Minimum basket, in cents (optional)</label>
        <input
          id={`min-${campaign.id}`}
          name="minSpendCents"
          className="cn-input"
          type="number"
          min={0}
          defaultValue={rule?.minSpendCents ?? ""}
        />
        <p className="cn-label">Leave empty to award on any basket, however small.</p>
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
        {!live && <DeleteButton campaign={campaign} onDeleted={onDeleted} />}
      </div>
    </div>
  );
}

/**
 * The body of whichever step is open.
 *
 * `name` on an existing promotion has no form behind it, because there is
 * no rename action. It says what the promotion is called and nothing more,
 * which is honest about a step that is already finished.
 */
export function StepBody({
  campaign,
  step,
  onDeleted,
}: {
  campaign: ConsoleCampaign;
  step: PromotionStep;
  onDeleted: () => void;
}) {
  return (
    <>
      <StepIntro blurb={step.blurb} state={step.state} />
      {step.id === "award" && <RuleForm campaign={campaign} />}
      {step.id === "card" && <CardForm campaign={campaign} />}
      {step.id === "cost" && <LimitsForm campaign={campaign} />}
      {step.id === "live" && <LiveStep campaign={campaign} onDeleted={onDeleted} />}
    </>
  );
}
