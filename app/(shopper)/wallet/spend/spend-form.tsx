"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestSpend } from "./actions";

/**
 * Asking to spend part of a wallet balance. Deliberately small: a shopper
 * is standing at a till with a queue behind them, so this is one number
 * and one button.
 */
export function SpendForm({ brandId, maxRands }: { brandId: string; maxRands: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set("brandId", brandId);
    formData.set("amount", amount);

    const result = await requestSpend(formData);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAmount("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="sc-field">
        <label htmlFor={`amount-${brandId}`}>Spend how much? (max R{maxRands})</label>
        <input
          id={`amount-${brandId}`}
          name="amount"
          className="sc-input"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      {error && <p className="sc-err">{error}</p>}
      <button type="submit" className="sc-btn" disabled={submitting || amount === ""}>
        {submitting ? "Getting your code…" : "Get a code to pay"}
      </button>
    </form>
  );
}
