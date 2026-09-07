"use server";

import type { Role } from "@prisma/client";
import { ForbiddenError } from "@/lib/auth/rbac";
import { requireStaff } from "@/lib/staff/current";
import {
  UserError,
  inviteUserForSession,
  resetPasswordForSession,
  setUserActiveForSession,
  setUserRoleForSession,
} from "@/lib/staff/users";
import type { TeamActionState } from "./state";

function toState(err: unknown): TeamActionState {
  // UserError messages are written for an owner to read — the last-owner
  // refusal in particular explains a rule nobody would guess.
  if (err instanceof UserError) {
    return { ok: false, error: err.message };
  }
  if (err instanceof ForbiddenError) {
    return { ok: false, error: "Only an owner can manage the team." };
  }
  if (err instanceof Error && err.name === "ZodError") {
    return { ok: false, error: "Check the name and email address." };
  }
  console.error("[console/people]", err);
  return { ok: false, error: "Something went wrong. Try again." };
}

async function engineSession() {
  const staff = await requireStaff();
  return { user: { id: staff.userId, brandId: staff.brandId, role: staff.role, name: staff.name, email: staff.email } };
}

export async function invite(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  try {
    const invited = await inviteUserForSession(await engineSession(), formData);
    return { ok: true, temporaryPassword: invited.temporaryPassword, forEmail: invited.email };
  } catch (err) {
    return toState(err);
  }
}

export async function resetPassword(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  try {
    const temporaryPassword = await resetPasswordForSession(
      await engineSession(),
      String(formData.get("userId") ?? ""),
    );
    return { ok: true, temporaryPassword, forEmail: String(formData.get("email") ?? "") };
  } catch (err) {
    return toState(err);
  }
}

export async function setRole(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  try {
    const role = String(formData.get("role") ?? "") as Role;
    await setUserRoleForSession(await engineSession(), String(formData.get("userId") ?? ""), role);
    return { ok: true, temporaryPassword: null, forEmail: null };
  } catch (err) {
    return toState(err);
  }
}

export async function setActive(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  try {
    await setUserActiveForSession(
      await engineSession(),
      String(formData.get("userId") ?? ""),
      formData.get("isActive") === "true",
    );
    return { ok: true, temporaryPassword: null, forEmail: null };
  } catch (err) {
    return toState(err);
  }
}
