"use server";

import { ForbiddenError } from "@/lib/auth/rbac";
import { requireStaff } from "@/lib/staff/current";
import { PackBatchError, createPackBatchForSession } from "@/lib/packs/batch";
import type { BatchActionState } from "./state";

export async function createBatch(_prev: BatchActionState, formData: FormData): Promise<BatchActionState> {
  try {
    const staff = await requireStaff();
    await createPackBatchForSession(
      { user: { brandId: staff.brandId, role: staff.role, id: staff.userId } },
      formData,
    );
    return { ok: true };
  } catch (err) {
    // "Set up what this campaign awards before generating codes for it" is
    // the message that saves a brand printing 50,000 stickers that
    // disappoint everyone who scans them. Passing it through is the point.
    if (err instanceof PackBatchError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof ForbiddenError) {
      return { ok: false, error: "Your role can't generate codes." };
    }
    if (err instanceof Error && err.name === "ZodError") {
      return { ok: false, error: "Give the run a name and a quantity between 1 and 100,000." };
    }
    console.error("[console/codes]", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
