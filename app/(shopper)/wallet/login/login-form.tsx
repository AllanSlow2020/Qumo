"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatSaPhoneForDisplay } from "@/lib/consumer/phone";
import { CONSENT_CHECKBOX_LABEL } from "@/lib/consumer/consent";
import { requestCode, submitCode } from "./actions";

/**
 * Two steps in one component: enter a number, then enter the code. Kept
 * together rather than split across two routes so a mistyped number can be
 * corrected without losing the page — "Use a different number" moves back a
 * step instead of navigating.
 */
export function ShopperLoginForm({ destination }: { destination: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [consented, setConsented] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handlePhone(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await requestCode(phone);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSentTo(result.phoneE164 ?? phone);
    setStep("code");
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await submitCode(phone, code, consented);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      setCode("");
      return;
    }
    router.push(destination);
    // The destination reads the session cookie on the server, and that
    // cookie was set inside the action above — refresh so the navigation
    // lands on freshly rendered content rather than a cached logged-out
    // view. It matters most for a scan: /s/<code> awards on render, and a
    // cached logged-out render would bounce straight back to login.
    router.refresh();
  }

  if (step === "phone") {
    return (
      <form onSubmit={handlePhone} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="sc-field">
          <label htmlFor="phone">Mobile number</label>
          <input
            id="phone"
            name="phone"
            className="sc-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="082 123 4567"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        {/* On the first step, not the second: this is a decision, and a
            decision belongs before someone has waited for an SMS. Shown to
            everyone rather than only to new shoppers — asking only new ones
            would reveal which numbers already have an account. */}
        <label className="sc-check">
          <input
            type="checkbox"
            name="consent"
            required
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
          />
          <span>
            {CONSENT_CHECKBOX_LABEL} <Link href="/legal/privacy">Read it</Link>.
          </span>
        </label>

        {error && <p className="sc-err">{error}</p>}

        <button type="submit" className="sc-btn" disabled={submitting || !consented}>
          {submitting ? "Sending…" : "Send me a code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCode} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p className="sc-body">
        We sent a 6-digit code to <strong style={{ color: "var(--sc-ink)" }}>{formatSaPhoneForDisplay(sentTo)}</strong>.
        It expires in 10 minutes.
      </p>

      <div className="sc-field">
        <label htmlFor="code">Your code</label>
        <input
          id="code"
          name="code"
          className="sc-input sc-input-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="000000"
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
        />
      </div>

      {error && <p className="sc-err">{error}</p>}

      <button type="submit" className="sc-btn" disabled={submitting || code.length !== 6}>
        {submitting ? "Checking…" : "Sign in"}
      </button>
      <button
        type="button"
        className="sc-btn sc-btn-quiet"
        onClick={() => {
          setStep("phone");
          setCode("");
          setError(null);
        }}
      >
        Use a different number
      </button>
    </form>
  );
}
