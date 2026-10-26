"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConsoleCampaign } from "@/lib/campaigns/manage";
import { deleteCampaign, setCard, setLimits, setRule } from "./actions";
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
 * One promotion's three forms, in the rail beside the list.
 *
 * They used to expand inside the promotion's own card, which worked while
 * there was one form and stopped working at three: opening the editor
 * pushed every promotion below it off the screen, so changing the second of
 * four meant losing sight of the other three entirely. The list is what a
 * brand reads and the editor is what they act with, and a page that makes
 * you give up the first to use the second has the relationship backwards.
 *
 * The three sections are in the order the decision is made in: what a
 * shopper earns, what a card takes and gives, then what it may all cost -
 * which is the order the engine enforces too, refusing to activate a
 * promotion with no rule and a card with no reward.
 */
export function CampaignEditor({ campaign, onDone }: { campaign: ConsoleCampaign; onDone: () => void }) {
  const router = useRouter();
  const [ruleState, ruleAction, rulePending] = useActionState<PromoActionState, FormData>(setRule, IDLE);
  const [limitState, limitAction, limitPending] = useActionState<PromoActionState, FormData>(setLimits, IDLE);
  const [cardState, cardAction, cardPending] = useActionState<PromoActionState, FormData>(setCard, IDLE);

  // Refresh only. The editor deliberately stays open after a save: the
  // offer and its ceilings are forms filled in one after the other, and
  // closing the panel on the first save would hide the second one just as
  // somebody reached for it. The card in the list updates, which is the
  // confirmation that matters - and now that it is a panel of its own,
  // that confirmation is visible while the editor is still open.
  useEffect(() => {
    if (ruleState.ok || limitState.ok || cardState.ok) {
      router.refresh();
    }
  }, [ruleState, limitState, cardState, router]);

  const rule = campaign.rule;
  const unit = rule?.unit ?? "CENTS";

  return (
    <section className="cn-panel">
      <div className="cn-panel-head">
        <div>
          <h2 className="cn-h2">{campaign.name}</h2>
          <p className="cn-label">{rule ? "What it awards, and what it may cost" : "Not awarding anything yet"}</p>
        </div>
        {/* Closes the editor and hands the rail back to New promotion.
            Named for what it does to this panel rather than "Cancel", which
            would suggest the saves above are undone. They are not - each
            form saves on its own. */}
        <button type="button" className="cn-btn cn-btn-quiet" onClick={onDone}>
          Close
        </button>
      </div>

      <div className="cn-panel-body">
      <div className="cn-edit">
        {/* Keyed on the rule that came back from the server.
            defaultValue only applies at mount, so after saving a stamp
            rule these selects still read "share of spend" and "rands" -
            the card above said one thing and the form beneath said
            another, and pressing save again would have quietly replaced
            the stamp card with 5% cash. Remounting re-applies them. */}
        <form
          key={`${rule?.type}-${rule?.unit}-${rule?.amount}-${rule?.basisPoints}-${rule?.minSpendCents}`}
          action={ruleAction}
          className="cn-form"
        >
          <h3 className="cn-h2">What it awards</h3>
          <input type="hidden" name="campaignId" value={campaign.id} />

          <div className="cn-field">
            <label htmlFor={`type-${campaign.id}`}>Kind</label>
            <select
              id={`type-${campaign.id}`}
              name="type"
              className="cn-input"
              defaultValue={rule?.type ?? "PERCENT_OF_SPEND"}
            >
              <option value="PERCENT_OF_SPEND">A share of what they spend, needs a till slip</option>
              <option value="FLAT_PER_SCAN">A fixed amount per scan, works on packs and stickers</option>
            </select>
          </div>

          <div className="cn-field">
            <label htmlFor={`unit-${campaign.id}`}>Awarded in</label>
            <select id={`unit-${campaign.id}`} name="unit" className="cn-input" defaultValue={unit}>
              <option value="CENTS">Rands, spendable at the till</option>
              <option value="POINTS">Points</option>
              <option value="STAMPS">Stamps, toward a card</option>
            </select>
          </div>

          {/* Both sets of fields are always present. The engine reads
              only the ones its rule type needs, and hiding the others
              behind JavaScript would mean a form that behaves
              differently depending on whether the script loaded. */}
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
          </div>

          {ruleState.ok === false && (
            <p className="cn-err" role="alert">
              {ruleState.error}
            </p>
          )}
          <button type="submit" className="cn-btn" disabled={rulePending} style={{ alignSelf: "flex-start" }}>
            {rulePending ? "Saving…" : ruleState.ok ? "Saved. Save again" : "Save what it awards"}
          </button>
        </form>

        {/* Between the offer and the ceilings, because that is the
            order the decision is made in: what they earn, what a card
            takes and gives, then what it may all cost. Keyed on what
            came back from the server for the same reason the other two
            are - defaultValue only applies at mount. */}
        <form
          key={`${rule?.completesAt}-${campaign.reward?.rewardName}-${campaign.reward?.maxCoupons}`}
          action={cardAction}
          className="cn-form"
        >
          <h3 className="cn-h2">The card, and what it earns</h3>
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
              Buy ten, get the tenth free: put 10 here. Leave it empty and this promotion just adds up, with
              nothing to complete.
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
            {/* These are the words the shopper reads, in their wallet
                and on the screen their scan lands on. Said plainly,
                because a brand typing an internal code here would be
                typing it onto somebody's phone. */}
            {/* Lowercase in both the placeholder and the example, and
                the example is the whole reason. This text is dropped
                into the middle of a sentence on somebody's phone, so a
                capital typed here reads as "and A free coffee is
                yours". Steering the input is better than mangling the
                output - it keeps "exactly as you type it" true. */}
            <p className="cn-label">
              Your customers see this exactly as you type it, in the middle of a sentence: &ldquo;2 more stamps
              and a free coffee is yours.&rdquo; Required as soon as there is a number above.
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

          {cardState.ok === false && (
            <p className="cn-err" role="alert">
              {cardState.error}
            </p>
          )}
          <button type="submit" className="cn-btn" disabled={cardPending} style={{ alignSelf: "flex-start" }}>
            {cardPending ? "Saving…" : cardState.ok ? "Saved. Save again" : "Save the card"}
          </button>
        </form>

        <form
          key={`${rule?.maxTotalAmount}-${rule?.maxPerPersonPerDay}-${rule?.maxScansPerPersonPerDay}`}
          action={limitAction}
          className="cn-form"
        >
          <h3 className="cn-h2">What it may cost</h3>
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

          {limitState.ok === false && (
            <p className="cn-err" role="alert">
              {limitState.error}
            </p>
          )}
          {/* Said next to the button that clears them, because an empty
              box meaning "no ceiling" is the sort of thing people
              discover afterwards. */}
          <p className="cn-label">
            A box left empty means no ceiling at all. Saving with them empty removes any you had.
          </p>
          <button type="submit" className="cn-btn" disabled={limitPending} style={{ alignSelf: "flex-start" }}>
            {limitPending ? "Saving…" : limitState.ok ? "Saved. Save again" : "Save the ceilings"}
          </button>
        </form>
      </div>

        {/* Delete lives here rather than in the list. It is the one action
            that cannot be undone, and it belongs where somebody is already
            deliberately working on this one promotion - not one mis-click
            away in a row of four. Still only on a promotion that is off:
            the engine refuses a live one, and a button that exists to be
            refused is worse than one that is not there. */}
        {campaign.status !== "ACTIVE" && (
          <div className="cn-actions cn-actions-end">
            <DeleteButton campaign={campaign} onDeleted={onDone} />
          </div>
        )}
      </div>
    </section>
  );
}
