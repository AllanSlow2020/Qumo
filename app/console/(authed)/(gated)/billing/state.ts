/** Separate from actions.ts: a "use server" file may only export async functions. */
export type BillingActionState = { ok: true } | { ok: false; error: string } | { ok: null };
export const IDLE: BillingActionState = { ok: null };
