"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { changePassword } from "./actions";
import { IDLE, type PasswordState } from "./state";

export function PasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, IDLE);

  useEffect(() => {
    if (state.ok) {
      // Straight to the console. The gate in the layout is keyed on
      // mustChangePassword, which the action just cleared, so the refresh is
      // what lets them through.
      router.replace("/");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="cn-form">
      <div className="cn-field">
        <label htmlFor="current">{forced ? "The password you were given" : "Current password"}</label>
        <input id="current" name="current" className="cn-input" type="password" autoComplete="current-password" required />
      </div>

      <div className="cn-field">
        <label htmlFor="next">New password</label>
        <input id="next" name="next" className="cn-input" type="password" autoComplete="new-password" required minLength={12} />
        <p className="cn-label">
          At least 12 characters. A short sentence you&apos;ll remember beats a short jumble you won&apos;t.
        </p>
      </div>

      <div className="cn-field">
        <label htmlFor="confirm">New password again</label>
        <input id="confirm" name="confirm" className="cn-input" type="password" autoComplete="new-password" required />
      </div>

      {state.ok === false && (
        <p className="cn-err" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="cn-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving…" : "Save password"}
      </button>

      <p className="cn-label">
        Saving this signs you out everywhere else. This browser stays signed in.
      </p>
    </form>
  );
}
