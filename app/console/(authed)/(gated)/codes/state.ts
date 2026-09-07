/** Separate from actions.ts: a "use server" file may only export async functions. */
export type BatchActionState = { ok: true } | { ok: false; error: string } | { ok: null };
export const IDLE: BatchActionState = { ok: null };
