"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { addStore } from "./actions";
import { IDLE, type StoreActionState } from "./state";
import { SecretCallout } from "./secret-callout";

export function AddStoreForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<StoreActionState, FormData>(addStore, IDLE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok === true) {
      formRef.current?.reset();
      // The table above is server-rendered, so it needs telling.
      router.refresh();
    }
  }, [state, router]);

  return (
    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
      {state.ok === true && state.secret && <SecretCallout secret={state.secret} storeCode={state.storeCode} />}

      <form ref={formRef} action={action} className="cn-form">
        <div className="cn-field">
          <label htmlFor="name">Store name</label>
          <input id="name" name="name" className="cn-input" required maxLength={120} placeholder="Sandton City" />
        </div>

        <div className="cn-field">
          <label htmlFor="code">Store code</label>
          <input
            id="code"
            name="code"
            className="cn-input cn-mono"
            required
            maxLength={40}
            pattern="[A-Za-z0-9\-]+"
            placeholder="CL-SANDTON-01"
          />
          {/* Said at the point of naming, because renaming later is not an
              option once it is printing on receipts. */}
          <p className="cn-label">
            Letters, numbers and hyphens. It gets printed into the code on every slip, so pick something you
            won&apos;t want to change.
          </p>
        </div>

        <label className="cn-check">
          <input type="checkbox" name="signed" defaultChecked />
          <span>
            This till can sign its slips
            <span className="cn-label" style={{ display: "block" }}>
              Leave it on unless your point of sale can&apos;t compute a signature. An unsigned store still works, but
              the shopper controls what the slip says.
            </span>
          </span>
        </label>

        {state.ok === false && (
          <p className="cn-err" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="cn-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "Adding…" : "Add store"}
        </button>
      </form>
    </div>
  );
}
