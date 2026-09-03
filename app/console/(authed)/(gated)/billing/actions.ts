"use server";

import { ForbiddenError } from "@/lib/auth/rbac";
import { requireStaff } from "@/lib/staff/current";
import { SubscriptionError, cancelForSession, resumeForSession } from "@/lib/subscriptions/manage";
import type { BillingActionState } from "./state";

function toState(err: unknown): BillingActionState {
  if (err instanceof SubscriptionError) return { ok: false, error: err.message };
  if (err instanceof ForbiddenError) {
    return { ok: false, error: "Only an owner can end or restart the programme." };
  }
  console.error("[console/billing]", err);
  return { ok: false, error: "Something went wrong. Try again." };
}

async function engineSession() {
  const staff = await requireStaff();
  return { user: { id: staff.userId, brandId: staff.brandId, role: staff.role, name: staff.name, email: staff.email } };
}

export async function cancelProgramme(): Promise<BillingActionState> {
  try {
    await cancelForSession(await engineSession());
    return { ok: true };
  } catch (err) {
    return toState(err);
  }
}

export async function resumeProgramme(): Promise<BillingActionState> {
  try {
    await resumeForSession(await engineSession());
    return { ok: true };
  } catch (err) {
    return toState(err);
  }
}
