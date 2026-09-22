"use server";

import { ZodError } from "zod";
import { ForbiddenError } from "@/lib/auth/rbac";
import { requireStaff } from "@/lib/staff/current";
import { BrandIdentityError, setBrandMinimumAge, updateBrandIdentityForSession } from "@/lib/brand/manage";
import type { IdentityState } from "./state";

export async function saveIdentity(_prev: IdentityState, formData: FormData): Promise<IdentityState> {
  try {
    const staff = await requireStaff();
    await updateBrandIdentityForSession({ user: { id: staff.userId, brandId: staff.brandId, role: staff.role, name: staff.name, email: staff.email } }, formData);
    return { ok: true };
  } catch (err) {
    if (err instanceof BrandIdentityError) {
      return { ok: false, error: err.message };
    }
    // The schema's messages are written for a brand to read - "use a
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

export async function saveAgeRestriction(_prev: IdentityState, formData: FormData): Promise<IdentityState> {
  try {
    const staff = await requireStaff();
    // An unticked box posts nothing at all, so absence is the off state -
    // reading it as "leave it alone" would make the box impossible to clear.
    await setBrandMinimumAge(
      { user: { id: staff.userId, brandId: staff.brandId, role: staff.role, name: staff.name, email: staff.email } },
      formData.get("ageRestricted") === "on",
    );
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: "Your role can't change this. Ask an owner or admin." };
    }
    console.error("[console/settings/age]", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
