/**
 * Which shell the promotions editor is wearing.
 *
 * Behind a query parameter so both can run against the same console and
 * the same data, and be compared by using them rather than by looking at
 * a wireframe. "stacked" is what ships; "drawer" is the candidate.
 *
 * Read on the server and passed down as a prop rather than read with
 * useSearchParams in the client. It never changes while somebody is
 * working, so making it a client hook would buy a Suspense boundary and a
 * re-render for a value that is decided before the page is drawn.
 */
export type ConsoleUiMode = "stacked" | "drawer";

/**
 * Anything other than the exact opt-in is the shipped layout.
 *
 * Deliberately not a truthy check on the key's presence: `?ui=` or
 * `?ui=1` naming no mode should land on what ships, not on whichever
 * branch an `if` happens to take.
 */
export function consoleUiMode(raw: string | string[] | undefined): ConsoleUiMode {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim().toLowerCase() === "drawer" ? "drawer" : "stacked";
}
