"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The setup flow in a panel that slides in from the right.
 *
 * ── Why a <dialog> and not a positioned div ──────────────────────────────
 *
 * The same argument the delete confirmation makes. The element moves focus
 * in and traps it, closes on Escape, makes the page behind inert, and
 * gives a backdrop, all of which would otherwise be a few hundred lines of
 * ours done worse. A drawer that can be tabbed out of, into a list it is
 * covering, is a drawer that loses people.
 *
 * The cost is that the list behind it is visible but not clickable, so you
 * cannot open a second promotion without closing this one. That is the
 * trade being evaluated: visible-but-inert is still a long way better than
 * scrolled off the top, which is what the stacked layout does.
 *
 * ── Why the animation is in CSS and not here ─────────────────────────────
 *
 * An exit animation needs the element to stay in the tree while it plays,
 * which in JavaScript means tracking a third state between open and
 * closed. `transition-behavior: allow-discrete` lets the browser do it:
 * see .cn-drawer in console.css. Nothing here knows the panel moves.
 */
export function SetupDrawer({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Names the drawer for a screen reader, since its heading is inside. */
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // showModal() is the only way to get the backdrop, the focus trap and the
  // inert page. Driven from an effect rather than from the click that set
  // `open`, so the element and the state stay in agreement across a
  // re-render.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="cn-drawer"
      aria-label={label}
      /* Fires for Escape and close() alike, so state cannot claim the
         drawer is open after the browser has shut it. */
      onClose={onClose}
      /* A click on the backdrop lands on the dialog element itself; a click
         on anything inside lands on a child. */
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {/* Its own scroll container, so the panel stays put and only the
          flow inside moves. */}
      <div className="cn-drawer-body">{children}</div>
    </dialog>
  );
}
