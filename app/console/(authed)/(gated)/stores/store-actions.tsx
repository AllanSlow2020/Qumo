"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disableSigning, rotateSecret, setActive } from "./actions";
import { IDLE, type StoreActionState } from "./state";
import { SecretCallout } from "./secret-callout";

type Store = { id: string; code: string; isSigned: boolean; isActive: boolean };

/**
 * The per-store controls.
 *
 * Plain useTransition rather than three useActionState hooks: these are
 * commands, not forms, and the only one with a result worth rendering is a
 * rotation. Calling the server actions directly with an explicit idle state
 * keeps them usable from both here and a real <form>.
 */
export function StoreActions({ store }: { store: Store }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmingRotate, setConfirmingRotate] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(fn: (prev: StoreActionState, fd: FormData) => Promise<StoreActionState>, fields: Record<string, string>) {
    setError(null);
    start(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const result = await fn(IDLE, fd);
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      if (result.ok === true && result.secret) {
        setSecret(result.secret);
      }
      setConfirmingRotate(false);
      router.refresh();
    });
  }

  if (secret) {
    return <SecretCallout secret={secret} storeCode={store.code} />;
  }

  if (confirmingRotate) {
    return (
      <div className="cn-confirm">
        {/* The consequence, before the click rather than after it. A slip in
            a shopper's pocket was signed with the old secret and stops
            verifying the moment this lands — they would be told their slip
            couldn't be verified, with no idea why. */}
        <p className="cn-body">
          {store.isSigned
            ? "Slips already printed at this till stop working immediately — anyone holding one can't earn from it. Do this when the till is quiet, and have your point of sale updated with the new secret before it reopens."
            : "This turns signing on and issues a secret. Slips printed before your point of sale is updated will still be accepted as unsigned."}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="cn-btn"
            disabled={pending}
            onClick={() => run(rotateSecret, { storeId: store.id, storeCode: store.code })}
          >
            {pending ? "Issuing…" : store.isSigned ? "Yes, issue a new secret" : "Turn signing on"}
          </button>
          <button type="button" className="cn-btn cn-btn-quiet" onClick={() => setConfirmingRotate(false)}>
            Cancel
          </button>
        </div>
        {error && <p className="cn-err">{error}</p>}
      </div>
    );
  }

  return (
    <div className="cn-actions">
      <button type="button" className="cn-btn cn-btn-quiet" disabled={pending} onClick={() => setConfirmingRotate(true)}>
        {store.isSigned ? "New secret" : "Turn on signing"}
      </button>

      {store.isSigned && (
        <button
          type="button"
          className="cn-btn cn-btn-quiet"
          disabled={pending}
          onClick={() => run(disableSigning, { storeId: store.id })}
        >
          Turn off signing
        </button>
      )}

      <button
        type="button"
        className="cn-btn cn-btn-quiet"
        disabled={pending}
        onClick={() => run(setActive, { storeId: store.id, isActive: String(!store.isActive) })}
      >
        {store.isActive ? "Stop accepting" : "Start accepting"}
      </button>

      {error && <p className="cn-err">{error}</p>}
    </div>
  );
}
