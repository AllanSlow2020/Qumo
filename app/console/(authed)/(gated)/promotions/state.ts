/**
 * Action results for the promotions screen.
 *
 * Its own module, not actions.ts: a "use server" file may only export async
 * functions, and exporting a constant from one builds and lints cleanly then
 * throws in the browser at render time. Learned the hard way on the stores
 * screen.
 */
export type PromoActionState = { ok: true } | { ok: false; error: string } | { ok: null };

export const IDLE: PromoActionState = { ok: null };
