/**
 * Which shell the promotions editor is wearing.
 *
 * The two ran side by side behind `?ui=` so the choice could be made by
 * using them rather than by looking at a wireframe. The drawer won and is
 * now what everybody gets.
 *
 * `?ui=stacked` is kept, and is not dead code. It is the way back to the
 * previous layout without a deploy, for the week or two in which
 * something about the drawer might turn out to be wrong in front of a
 * real brand. Delete it, and the stacked branch with it, once that stops
 * being a live worry.
 *
 * Read on the server and passed down as a prop rather than read with
 * useSearchParams in the client. It never changes while somebody is
 * working, so making it a client hook would buy a Suspense boundary and a
 * re-render for a value that is decided before the page is drawn.
 */
export type ConsoleUiMode = "stacked" | "drawer";

/**
 * Anything other than the exact opt-out is the drawer.
 *
 * Deliberately not a truthy check on the key's presence: `?ui=` or
 * `?ui=1` naming no mode should land on what ships, not on whichever
 * branch an `if` happens to take. Which way round that cuts changed when
 * the default changed; the rule did not.
 */
export function consoleUiMode(raw: string | string[] | undefined): ConsoleUiMode {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim().toLowerCase() === "stacked" ? "stacked" : "drawer";
}
