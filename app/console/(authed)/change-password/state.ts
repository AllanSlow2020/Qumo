export type PasswordState = { ok: true } | { ok: false; error: string } | { ok: null };
export const IDLE: PasswordState = { ok: null };
