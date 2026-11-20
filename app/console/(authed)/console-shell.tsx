"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NavPendingContext } from "./nav-pending";

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
  brandColour,
  side,
  controls,
  children,
}: {
  /** A validated #rrggbb, or null. Set as --cn-brand for the few places that use it. */
  brandColour?: string | null;
  side: React.ReactNode;
  controls: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  /*
   * Where the last click was headed, and where the console was when it was
   * clicked. The second half is what clears it: once the pathname is no
   * longer the one the click started from, the navigation has landed (or
   * been redirected somewhere else) and there is nothing pending, with no
   * effect needed to notice. See nav-pending.tsx for why this exists.
   */
  const pathname = usePathname();
  const [target, setTarget] = useState<{ href: string; from: string } | null>(null);
  const pending = target && target.from === pathname && target.href !== pathname ? target.href : null;

  /*
   * Caught on the container, once, rather than on each link. Every link in
   * the console is covered this way - the sidebar, the buttons on the
   * overview that lead somewhere, the links in a sentence - without a client
   * wrapper around each of them, and the navigation is server-rendered and
   * passed in, so there is nowhere else to hang a handler.
   *
   * Plain left clicks only. A modified click opens a tab and a download or
   * `_blank` link leaves the page: none of them is this page going anywhere.
   * Same-path links (an anchor, a changed filter) are left out because the
   * pathname would never change to clear them.
   */
  function onClickCapture(e: React.MouseEvent) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest("a");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname === pathname) return;
    const next = { href: url.pathname, from: pathname };
    setTarget(next);
    // A navigation that never lands (offline, an error) must not leave the
    // bar crawling for ever.
    window.setTimeout(() => setTarget((t) => (t === next ? null : t)), 15_000);
  }

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
    <NavPendingContext.Provider value={pending}>
    <div
      className="cn-shell"
      data-open={open ? "" : undefined}
      onClickCapture={onClickCapture}
      style={brandColour ? ({ "--cn-brand": brandColour } as React.CSSProperties) : undefined}
    >
      {/* Hidden from assistive tech on purpose: it repeats what the
          navigation itself announces, and the page announces when it lands.
          Keyed by destination so a second click restarts it. */}
      {pending && <div key={pending} className="cn-progress" aria-hidden="true" />}

      {/* The first thing a keyboard reaches, so the sidebar can be stepped
          over. Without it every page costs sixteen Tab presses before the
          page itself, every time. Visible only while it has focus. */}
      <a href="#cn-main" className="cn-skip">
        Skip to content
      </a>

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
      {/* An aside, so the mark, the navigation and the signed-in footer are
          inside a landmark rather than loose on the page. */}
      <aside
        className="cn-side"
        id="cn-side"
        aria-label="Console menu"
        ref={panel}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        {side}
      </aside>

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
        <main className="cn-main" id="cn-main" tabIndex={-1} aria-busy={pending ? true : undefined}>
          {children}
        </main>
      </div>
    </div>
    </NavPendingContext.Provider>
  );
}
