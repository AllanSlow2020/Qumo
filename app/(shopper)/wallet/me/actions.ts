"use server";

import { revalidatePath } from "next/cache";
import { getConsumerSession } from "@/lib/consumer/session";
import { setOptOut } from "@/lib/consumer/membership";
import { logger } from "@/lib/security/logger";

export type ProgrammeResult = { ok: true } | { ok: false; error: string };

/**
 * Leaving or rejoining one brand's programme.
 *
 * The personId comes from the verified session and never from the form.
 * A brandId in a form field is fine — it only ever selects among the
 * memberships this person already has, and setOptOut resolves it through
 * the consumer lens before writing. A personId in a form field would let
 * anyone opt anyone out of anything.
 */
export async function toggleOptOut(formData: FormData): Promise<ProgrammeResult> {
  const personId = await getConsumerSession();
  if (!personId) {
    return { ok: false, error: "Please sign in again." };
  }

  const brandId = String(formData.get("brandId") ?? "");
  const optOut = formData.get("optOut") === "true";
  if (!brandId) {
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  try {
    const moved = await setOptOut(personId, brandId, optOut);
    if (!moved) {
      return { ok: false, error: "We couldn't find that programme." };
    }
  } catch (err) {
    logger.error("consumer: opt-out toggle failed", { err: String(err) });
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/wallet/me");
  revalidatePath("/wallet");
  return { ok: true };
}
