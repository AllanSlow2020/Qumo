"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelProgramme, resumeProgramme } from "./actions";
import type { BillingActionState } from "./state";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Ending a programme, and bringing it back.
 *
 * The confirmation is not ceremony. Cancelling stops every shopper earning
 * the moment it lands and starts a clock on balances they have already been
 * promised - so the screen says both halves, with the actual date, before
 * anybody clicks.
 */
export function ProgrammeControls({
  canEarn,
  status,
  honourUntil,
  prospectiveUntil,
}: {
  canEarn: boolean;
  status: string;
  honourUntil: string | null;
  /** The date the window would run to if they cancelled right now. */
  prospectiveUntil: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const honourDate = honourUntil ? formatDate(new Date(honourUntil)) : null;

  function run(fn: () => Promise<BillingActionState>) {
    setError(null);
    start(async () => {
      const result = await fn();
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  if (!canEarn) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p className="cn-body">
          {status === "CLOSED"
            ? "This programme is closed. Shoppers can't earn and can no longer spend what they had, though nothing was deleted, so restarting brings every balance back exactly as it was."
            : `Earning has stopped. Shoppers can still spend what they'd already earned until ${honourDate}.`}
        </p>
        <button type="button" className="cn-btn" disabled={pending} onClick={() => run(resumeProgramme)}>
          {pending ? "Restarting…" : "Restart the programme"}
        </button>
        {error && <p className="cn-err">{error}</p>}
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="cn-confirm">
        {/* Deliberately not a restatement of the paragraph above it - that
            explains the rule, and a confirmation that repeats the rule is
            read as boilerplate and clicked through. This says what happens
            to this brand, today, with the date on it. */}
        <p className="cn-body">
          Earning stops for every shopper as soon as you click. Balances stay spendable until{" "}
          <strong>{formatDate(new Date(prospectiveUntil))}</strong>, then close.
        </p>
        <p className="cn-body">Nothing is deleted, so restarting brings every balance back exactly as it was.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="cn-btn" disabled={pending} onClick={() => run(cancelProgramme)}>
            {pending ? "Ending…" : "Yes, end the programme"}
          </button>
          <button type="button" className="cn-btn cn-btn-quiet" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
        {error && <p className="cn-err">{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button
        type="button"
        className="cn-btn cn-btn-quiet"
        style={{ alignSelf: "flex-start" }}
        onClick={() => setConfirming(true)}
      >
        End the programme
      </button>
      {error && <p className="cn-err">{error}</p>}
    </div>
  );
}
