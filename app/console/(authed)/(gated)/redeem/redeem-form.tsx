"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { redeemCoupon } from "./actions";
import { IDLE, type RedeemScreenState } from "./state";

/**
 * The one control on the counter screen.
 *
 * ── Why the field clears and refocuses on every verdict ──────────────────
 *
 * This screen is used with a person standing in front of you, and the
 * common case is a queue. Leaving the last code in the box means the next
 * one gets typed onto the end of it, or the same code gets submitted twice
 * because the button is still under the cursor. Clearing and refocusing
 * costs nothing and makes the second shopper the same as the first.
 *
 * The verdict stays on screen while the field empties, deliberately: it is
 * the thing being read out, and it should not vanish the moment somebody
 * starts typing the next code.
 */
export function RedeemForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<RedeemScreenState, FormData>(redeemCoupon, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status === "idle") return;
    formRef.current?.reset();
    inputRef.current?.focus();
    // The list below is server-rendered, so a redemption only shows up in
    // it if the page is told to read it again.
    if (state.status === "taken") router.refresh();
  }, [state, router]);

  return (
    <div className="cn-panel-body">
      <form ref={formRef} action={action} className="cn-form">
        <div className="cn-field">
          <label htmlFor="code">Reward code</label>
          <input
            ref={inputRef}
            id="code"
            name="code"
            className="cn-input cn-mono cn-code-entry"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={24}
            // No placeholder, deliberately. A specimen code in the field
            // reads as a code already entered, and the one place that must
            // never happen is the screen where somebody checks a code
            // against a phone before handing a free coffee over.
            aria-describedby="code-help"
          />
          <p className="cn-label" id="code-help">
            Read it off the shopper&apos;s phone. Case and spaces don&apos;t matter.
          </p>
        </div>

        <button type="submit" className="cn-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "Checking…" : "Take the reward"}
        </button>
      </form>

      {/* aria-live, because the verdict replaces itself in place: without it
          a screen reader announces nothing at all after the first one. */}
      <div aria-live="polite">
        {state.status === "taken" && (
          <div className="cn-verdict cn-verdict-ok">
            <p className="cn-verdict-head">Hand it over</p>
            <p className="cn-verdict-main">{state.rewardName}</p>
            <p className="cn-verdict-sub">
              <span className="cn-mono">{state.code}</span>
              {state.couponName ? ` · ${state.couponName}` : ""} · taken just now, and it won&apos;t work again.
            </p>
          </div>
        )}

        {state.status === "refused" && (
          <div className="cn-verdict cn-verdict-no">
            <p className="cn-verdict-head">{state.headline}</p>
            <p className="cn-verdict-main cn-mono">{state.code}</p>
            <p className="cn-verdict-sub">{state.line}</p>
          </div>
        )}

        {state.status === "error" && (
          <p className="cn-err" role="alert">
            {state.message}
          </p>
        )}
      </div>
    </div>
  );
}
