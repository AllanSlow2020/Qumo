"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMyAccount } from "./actions";

/**
 * The one control on this page that cannot be undone.
 *
 * Opting out asks once and offers a way back in the same breath, because it
 * is reversible. This is not, so it asks for something a stray thumb cannot
 * produce: the word DELETE, typed. That is deliberately more friction than
 * a second button, and it is the right amount for the only action here that
 * a person can regret.
 *
 * The confirmation states what survives before it asks, not after. Somebody
 * who reads "your details are gone" and later discovers a row with their
 * scan on it has been misled, even though nothing in that row is theirs any
 * more. It costs two sentences to be straight about it up front.
 */
export function DeleteAccountForm({ productName }: { productName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const armed = typed.trim().toUpperCase() === "DELETE";

  function submit() {
    startTransition(async () => {
      const result = await deleteMyAccount();
      if (result.ok) {
        // Client-side, because a server redirect here resolves against the
        // wrong origin and drops the brand subdomain. Same reason the sign
        // out button does it this way.
        router.replace("/join");
        router.refresh();
        return;
      }
      setError(result.error);
    });
  }

  if (!confirming) {
    return (
      <button type="button" className="sc-btn sc-btn-ghost" onClick={() => setConfirming(true)}>
        Delete my account
      </button>
    );
  }

  return (
    <div className="sc-tile">
      <p className="sc-body">
        <strong>This cannot be undone.</strong> Your mobile number, your name and everything else that identifies you
        is deleted from {productName}, and you are signed out everywhere.
      </p>
      <p className="sc-body">
        Any rewards you have not used are gone with it. Each brand keeps its own record that a reward was earned on a
        date, because that is their financial record, and with your details deleted it is no longer about you.
      </p>
      {/* sc-field, like every other labelled input here: it owns the gap
          between a label and its box, and pairing them by hand put this one
          a few pixels out of step with the login form. */}
      <div className="sc-field">
        <label htmlFor="confirm-delete">Type DELETE to confirm</label>
        <input
          id="confirm-delete"
          className="sc-input"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          // A browser offering to remember what somebody typed to delete
          // their account would be absurd.
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
      </div>
      <button type="button" className="sc-btn" disabled={!armed || pending} onClick={submit}>
        {pending ? "Deleting…" : "Delete my account"}
      </button>
      <button
        type="button"
        className="sc-btn sc-btn-quiet"
        disabled={pending}
        onClick={() => {
          setConfirming(false);
          setTyped("");
          setError(null);
        }}
      >
        Cancel
      </button>
      {error && <p className="sc-label">{error}</p>}
    </div>
  );
}
