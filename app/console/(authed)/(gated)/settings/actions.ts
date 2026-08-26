"use server";

import { ZodError } from "zod";
import { ForbiddenError } from "@/lib/auth/rbac";
import { requireStaff } from "@/lib/staff/current";
import { BrandIdentityError, updateBrandIdentityForSession } from "@/lib/brand/manage";
import type { IdentityState } from "./state";

export async function saveIdentity(_prev: IdentityState, formData: FormData): Promise<IdentityState> {
  try {
    const staff = await requireStaff();
    await updateBrandIdentityForSession({ user: { brandId: staff.brandId, role: staff.role } }, formData);
    return { ok: true };
  } catch (err) {
    if (err instanceof BrandIdentityError) {
      return { ok: false, error: err.message };
    }
    // The schema's messages are written for a brand to read — "use a
    // six-digit colour like #C8102E" is more use than "invalid input", so
    // the first one is surfaced rather than swallowed.
    if (err instanceof ZodError) {
      return { ok: false, error: err.issues[0]?.message ?? "Check the values and try again." };
    }
    if (err instanceof ForbiddenError) {
      return { ok: false, error: "Your role can't change the brand's appearance. Ask an owner or admin." };
    }
    console.error("[console/settings]", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
