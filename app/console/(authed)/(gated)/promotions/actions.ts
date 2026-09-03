"use server";

import { ForbiddenError } from "@/lib/auth/rbac";
import { requireStaff } from "@/lib/staff/current";
import {
  CampaignError,
  createCampaignForSession,
  setCampaignLimitsForSession,
  setCampaignStatusForSession,
} from "@/lib/campaigns/manage";
import { EarnRuleError, setEarnRuleForSession } from "@/lib/packs/earn-rule";
import { StoreError, setSpendRuleForSession } from "@/lib/stores/manage";
import type { PromoActionState } from "./state";

/**
 * The console's write path for promotions. Thin wrappers, as with stores:
 * the engine already checks roles and scopes every query to the caller's
 * brand, so the work here is turning a staff session into the shape those
 * functions want and an exception into a sentence.
 */

function toState(err: unknown): PromoActionState {
  // These three carry messages written for a brand to read — the conflict
  // between two spend-based promotions in particular explains a rule nobody
  // would guess. Passing them through is the point of having them.
  if (err instanceof CampaignError || err instanceof StoreError || err instanceof EarnRuleError) {
    return { ok: false, error: err.message };
  }
  if (err instanceof ForbiddenError) {
    return { ok: false, error: "Your role can't change promotions. Ask an owner or admin." };
  }
  if (err instanceof Error && err.name === "ZodError") {
    return { ok: false, error: "Check the numbers — each one has to be a whole number above zero." };
  }
  console.error("[console/promotions]", err);
  return { ok: false, error: "Something went wrong. Try again." };
}

async function engineSession() {
  const staff = await requireStaff();
  return { user: { id: staff.userId, brandId: staff.brandId, role: staff.role, name: staff.name, email: staff.email } };
}

export async function createCampaign(_prev: PromoActionState, formData: FormData): Promise<PromoActionState> {
  try {
    await createCampaignForSession(await engineSession(), formData);
    return { ok: true };
  } catch (err) {
    return toState(err);
  }
}

export async function setStatus(_prev: PromoActionState, formData: FormData): Promise<PromoActionState> {
  try {
    const status = String(formData.get("status") ?? "");
    if (status !== "ACTIVE" && status !== "PAUSED") {
      return { ok: false, error: "Unknown status." };
    }
    await setCampaignStatusForSession(await engineSession(), String(formData.get("campaignId") ?? ""), status);
    return { ok: true };
  } catch (err) {
    return toState(err);
  }
}

/**
 * One action for both rule shapes, dispatching on the type the form chose.
 *
 * The two engine functions stay separate — they have different validation
 * and, for now, different role lists — but a brand is doing one thing
 * ("decide what this promotion awards") and should fill in one form.
 */
export async function setRule(_prev: PromoActionState, formData: FormData): Promise<PromoActionState> {
  try {
    const session = await engineSession();
    if (formData.get("type") === "PERCENT_OF_SPEND") {
      await setSpendRuleForSession(session, formData);
    } else {
      await setEarnRuleForSession(session, formData);
    }
    return { ok: true };
  } catch (err) {
    return toState(err);
  }
}

export async function setLimits(_prev: PromoActionState, formData: FormData): Promise<PromoActionState> {
  try {
    await setCampaignLimitsForSession(await engineSession(), formData);
    return { ok: true };
  } catch (err) {
    return toState(err);
  }
}
