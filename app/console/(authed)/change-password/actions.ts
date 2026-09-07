"use server";

import { requireStaff } from "@/lib/staff/current";
import { UserError, changeOwnPassword } from "@/lib/staff/users";
import type { PasswordState } from "./state";

export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const staff = await requireStaff();

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  // Checked here rather than in the engine: it is a property of this form
  // having two boxes, not of what a valid password is.
  if (next !== confirm) {
    return { ok: false, error: "Those two don't match." };
  }

  try {
    // The current session id is passed through so it survives — the other
    // devices are what a password change is meant to sign out.
    await changeOwnPassword(staff.userId, current, next, staff.sessionId);
    return { ok: true };
  } catch (err) {
    if (err instanceof UserError) {
      return { ok: false, error: err.message };
    }
    console.error("[console/change-password]", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
