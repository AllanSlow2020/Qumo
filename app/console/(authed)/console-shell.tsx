"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The console's frame, and the drawer the side column becomes on a phone.
 *
 * Server data stays on the server: the mark, the navigation and the
 * signed-in footer arrive as `side`, and the theme toggle and sign-out as
 * `controls`. This component owns one thing, which is whether the column is
 * open, and that is the only reason it is a client component.
 *
 * ── Why a drawer and not a wrap ──────────────────────────────────────────
 *
 * The column wrapped above the content first, which worked and cost 790px
 * of navigation before the first number on the page: a phone opened on
 * Performance showed no performance. Compacting it to pills got that to
 * 468px, still most of a screen spent on somewhere you already are.
 *
 * The trade is that this needs JavaScript, where a wrap did not. Acceptable
 * here and nowhere else: the console is behind a login and already ships
 * React, and the shopper surface - which is opened once, by somebody at a
 * till, on whatever phone they have - has no drawer anywhere in it.
 */
export function ConsoleShell({
  side,
  controls,
  children,
}: {
  side: React.ReactNode;
  controls: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Escape, because every other panel on the web closes on it and one
    // that does not reads as stuck rather than as different.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    // Focus moves into the panel, or the first thing Tab reaches is behind
    // the overlay, which is the version of this that passes a screenshot
    // and fails a keyboard.
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();

    // The page behind must not scroll under an open drawer.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="cn-shell" data-open={open ? "" : undefined}>
      {/* Rendered only when open, not hidden when closed.
          `hidden` is an attribute and `display` is a declaration, so the
          media query that gives this a display value beats it: with
          `hidden` it sat invisible over the whole phone screen and ate
          every tap on the page beneath. The same trap caught the age-gate
          fields, where `.sc-field { display: flex }` beat `hidden` the
          same way. Not rendering it cannot be overridden by a stylesheet. */}
      {open && (
        <button
          type="button"
          className="cn-scrim"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Closed on the tap rather than on arrival. The navigation is
          server-rendered and passed in, so there is no handler to hang on
          each link; one listener on the container catches any of them, and
          it fires immediately instead of waiting for the next page - which
          is the difference between a drawer that feels answered and one
          that looks stuck while a route loads. */}
      <div
        className="cn-side"
        id="cn-side"
        ref={panel}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        {side}
      </div>

      <div className="cn-col">
        <header className="cn-topbar">
          <button
            type="button"
            ref={trigger}
            className="cn-burger"
            aria-expanded={open}
            aria-controls="cn-side"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M4 4l10 10M14 4L4 14" /> : <path d="M2.5 5h13M2.5 9h13M2.5 13h13" />}
            </svg>
          </button>
          {controls}
        </header>
        <main className="cn-main">{children}</main>
      </div>
    </div>
  );
}
