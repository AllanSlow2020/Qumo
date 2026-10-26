/** Separate from actions.ts: a "use server" file may only export async functions. */
export type AgeFormState =
  | { ok: null }
  /** Where to go next. The client navigates - see actions.ts. */
  | { ok: true; next: string }
  | { ok: false; error: string; blocked?: true };

export const IDLE: AgeFormState = { ok: null };
