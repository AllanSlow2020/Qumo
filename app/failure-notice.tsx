"use client";

/**
 * What a shopper sees when a page could not be rendered.
 *
 * Deliberately self-contained: its own markup, its own styles, no imports
 * beyond React, and nothing that reads a cookie, a header or the database.
 * Every dependency this had would be a dependency that can be the reason it
 * is being shown, and an error page that fails is how a server error becomes
 * a blank screen.
 *
 * That rules out the brand, which is the awkward part. This surface is
 * supposed to be the brand's and this one page cannot be, because resolving
 * which brand a host belongs to is a database query and the database is the
 * most likely thing to have just failed. So it is unbranded and says almost
 * nothing, rather than branded and occasionally recursive.
 *
 * ── What it does not say ─────────────────────────────────────────────────
 *
 * Not the error message. Next passes a digest rather than the text for
 * exactly this reason, and the text is written by whatever threw: a driver
 * naming a database host, a provider quoting a phone number. The digest is
 * shown instead, because it appears in the server log beside the real cause
 * and turns "it broke" into a line somebody can find.
 */

export function FailureNotice({ digest, onRetry }: { digest?: string; onRetry?: () => void }) {
  return (
    <div className="fn">
      <style>{CSS}</style>
      <div className="fn-card">
        <h1 className="fn-title">Something went wrong at our end</h1>
        <p className="fn-body">
          This is not something you did. Nothing you have earned has been
          affected, and your balance is safe.
        </p>
        <p className="fn-body">Try again in a moment.</p>
        {onRetry ? (
          <button type="button" className="fn-btn" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        {digest ? (
          <p className="fn-ref">
            If it keeps happening, quote this: <code>{digest}</code>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Inline rather than a stylesheet, for the same reason as everything else
 * here: a stylesheet is a request that can fail, and this page exists for
 * the moments when things are failing. Both themes are covered by the media
 * query and by the attribute the root layout stamps, so this matches the
 * rest of the site whichever way the reader has it set.
 */
const CSS = `
.fn {
  --fn-bg: #ffffff;
  --fn-ink: #16181d;
  --fn-muted: #5c6270;
  --fn-line: #e3e5ea;
  --fn-btn: #16181d;
  --fn-btn-ink: #ffffff;
  background: var(--fn-bg);
  color: var(--fn-ink);
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  font-family: var(--font-display), ui-sans-serif, system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  .fn:not([data-theme="light"] .fn) {
    --fn-bg: #101216;
    --fn-ink: #f2f3f5;
    --fn-muted: #9aa1af;
    --fn-line: #2a2e37;
    --fn-btn: #f2f3f5;
    --fn-btn-ink: #101216;
  }
}
[data-theme="dark"] .fn {
  --fn-bg: #101216;
  --fn-ink: #f2f3f5;
  --fn-muted: #9aa1af;
  --fn-line: #2a2e37;
  --fn-btn: #f2f3f5;
  --fn-btn-ink: #101216;
}
.fn-card { width: 100%; max-width: 26rem; }
.fn-title { font-size: 1.35rem; line-height: 1.3; margin: 0 0 12px; font-weight: 600; }
.fn-body { font-size: 0.95rem; line-height: 1.55; color: var(--fn-muted); margin: 0 0 10px; }
.fn-btn {
  margin-top: 12px;
  padding: 11px 18px;
  border: 0;
  border-radius: 10px;
  background: var(--fn-btn);
  color: var(--fn-btn-ink);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.fn-ref {
  margin: 20px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--fn-line);
  font-size: 0.8rem;
  color: var(--fn-muted);
}
.fn-ref code { font-family: var(--font-mono), ui-monospace, monospace; }
`;
