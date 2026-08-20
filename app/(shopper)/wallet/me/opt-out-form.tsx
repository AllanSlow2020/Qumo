"use client";

import { useState, useTransition } from "react";
import { toggleOptOut } from "./actions";

/**
 * Opting out asks for confirmation; opting back in does not.
 *
 * Asymmetric on purpose. Rejoining is harmless and instantly reversible, so
 * a dialog there is friction for its own sake. Leaving stops a shopper
 * earning on purchases they are about to make, and the balance staying put
 * is the thing they most need told before they decide — a fear of losing it
 * is the main reason someone hesitates, and it is unfounded.
 */
export function OptOutForm({
  brandId,
  brandName,
  optedOut,
}: {
  brandId: string;
  brandName: string;
  optedOut: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(optOut: boolean) {
    const data = new FormData();
    data.set("brandId", brandId);
    data.set("optOut", String(optOut));
    startTransition(async () => {
      const result = await toggleOptOut(data);
      setError(result.ok ? null : result.error);
      if (result.ok) setConfirming(false);
    });
  }

  if (optedOut) {
    return (
      <div className="sc-tile">
        <p className="sc-label">You&apos;ve opted out. Scans at {brandName} won&apos;t earn anything.</p>
        <button type="button" className="sc-btn" disabled={pending} onClick={() => submit(false)}>
          {pending ? "Working…" : "Start earning again"}
        </button>
        {error && <p className="sc-label">{error}</p>}
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="sc-tile">
        <p className="sc-body">
          Opt out of {brandName}? You&apos;ll stop earning on new scans.{" "}
          <strong>Your balance stays exactly where it is</strong> and comes back if you rejoin.
        </p>
        <button type="button" className="sc-btn" disabled={pending} onClick={() => submit(true)}>
          {pending ? "Working…" : "Yes, opt out"}
        </button>
        <button type="button" className="sc-btn sc-btn-quiet" disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </button>
        {error && <p className="sc-label">{error}</p>}
      </div>
    );
  }

  return (
    <button type="button" className="sc-btn sc-btn-ghost" onClick={() => setConfirming(true)}>
      Opt out of {brandName}
    </button>
  );
}
