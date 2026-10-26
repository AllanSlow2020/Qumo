"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { confirmAge } from "./actions";
import { IDLE, type AgeFormState } from "./state";

/**
 * Three fields rather than one date input.
 *
 * A native date picker opens on this month and expects you to scroll back
 * to 1987, which on a phone is a dozen flicks and the reason people abandon
 * age gates. Three boxes are typed in about four seconds.
 */
export function AgeForm({ next }: { next: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<AgeFormState, FormData>(confirmAge, IDLE);
  const blocked = state.ok === false && state.blocked === true;

  // The navigation happens here rather than in the action, because a
  // redirect() from a server action is resolved against the server's own
  // origin and loses the brand subdomain. On the client the browser
  // resolves it against the page it is already on. See actions.ts.
  useEffect(() => {
    if (state.ok) router.replace(state.next);
  }, [state, router]);

  return (
    <form action={action} className="sc-agegate">
      <input type="hidden" name="next" value={next} />

      {/* Taken off the screen once the answer is in, rather than left
          greyed out. A disabled form still reads as something you are
          meant to fill in, and the one thing this screen has to be is
          unambiguous about whether there is anything left to do.
          Unmounted rather than given the `hidden` attribute, which
          .sc-field's own `display: flex` silently overrides - the attribute
          was there and the fields stayed on screen. */}
      {!blocked && (
      <div className="sc-field">
        <label htmlFor="day">Date of birth</label>
        <div className="sc-dob">
          {/* inputMode rather than type="number": a numeric keypad without
              the spinner arrows, and without a scroll wheel silently
              changing somebody's year of birth. */}
          <input
            id="day"
            name="day"
            className="sc-input"
            inputMode="numeric"
            autoComplete="bday-day"
            maxLength={2}
            placeholder="DD"
            aria-label="Day"
            required
            disabled={blocked}
          />
          <input
            name="month"
            className="sc-input"
            inputMode="numeric"
            autoComplete="bday-month"
            maxLength={2}
            placeholder="MM"
            aria-label="Month"
            required
            disabled={blocked}
          />
          <input
            name="year"
            className="sc-input sc-dob-year"
            inputMode="numeric"
            autoComplete="bday-year"
            maxLength={4}
            placeholder="YYYY"
            aria-label="Year"
            required
            disabled={blocked}
          />
        </div>
      </div>
      )}

      {state.ok === false && (
        <p className="sc-err" role="alert">
          {state.error}
        </p>
      )}

      {!blocked && (
        <button type="submit" className="sc-btn" disabled={pending || state.ok === true}>
          {pending || state.ok === true ? "Checking" : "Continue"}
        </button>
      )}
    </form>
  );
}
