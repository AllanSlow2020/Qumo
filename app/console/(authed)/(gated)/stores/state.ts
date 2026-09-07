/**
 * The shape a store action hands back, and its idle value.
 *
 * Its own module because actions.ts carries "use server", and such a file
 * may only export async functions — exporting a plain object from it builds
 * and lints cleanly and then throws in the browser at render time. Types are
 * erased so they could have stayed, but keeping the pair together is what
 * makes the constraint obvious to the next person.
 */
export type StoreActionState =
  | { ok: true; secret: string | null; storeCode: string | null }
  | { ok: false; error: string }
  | { ok: null };

export const IDLE: StoreActionState = { ok: null };
