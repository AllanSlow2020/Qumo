"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAgeRestriction } from "./actions";
import { IDLE, type IdentityState } from "./state";

/**
 * The tick box that decides whether shoppers are asked their age.
 *
 * Its own form and its own save, away from the appearance fields. A colour
 * is a preference; this adds a question between a shopper scanning a pack
 * and earning anything, and a brand that turns it off should have done so
 * on purpose rather than as a side effect of changing their tagline.
 */
export function AgeForm({ minimumAge }: { minimumAge: number | null }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<IdentityState, FormData>(saveAgeRestriction, IDLE);
  const [on, setOn] = useState(minimumAge !== null);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="cn-form">
      <label className="cn-check">
        <input type="checkbox" name="ageRestricted" checked={on} onChange={(e) => setOn(e.target.checked)} />
        <span>
          Ask for a date of birth before anyone can earn
          {minimumAge !== null && minimumAge !== 18 ? ` (currently set to ${minimumAge})` : ""}
        </span>
      </label>

      {/* Said before they tick it, not in a help centre afterwards. A brand
          that believes this is identity verification will rely on it for
          something it cannot carry. */}
      <p className="cn-label">
        Shoppers are asked for their date of birth once, after their mobile number and before anything is added to
        their balance. Anyone under 18 is turned away and their code is not used up, so they keep it.
      </p>
      <p className="cn-label">
        Worth being straight about what this is. It records that you asked and that you refused when told no, which
        is what a promotion is expected to do. It is not identity verification: nothing checks the date against a
        document, so somebody determined to get past it can. If you need more than that, tell us, because it is a
        different piece of work.
      </p>
      <p className="cn-label">
        We keep the answer and the date you asked, never the date of birth itself.
      </p>

      {state.ok === false && (
        <p className="cn-err" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="cn-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Saving" : state.ok ? "Saved. Save again" : "Save"}
      </button>
    </form>
  );
}
