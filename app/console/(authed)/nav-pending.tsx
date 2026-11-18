"use client";

import { createContext, useContext } from "react";

/**
 * The path the console is on its way to, or null when it is not going anywhere.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * Every console page is rendered on demand, and a click on a link in the
 * App Router changes nothing on screen until the server has answered. The
 * pathname the navigation reads from only updates when the new page commits,
 * so the sidebar kept highlighting the page you were leaving for exactly as
 * long as the server took, and a slow answer looked like a dead click. On a
 * fast connection that is a beat; on a phone, with a database a few hundred
 * milliseconds away, it is long enough to click the same link twice.
 *
 * The shell works out where a click is headed the moment it happens and
 * provides it here. The nav highlights it straight away, and the progress bar
 * hangs off the same value, so the two cannot disagree about whether anything
 * is happening.
 *
 * ── What was tried and removed ───────────────────────────────────────────
 *
 * A loading.tsx skeleton. It made every navigation about 250ms slower,
 * including the ones that answered in 50ms: React holds the real content back
 * for roughly 300ms after a Suspense fallback has been shown. Do not add one
 * without measuring a fast navigation first; the bar in console.css is the
 * feedback for a slow one.
 *
 * It lives in a context, not a prop, because the nav arrives through a slot
 * the server fills in: the shell cannot hand it anything, but whatever is
 * rendered inside the shell can ask.
 */
export const NavPendingContext = createContext<string | null>(null);

export function useNavPending(): string | null {
  return useContext(NavPendingContext);
}
