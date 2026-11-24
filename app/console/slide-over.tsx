"use client";

import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useConsolePortalTarget } from "@/app/console/use-hydrated";

/**
 * A panel that slides in over the page, for help and short tasks that should
 * not take somebody off the screen they are on.
 *
 * ── Two sizes, and a sheet ───────────────────────────────────────────────
 *
 * `normal` is 480px. `wide` is 720px but never more than 60% of the window,
 * for the few things that really need the room (a calculator). Below 1100px
 * either one becomes a bottom sheet, the same shape it takes on a phone,
 * because a 720px panel on a 1024px screen covers the page it was opened
 * from and leaves nothing to be "over". The numbers live in console.css under
 * .cn-slide, and tests/console-slide-over.test.ts holds them.
 *
 * The size is read once, when the panel opens, and written straight onto the
 * element. It is not React state, so a parent that re-renders with a
 * different `size` while the panel is open cannot make it resize under
 * somebody's hands. A panel that changes width mid-read is the same fault as
 * a page that jumps.
 *
 * ── Why a <dialog> ───────────────────────────────────────────────────────
 *
 * The same reasons as the setup drawer in the promotions screen: the element
 * moves focus in, traps it, closes on Escape, makes the page behind inert and
 * supplies the backdrop. None of that is worth rewriting, and a panel that
 * can be tabbed out of into the page it covers loses people. It is portalled
 * to the console root for the same reason as the drawer: moving a modal
 * dialog's DOM node takes it out of the top layer.
 *
 * ── Why Close is a button with a word ────────────────────────────────────
 *
 * An X on its own is easy to miss and has no name for a screen reader. The X
 * is decoration; the word is the label. It is 44px tall because it is the one
 * control every panel has and the one most often hit on a phone.
 */
export type SlideOverSize = "normal" | "wide";

export function SlideOver({
  open,
  onClose,
  title,
  kicker,
  size = "normal",
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** The panel's heading, and its accessible name. */
  title: string;
  /** A short line above the heading: "Step 3 of 6". */
  kicker?: string;
  /** Read once, when the panel opens. */
  size?: SlideOverSize;
  /** Buttons pinned to the bottom, outside the scrolling area. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const portal = useConsolePortalTarget();

  // An effect event reads the latest `size` without making the effect below
  // re-run when it changes. That is the point: the width is fixed at the
  // moment of opening.
  const fixSize = useEffectEvent((dialog: HTMLDialogElement) => {
    dialog.dataset.size = size;
  });

  // showModal() is the only way to get the backdrop, the focus trap and the
  // inert page, so it is driven from an effect and the element and the state
  // cannot disagree across a re-render. `portal` is a dependency because the
  // dialog is a different element once it moves under the console root, and
  // one that mounted open must be opened again there.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      fixSize(dialog);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, portal]);

  const panel = (
    <dialog
      ref={ref}
      className="cn-slide"
      aria-labelledby={titleId}
      /* Fires for Escape and close() alike, so state cannot claim the panel
         is open after the browser has shut it. */
      onClose={onClose}
      /* A click on the backdrop lands on the dialog element itself; a click
         on anything inside lands on a child. */
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="cn-slide-body">
        <header className="cn-slide-head">
          <div>
            {kicker && <p className="cn-slide-kicker">{kicker}</p>}
            <h2 id={titleId} className="cn-slide-title">
              {title}
            </h2>
          </div>
          <button type="button" className="cn-btn cn-btn-quiet cn-btn-small cn-slide-close" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M2 2l8 8M10 2L2 10" />
            </svg>
            Close
          </button>
        </header>
        {/* Its own scroll container, so the header and footer stay put and
            only the content moves. */}
        <div className="cn-slide-main">{children}</div>
        {footer && <footer className="cn-slide-foot">{footer}</footer>}
      </div>
    </dialog>
  );

  return portal ? createPortal(panel, portal) : panel;
}
