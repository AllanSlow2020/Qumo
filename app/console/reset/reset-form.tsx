"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setNewPassword, type ResetResult } from "./actions";

export function ResetForm({ token }: { token: string }) {
  const [result, setResult] = useState<ResetResult | null>(null);
  const [fields, setFields] = useState({ password: "", confirm: "" });
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => setResult(await setNewPassword(formData)));
  }

  if (result?.ok) {
    return (
      <div>
        <p className="cn-body">
          Done. You have been signed out everywhere else, so sign in again with the new password.
        </p>
        <Link className="cn-btn" href="/login">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={submit} className="cn-form">
      <input type="hidden" name="token" value={token} />
      <div className="cn-field">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          className="cn-input"
          autoComplete="new-password"
          value={fields.password}
          onChange={(e) => setFields((f) => ({ ...f, password: e.target.value }))}
          required
        />
        <p className="cn-label">At least 12 characters.</p>
      </div>
      <div className="cn-field">
        <label htmlFor="confirm">Again</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          className="cn-input"
          autoComplete="new-password"
          value={fields.confirm}
          onChange={(e) => setFields((f) => ({ ...f, confirm: e.target.value }))}
          required
        />
      </div>
      <button type="submit" className="cn-btn" disabled={pending}>
        {pending ? "Saving…" : "Set my password"}
      </button>
      {result && !result.ok && <p className="cn-err">{result.error}</p>}
    </form>
  );
}
