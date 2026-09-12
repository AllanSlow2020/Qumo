"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "./actions";

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      await requestPasswordReset(formData);
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div>
        {/* Says "if" on purpose. Confirming that the address was found would
            turn this screen into a way to ask which people work where. */}
        <p className="cn-body">
          If there is an account for that address, a link is on its way. It works once and expires in an hour.
        </p>
        <p className="cn-label">Check the spam folder before asking for another one.</p>
        <Link className="cn-btn cn-btn-quiet" href="/login">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={submit} className="cn-form">
      <div className="cn-field">
        <label htmlFor="email">Your email</label>
        <input
          id="email"
          name="email"
          type="email"
          className="cn-input"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <button type="submit" className="cn-btn" disabled={pending}>
        {pending ? "Sending…" : "Email me a link"}
      </button>
      <Link className="cn-btn cn-btn-quiet" href="/login">
        Back to sign in
      </Link>
    </form>
  );
}
