"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, type LoginState } from "./actions";

const INITIAL: LoginState = { error: null };

export function StaffLoginForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(signIn, INITIAL);

  useEffect(() => {
    // The action sets the cookie; navigating is this component's job. refresh
    // first so the destination renders against the new session rather than a
    // cached signed-out view — the same reason the shopper login does it.
    if (state === INITIAL) return;
    if (state.error === null) {
      router.replace("/");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="cn-form">
      <div className="cn-field">
        <label htmlFor="email">Work email</label>
        <input
          id="email"
          name="email"
          className="cn-input"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </div>

      <div className="cn-field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          className="cn-input"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error && (
        <p className="cn-err" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="cn-btn" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
