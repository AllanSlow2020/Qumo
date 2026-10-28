"use client";

import { useSyncExternalStore } from "react";

/** Nothing ever changes, so the subscription never has to call back. */
const noSubscribe = () => () => {};

/**
 * False while rendering on the server and through hydration, true after.
 *
 * For the one thing a component cannot do before hydration: reach for the
 * document. Both dialogues on the promotions page render through a portal,
 * and there is nothing to portal into on the server.
 *
 * useSyncExternalStore rather than the usual `useState(false)` plus an
 * effect that sets it true. The two do the same job, but setting state
 * inside an effect schedules a second render of everything below it, and
 * the lint rule that flags it is right to: this is exactly the shape React
 * provides a hook for. The server snapshot is false, the client snapshot is
 * true, so the hydration render matches the server and the first commit
 * after it does not.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Where a console dialogue should render, or null while that is not known.
 *
 * ── Why not document.body ────────────────────────────────────────────────
 *
 * Because every colour in this console is a custom property defined on
 * `.cn`, and a custom property is inherited. A dialogue portalled onto the
 * body sits outside that element, so `var(--cn-surface)` resolves to
 * nothing and the panel paints with no background at all: the page behind
 * shows straight through it and the text lands on top of the list. It
 * looks less like a styling slip than like the thing failed to open.
 *
 * That shipped, briefly. It is the hazard of moving an element to fix a
 * layout bug: `position: fixed` escapes its ancestors, but inheritance
 * does not, and a check that only measures geometry will not notice.
 *
 * ── Why `.cn` is the right target ────────────────────────────────────────
 *
 * It satisfies both halves. It is the console's own wrapper, so the tokens
 * resolve and the dark theme follows. And it is above everything that
 * reorders - the promotions list sorts itself by status, which is what
 * knocked an open dialogue out of the top layer in the first place - so
 * nothing the page does underneath can move a dialogue parented here.
 */
export function useConsolePortalTarget(): HTMLElement | null {
  const hydrated = useHydrated();
  // Read during render rather than in an effect, so the dialogue is
  // parented on its first commit instead of a frame later. It is a read of
  // the DOM, not a write, and it only ever runs in the browser.
  return hydrated ? document.querySelector<HTMLElement>(".cn") : null;
}
