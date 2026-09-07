"use server";

import { ForbiddenError } from "@/lib/auth/rbac";
import { requireStaff } from "@/lib/staff/current";
import type { StoreActionState } from "./state";
import {
  StoreError,
  createStoreForSession,
  disableStoreSigningForSession,
  rotateStoreSecretForSession,
  setStoreActiveForSession,
} from "@/lib/stores/manage";

/**
 * The console's write path for stores.
 *
 * Every one of these is a thin wrapper: the engine functions already check
 * the role and scope the query to the caller's brand, so the only job here
 * is to turn a staff session into the shape they expect and an exception
 * into something a screen can render.
 *
 * They return state rather than redirecting. The console is a single host so
 * the subdomain problem that bit the shopper surface does not apply, but a
 * rotation returns a secret that must reach the screen exactly once and a
 * URL is the last place that should live.
 */

/** Never leak an internal error message to a screen; log it and say less. */
function toState(err: unknown): StoreActionState {
  if (err instanceof StoreError) {
    return { ok: false, error: err.message };
  }
  if (err instanceof ForbiddenError) {
    return { ok: false, error: "Your role can't change stores. Ask an owner or admin." };
  }
  console.error("[console/stores]", err);
  return { ok: false, error: "Something went wrong. Try again." };
}

/**
 * The session shape the engine wants. Built from the verified staff session
 * every time rather than passed in, so no caller can supply a brandId or a
 * role of their choosing.
 */
async function engineSession() {
  const staff = await requireStaff();
  return { user: { id: staff.userId, brandId: staff.brandId, role: staff.role, name: staff.name, email: staff.email } };
}

export async function addStore(_prev: StoreActionState, formData: FormData): Promise<StoreActionState> {
  try {
    const created = await createStoreForSession(await engineSession(), formData);
    return { ok: true, secret: created.signingSecret, storeCode: created.code };
  } catch (err) {
    // A schema failure is the shopper-facing half of a form, not an
    // exception worth logging as one.
    if (err instanceof Error && err.name === "ZodError") {
      return { ok: false, error: "Check the name and code. Codes use letters, numbers and hyphens only." };
    }
    return toState(err);
  }
}

export async function rotateSecret(_prev: StoreActionState, formData: FormData): Promise<StoreActionState> {
  try {
    const storeId = String(formData.get("storeId") ?? "");
    const secret = await rotateStoreSecretForSession(await engineSession(), storeId);
    return { ok: true, secret, storeCode: String(formData.get("storeCode") ?? "") };
  } catch (err) {
    return toState(err);
  }
}

export async function disableSigning(_prev: StoreActionState, formData: FormData): Promise<StoreActionState> {
  try {
    await disableStoreSigningForSession(await engineSession(), String(formData.get("storeId") ?? ""));
    return { ok: true, secret: null, storeCode: null };
  } catch (err) {
    return toState(err);
  }
}

export async function setActive(_prev: StoreActionState, formData: FormData): Promise<StoreActionState> {
  try {
    await setStoreActiveForSession(
      await engineSession(),
      String(formData.get("storeId") ?? ""),
      formData.get("isActive") === "true",
    );
    return { ok: true, secret: null, storeCode: null };
  } catch (err) {
    return toState(err);
  }
}
