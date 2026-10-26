"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { BrandIdentityError, updateBrandColoursForSession } from "@/lib/brand/manage";
import { requireStaff } from "@/lib/staff/current";
import type { SetupState } from "./state";

export async function saveColours(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const staff = await requireStaff();

  try {
    await updateBrandColoursForSession(
      { user: { id: staff.userId, brandId: staff.brandId, role: staff.role, name: staff.name, email: staff.email } },
      formData,
    );
  } catch (err) {
    if (err instanceof BrandIdentityError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof ZodError) {
      return { ok: false, error: err.issues[0]?.message ?? "Check the colours and try again." };
    }
    console.error("[console/setup]", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }

  // Straight into the console. The gate that sent them here reads the row it
  // just wrote, so this is the moment it lifts, and landing back on the
  // setup screen after finishing it would be its own small insult.
  redirect("/");
}
