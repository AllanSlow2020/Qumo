"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/app/console/use-hydrated";
import type { ConsoleCampaign } from "@/lib/campaigns/manage";
import { deleteCampaign } from "./actions";
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
 *
 * ── Why it is on the card as well as in the editor ───────────────────────
 *
 * It used to be only in the editor, on the argument that an action which
 * cannot be undone belongs where somebody is already deliberately working
 * on one promotion rather than one mis-click away in a row of four. The
 * dialogue is what makes the row safe: a mis-click opens a question, and
 * the question is answerable with Escape. What the old arrangement
 * actually cost was the obvious case - a draft nobody finished, which you
 * want to clear out of the list without first opening it.
 *
 * ── Why the dialogue is portalled to the body ────────────────────────────
 *
 * Because this one lives inside a list item, and the list reorders.
 *
 * A modal dialog is put in the top layer by showModal(). Moving its DOM
 * node takes it straight back out again: it keeps the `open` attribute, so
 * it is still showing, but it stops being modal, loses its backdrop, and
 * falls from `position: fixed` back into normal flow - which lands it
 * beside the card that owns it instead of centred on the screen.
 *
 * listCampaignsForConsole sorts live promotions above paused ones above
 * drafts, so changing a status reorders the list. The cards are keyed, so
 * React moves the existing nodes rather than rebuilding them, and any
 * dialogue open inside one of them is moved with it. Measured rather than
 * assumed: moving the card takes :modal from true to false, position from
 * fixed to absolute, and the panel from the centre of the viewport to its
 * card.
 *
 * Rendering it on the body puts it outside everything that reorders, so
 * nothing the list does can reach it. It is the only fix that holds: any
 * version that keeps the element inside the card is one reorder away from
 * the same bug.
 *
 * ── Why a live promotion still gets the button ───────────────────────────
 *
 * The engine refuses to delete a live one, so the button could be hidden
 * for those and shown for the rest. That produces a row of cards where
 * some have three buttons and some have two for reasons nothing on screen
 * explains. It is shown always, and the dialogue says up front that a live
 * promotion has to be paused first, with the confirm disabled. One click
 * to find out, rather than a round trip to the server to be told no.
 */
export function DeleteButton({
  campaign,
  onDeleted,
}: {
  campaign: ConsoleCampaign;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  // The portal target only exists in the browser, and the dialogue is shut
  // on first paint anyway, so rendering nothing on the server costs
  // nothing and avoids reaching for document during SSR.
  const mounted = useHydrated();
  const [state, action, pending] = useActionState<PromoActionState, FormData>(deleteCampaign, IDLE);

  const live = campaign.status === "ACTIVE";

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
      // Order matters: anything pointing at this promotion has to stop
      // before the refresh removes it from the list, or it spends a render
      // editing a row that no longer exists.
      onDeleted();
      router.refresh();
    }
  }, [state, router, onDeleted]);

  const dialog = (
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

        {live ? (
          <p className="cn-body cn-warn-note">
            This promotion is live. Pause it first, then delete it. Deleting something shoppers are
            still earning from would stop it mid-sentence.
          </p>
        ) : (
          <p className="cn-body">
            This removes the promotion, what it awards and its ceilings. It can&apos;t be undone.
          </p>
        )}

        <p className="cn-label">
          A promotion that has already awarded anything, issued a reward or had pack codes printed
          can&apos;t be deleted. Pause that one instead.
        </p>

        {state.ok === false && (
          <p className="cn-err" role="alert">
            {state.error}
          </p>
        )}

        <div className="cn-dialog-actions">
          <button
            type="button"
            className="cn-btn cn-btn-quiet"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            {live ? "Close" : "Cancel"}
          </button>
          <form action={action}>
            <input type="hidden" name="campaignId" value={campaign.id} />
            <button type="submit" className="cn-btn cn-btn-danger-solid" disabled={pending || live}>
              {pending ? "Deleting…" : "Delete promotion"}
            </button>
          </form>
        </div>
      </div>
    </dialog>
  );

  return (
    <>
      <button
        type="button"
        className="cn-btn cn-btn-quiet cn-btn-danger"
        onClick={() => setOpen(true)}
      >
        Delete
      </button>
      {mounted && createPortal(dialog, document.body)}
    </>
  );
}
