"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createCampaign } from "./actions";
import { IDLE, type PromoActionState } from "./state";

export function CreateCampaignForm({ onCreated }: { onCreated: (id: string) => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PromoActionState, FormData>(createCampaign, IDLE);
  const formRef = useRef<HTMLFormElement>(null);

  /*
   * Opens the promotion it just made, so the flow carries on into step two
   * rather than leaving somebody on step one with their new promotion in
   * the list below and no obvious way forward.
   *
   * The id comes back on the action's own result. Reading it off the
   * refreshed list instead would mean guessing which row is new, and "the
   * most recent" is a guess that breaks the moment two people are working.
   */
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
      if (state.id) onCreated(state.id);
    }
  }, [state, router, onCreated]);

  return (
    <form ref={formRef} action={action} className="cn-form">
      <div className="cn-field">
        <label htmlFor="promo-name">Name</label>
        <input id="promo-name" name="name" className="cn-input" required maxLength={120} placeholder="5% back" />
        <p className="cn-label">
          For your own reference. Shoppers see what it awards, not what you called it.
        </p>
      </div>

      <div className="cn-field">
        <label htmlFor="promo-description">Note (optional)</label>
        <input id="promo-description" name="description" className="cn-input" maxLength={500} />
      </div>

      {state.ok === false && (
        <p className="cn-err" role="alert">
          {state.error}
        </p>
      )}

      {/* Said before the button rather than discovered after it. */}
      <p className="cn-label">
        It starts switched off. Decide what it awards and what it may cost, then switch it on.
      </p>

      <button type="submit" className="cn-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Creating…" : "Create promotion"}
      </button>
    </form>
  );
}
