"use server";

import { revalidatePath } from "next/cache";
import { getConsumerSession } from "@/lib/consumer/session";
import { createWalletSpend, cancelWalletSpend, WalletSpendError } from "@/lib/wallet/spend";
import { logger } from "@/lib/security/logger";

export type SpendResult = { ok: true } | { ok: false; error: string };

/**
 * Amounts arrive as rands from the form and become cents here, at the
 * edge - the same boundary formatLedgerAmount() sits on going the other
 * way. Nothing downstream of this line handles a fractional amount.
 */
function randsToCents(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new WalletSpendError("Enter an amount to spend.");
  }
  return Math.round(value * 100);
}

export async function requestSpend(formData: FormData): Promise<SpendResult> {
  const personId = await getConsumerSession();
  if (!personId) {
    return { ok: false, error: "Please sign in again." };
  }

  try {
    const brandId = String(formData.get("brandId") ?? "");
    const amountCents = randsToCents(String(formData.get("amount") ?? ""));
    await createWalletSpend(personId, brandId, amountCents);
    revalidatePath("/wallet");
    return { ok: true };
  } catch (err) {
    if (err instanceof WalletSpendError) {
      return { ok: false, error: err.message };
    }
    logger.error("wallet spend request failed", { err: String(err) });
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function abandonSpend(formData: FormData): Promise<void> {
  const personId = await getConsumerSession();
  if (!personId) {
    return;
  }
  await cancelWalletSpend(personId, String(formData.get("spendId") ?? ""));
  revalidatePath("/wallet");
}
