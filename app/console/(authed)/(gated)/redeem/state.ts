import type { RedeemRefusal } from "@/lib/coupons/manage";

/**
 * What the counter screen shows after a code is entered.
 *
 * Its own module, not actions.ts: a "use server" file may only export async
 * functions, and exporting a type or a constant from one builds and lints
 * cleanly then throws in the browser at render time.
 *
 * The refusal sentence is composed on the server rather than in the form.
 * It carries a date, and a date formatted in the browser is a date that can
 * disagree with the one rendered on the server.
 */
export type RedeemScreenState =
  | { status: "idle" }
  | { status: "taken"; code: string; rewardName: string; couponName: string | null }
  | { status: "refused"; code: string; reason: RedeemRefusal; headline: string; line: string }
  | { status: "error"; message: string };

export const IDLE: RedeemScreenState = { status: "idle" };
