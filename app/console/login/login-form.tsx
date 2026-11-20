"use client";

import Link from "next/link";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, type LoginState } from "./actions";

const INITIAL: LoginState = { error: null };

export function StaffLoginForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(signIn, INITIAL);

  // Held in component state, not a hidden input. The second attempt has to
  // send the password again - the server re-verifies it rather than issuing
  // a half-authenticated token - and a password in a hidden field would be
  // sitting in the rendered HTML for anything that can read the DOM.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const awaitingCode = state.secondFactorRequired === true;

  // Where focus goes when an attempt fails. The submit button disables itself
  // while it checks, and a focused element that becomes disabled drops focus
  // to the page body, so a keyboard or screen reader user was left with
  // nothing selected and had to start tabbing again. The message is announced
  // already (it is an alert); this puts them back where they can retry.
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // The action sets the cookie; navigating is this component's job. refresh
    // first so the destination renders against the new session rather than a
    // cached signed-out view - the same reason the shopper login does it.
    if (state === INITIAL) return;
    if (state.error) (awaitingCode ? codeRef : passwordRef).current?.focus();
    if (state.ok) {
      router.replace("/");
      router.refresh();
    }
  }, [state, router, awaitingCode]);

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
          autoFocus={!awaitingCode}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={awaitingCode}
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
          ref={passwordRef}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          readOnly={awaitingCode}
        />
      </div>

      {awaitingCode && (
        <div className="cn-field">
          <label htmlFor="code">Code from your authenticator app</label>
          <input
            id="code"
            name="code"
            className="cn-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            required
            ref={codeRef}
            autoFocus
          />
          <p className="cn-label" style={{ marginTop: 6 }}>
            Lost your phone? Type one of your recovery codes instead.
          </p>
        </div>
      )}

      {state.error && (
        <p className="cn-err" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="cn-btn" disabled={pending}>
        {pending ? "Checking…" : awaitingCode ? "Confirm code" : "Sign in"}
      </button>

      {/* Hidden once they are past the password and onto the second factor:
          at that point they have proved they know it, and a reset link would
          be an invitation to route around the second factor rather than use
          it. */}
      {!awaitingCode && (
        <Link className="cn-quiet-link" href="/forgot">
          Forgotten your password?
        </Link>
      )}
    </form>
  );
}
