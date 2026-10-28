"use client";

import { useSyncExternalStore } from "react";

/** Nothing ever changes, so the subscription never has to call back. */
const noSubscribe = () => () => {};

/**
 * False while rendering on the server and through hydration, true after.
 *
 * For the one thing a component cannot do before hydration: reach for
 * `document`. Both dialogues on the promotions page render through a
 * portal onto the body, and the body does not exist on the server.
 *
 * useSyncExternalStore rather than the usual `useState(false)` plus an
 * effect that sets it true. The two do the same job, but setting state
 * inside an effect schedules a second render of everything below it, and
 * the lint rule that flags it is right to: this is exactly the shape
 * React provides a hook for. The server snapshot is false, the client
 * snapshot is true, so the hydration render matches the server and the
 * first commit after it does not.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}
