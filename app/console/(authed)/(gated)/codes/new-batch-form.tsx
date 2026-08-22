"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBatch } from "./actions";
import { IDLE, type BatchActionState } from "./state";

type Option = { id: string; name: string; canPrint: boolean; status: string };

export function NewBatchForm({ campaigns }: { campaigns: Option[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<BatchActionState, FormData>(createBatch, IDLE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  // Only promotions that award a fixed amount per scan. A share-of-spend
  // rule needs a basket, which a pack code does not carry — the engine
  // refuses those, and offering them here would only be an invitation to
  // read an error message.
  const printable = campaigns.filter((c) => c.canPrint);

  if (printable.length === 0) {
    return (
      <div className="cn-panel-body">
        <p className="cn-body">
          You don&apos;t have a promotion that awards a fixed amount per scan. Pack codes need one: a share-of-spend
          promotion takes its cut from a till slip, and a code on a bottle doesn&apos;t carry a basket. Set one up
          under Promotions first.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="cn-form cn-panel-body">
      <div className="cn-field">
        <label htmlFor="batch-campaign">Promotion</label>
        <select id="batch-campaign" name="campaignId" className="cn-input" required>
          {printable.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.status !== "ACTIVE" ? " (not live yet)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="cn-field">
        <label htmlFor="batch-label">What are you printing?</label>
        <input
          id="batch-label"
          name="label"
          className="cn-input"
          required
          maxLength={120}
          placeholder="Campari 750ml neck tags, March"
        />
        <p className="cn-label">For your own records — it names the download too.</p>
      </div>

      <div className="cn-field">
        <label htmlFor="batch-quantity">How many</label>
        <input
          id="batch-quantity"
          name="quantity"
          className="cn-input"
          type="number"
          min={1}
          max={100000}
          required
          defaultValue={1000}
        />
        {/* The consequence, stated before the click. This is the one action
            in the console with a physical cost attached to it. */}
        <p className="cn-label">
          Every code is single-use and can&apos;t be regenerated once printed. Order what you&apos;ll actually print.
        </p>
      </div>

      {state.ok === false && (
        <p className="cn-err" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="cn-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Generating…" : "Generate codes"}
      </button>
    </form>
  );
}
