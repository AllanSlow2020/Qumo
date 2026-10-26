/** Separate from actions.ts: a "use server" file may only export async functions. */
export type SetupState = { ok: true } | { ok: false; error: string } | { ok: null };
export const IDLE: SetupState = { ok: null };
