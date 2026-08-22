"use client";

import { useState } from "react";

/**
 * A signing secret, on screen for the only time it will ever be on screen.
 *
 * Only the ciphertext is stored, so this is genuinely the last chance to
 * copy it — which is why the panel is loud, says so in plain words, and
 * makes copying a single click rather than a careful drag across 64
 * characters of hex.
 *
 * It is not persisted anywhere in the page: no URL, no query parameter, no
 * localStorage. It lives in the action's return value and in this
 * component's props until the screen is left.
 */
export function SecretCallout({ secret, storeCode }: { secret: string; storeCode: string | null }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="cn-secret">
      <p className="cn-h2">
        Signing secret{storeCode ? ` for ${storeCode}` : ""} — copy it now
      </p>
      <p className="cn-body">
        This is the only time it will be shown. We store it encrypted and can&apos;t read it back to you, so if it
        gets lost the fix is to issue a new one.
      </p>
      {/* Selectable and monospaced: half the people who need this will copy
          it by eye into a POS configuration screen, and 0/O and 1/l matter. */}
      <code className="cn-secret-value">{secret}</code>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="cn-btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(secret);
              setCopied(true);
            } catch {
              // Clipboard access needs a secure context and can be refused
              // outright. Saying so beats a button that silently does
              // nothing — the value is right there to select by hand.
              setCopied(false);
              alert("Couldn't copy automatically. Select the value above and copy it.");
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="cn-label">
        Give this to whoever configures your point of sale. It signs the code printed on each slip, which is what
        proves the slip came from your till and not from a shopper&apos;s imagination.
      </p>
    </div>
  );
}
