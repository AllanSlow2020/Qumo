"use server";

import { revalidatePath } from "next/cache";
import { requireBrand } from "@/lib/brand/current";
import { getConsumerSession } from "@/lib/consumer/session";
import { joinBrand } from "@/lib/consumer/join";

export type JoinOutcome = "JOINED" | "NEEDS_SIGN_IN";

/**
 * The opt-in itself.
 *
 * personId comes from the verified session and brandId from the host.
 * Neither is read from the form, so tampering with the request changes
 * nothing at all.
 *
 * Returns where to go rather than redirecting there — see the note in
 * ../wallet/actions.ts on why a redirect() from a server action loses the
 * brand subdomain. The caller navigates.
 */
export async function join(): Promise<JoinOutcome> {
  const personId = await getConsumerSession();
  if (!personId) {
    return "NEEDS_SIGN_IN";
  }

  const brand = await requireBrand();
  await joinBrand(personId, brand.id);
  revalidatePath("/wallet");
  return "JOINED";
}
