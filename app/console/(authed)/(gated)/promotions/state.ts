/**
 * Action results for the promotions screen.
 *
 * Its own module, not actions.ts: a "use server" file may only export async
 * functions, and exporting a constant from one builds and lints cleanly then
 * throws in the browser at render time. Learned the hard way on the stores
 * screen.
 */
/**
 * `id` is set only by createCampaign, and only so the stepper can open the
 * promotion it just made. Without it, creating one leaves the flow sitting
 * on step one with the new promotion in the list below and no way to carry
 * on except to go and find it, which defeats the point of a sequence.
 */
export type PromoActionState = { ok: true; id?: string } | { ok: false; error: string } | { ok: null };

export const IDLE: PromoActionState = { ok: null };
