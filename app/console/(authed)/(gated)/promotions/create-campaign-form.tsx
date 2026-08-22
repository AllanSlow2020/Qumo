"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createCampaign } from "./actions";
import { IDLE, type PromoActionState } from "./state";

export function CreateCampaignForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<PromoActionState, FormData>(createCampaign, IDLE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={action} className="cn-form cn-panel-body">
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
