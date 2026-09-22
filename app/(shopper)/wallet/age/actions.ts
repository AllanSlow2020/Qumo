"use server";

import { requireBrand } from "@/lib/brand/current";
import { getConsumerSession } from "@/lib/consumer/session";
import { safeShopperRedirect } from "@/lib/consumer/redirect";
import { submitAgeCheck } from "@/lib/consumer/age-check";
import { logger } from "@/lib/security/logger";
import type { AgeFormState } from "./state";

/**
 * Returns where to go rather than going there.
 *
 * `redirect()` from a server action does not survive a brand subdomain:
 * Next renders the destination itself, against the server's own origin
 * rather than the host the request arrived on, so the proxy never sees it
 * and never sets the brand header. The shopper lands on a correct URL
 * showing "this link needs a brand".
 *
 * This is written down in ../actions.ts and it was written down before I
 * wrote this file with a redirect() in it. Worth recording that the unit
 * tests all passed while the screen was broken, which is the same way the
 * original shipped: they asserted the row was written, and it was.
 */
export async function confirmAge(_prev: AgeFormState, formData: FormData): Promise<AgeFormState> {
  const personId = await getConsumerSession();
  if (!personId) {
    return { ok: true, next: "/wallet/login" };
  }

  const brand = await requireBrand();
  const destination = safeShopperRedirect(formData.get("next")?.toString());

  let decision;
  try {
    decision = await submitAgeCheck(personId, brand.id, {
      day: formData.get("day")?.toString() ?? "",
      month: formData.get("month")?.toString() ?? "",
      year: formData.get("year")?.toString() ?? "",
    });
  } catch (err) {
    logger.error("age check failed", { err: String(err) });
    return { ok: false, error: "Something went wrong. Try again." };
  }

  if (decision.ok) {
    return { ok: true, next: destination };
  }

  if (decision.reason === "INVALID") {
    return { ok: false, error: decision.error };
  }

  // Both remaining cases end the same way for the person reading it, and
  // deliberately read the same. Telling somebody "you were refused, try
  // again tomorrow" and "you are still blocked from yesterday" in different
  // words tells them the form has a memory and invites them to work out
  // what it remembers.
  return {
    ok: false,
    blocked: true,
    error: "We can't sign you up for this one. Nothing you scanned has been used.",
  };
}
