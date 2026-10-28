"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useHydrated } from "@/app/console/use-hydrated";

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
 * ── Why it is portalled to the body ──────────────────────────────────────
 *
 * The same reason the delete dialogue is, and not because this one sits in
 * a list today. showModal() puts an element in the top layer and moving
 * its DOM node takes it back out: it stays open, stops being modal, loses
 * its backdrop and drops into normal flow. Nothing reorders around this
 * drawer at the moment, so it is safe where it is - and "safe where it is"
 * is a property of the tree above it rather than of this component, which
 * means it stops being true the day somebody rearranges the page.
 *
 * Both dialogues render on the body so that nobody has to work out which
 * ones are safe.
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
  // Portal targets exist only in the browser, and the drawer is shut on
  // first paint, so rendering nothing on the server costs nothing.
  const mounted = useHydrated();

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

  const drawer = (
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

  return mounted ? createPortal(drawer, document.body) : null;
}
