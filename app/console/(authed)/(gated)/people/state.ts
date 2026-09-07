/** Action results for the team screen. Separate from actions.ts: a
 *  "use server" file may only export async functions. */
export type TeamActionState =
  | { ok: true; temporaryPassword: string | null; forEmail: string | null }
  | { ok: false; error: string }
  | { ok: null };

export const IDLE: TeamActionState = { ok: null };
