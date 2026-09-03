/**
 * A separate file from actions.ts because a `"use server"` module may only
 * export async functions — a type or a constant beside them compiles, lints,
 * and throws in the browser at render time. That is a mistake this codebase
 * has already made once.
 */
export type SecurityState =
  | { step: "idle"; error: string | null }
  /** A secret has been minted and is waiting for a code to prove it works. */
  | { step: "confirm"; secret: string; otpauth: string; error: string | null }
  /** Shown exactly once. Reloading the page will not bring them back. */
  | { step: "codes"; codes: string[]; error: string | null }
  | { step: "done"; error: string | null };

export const IDLE: SecurityState = { step: "idle", error: null };
