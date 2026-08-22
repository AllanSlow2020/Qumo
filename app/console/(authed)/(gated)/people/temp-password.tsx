"use client";

import { useState } from "react";

/**
 * A one-time password, on screen for the only time it exists in the clear.
 *
 * Same discipline as a store signing secret, with one addition it needs and
 * that does not: this credential is meant to be told to somebody, so the
 * panel says how to hand it over and what happens next. It is a password two
 * people know from the moment it is created, and the only thing that makes
 * that acceptable is that it stops working the first time it is used.
 */
export function TempPassword({ password, email }: { password: string; email: string | null }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="cn-secret">
      <p className="cn-h2">One-time password{email ? ` for ${email}` : ""}</p>
      <p className="cn-body">
        Give this to them however you normally would. It signs them in once, and the console will make them choose
        their own before it shows them anything.
      </p>
      <code className="cn-secret-value">{password}</code>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="cn-btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(password);
              setCopied(true);
            } catch {
              setCopied(false);
              alert("Couldn't copy automatically. Select the value above and copy it.");
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="cn-label">
        We store it encrypted and can&apos;t read it back, so if it gets lost the fix is to reset it again.
      </p>
    </div>
  );
}
