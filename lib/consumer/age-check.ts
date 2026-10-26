import { prisma } from "@/lib/db/client";
import {
  AGE_REFUSAL_COOLDOWN_MS,
  ageOn,
  inCooldown,
  meetsMinimum,
  parseBirthDate,
  type AgeState,
} from "@/lib/consumer/age";

/**
 * Recording the outcome of the age step.
 *
 * Separate from lib/consumer/age.ts, which is arithmetic and has no
 * database in it - that split is what lets the parsing and the age maths be
 * tested without a Postgres, and what keeps the rules readable next to each
 * other rather than threaded through queries.
 */

export type AgeDecision =
  | { ok: true }
  | { ok: false; reason: "INVALID"; error: string }
  | { ok: false; reason: "TOO_YOUNG" }
  | { ok: false; reason: "COOLDOWN"; until: Date };

/** What a page needs to know before deciding whether to ask. */
export async function ageStateFor(personId: string): Promise<AgeState | null> {
  return prisma.person.findUnique({
    where: { id: personId },
    select: { ageConfirmedAt: true, ageConfirmedMinimum: true, ageRefusedAt: true },
  });
}

/**
 * Whether this brand needs this shopper to answer before they earn.
 *
 * Returns false for the overwhelming majority of calls - a brand with no
 * minimum - after a single indexed read, so pages can ask it freely.
 */
export async function needsAgeStep(brandId: string, personId: string): Promise<boolean> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { minimumAge: true } });
  const minimum = brand?.minimumAge ?? null;
  if (minimum === null) return false;

  const state = await ageStateFor(personId);
  if (!state) return false;
  return !meetsMinimum(state, minimum);
}

/**
 * Takes the three fields, decides, and writes only what should be kept.
 *
 * ── The two writes, and why they are so different in size ────────────────
 *
 * A pass writes when it happened and what was established. A failure writes
 * a single timestamp and nothing else - not the date entered, not the age
 * it worked out to. Somebody who has just told us they are a child is the
 * last person whose personal details should be filed, and "we kept it to
 * prove we checked" is the argument that ends with a database of minors'
 * birthdays. The timestamp proves the refusal happened. That is the part
 * worth keeping.
 *
 * The cooldown is checked before the date is even parsed, so a locked-out
 * shopper cannot use this as an oracle for which years pass.
 */
export async function submitAgeCheck(
  personId: string,
  brandId: string,
  input: { day: string; month: string; year: string },
  now: Date = new Date(),
): Promise<AgeDecision> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { minimumAge: true } });
  const minimum = brand?.minimumAge ?? null;
  if (minimum === null) {
    // Nothing to answer. Treated as a pass rather than an error so that a
    // brand turning the setting off does not strand somebody mid-form.
    return { ok: true };
  }

  const state = await ageStateFor(personId);
  if (!state) {
    return { ok: false, reason: "INVALID", error: "Sign in again and we'll pick this up." };
  }

  if (meetsMinimum(state, minimum)) {
    return { ok: true };
  }

  if (inCooldown(state, now)) {
    return {
      ok: false,
      reason: "COOLDOWN",
      until: new Date(state.ageRefusedAt!.getTime() + AGE_REFUSAL_COOLDOWN_MS),
    };
  }

  const parsed = parseBirthDate(input, now);
  if (!parsed.ok) {
    // A malformed date is not a refusal. Mistyping the month should not
    // cost somebody a day of the promotion, and nothing has been
    // established either way, so nothing is recorded.
    return { ok: false, reason: "INVALID", error: parsed.error };
  }

  if (ageOn(parsed.born, now) < minimum) {
    await prisma.person.update({ where: { id: personId }, data: { ageRefusedAt: now } });
    return { ok: false, reason: "TOO_YOUNG" };
  }

  await prisma.person.update({
    where: { id: personId },
    // The refusal stamp is cleared on a pass so it cannot outlive the
    // question it was about - someone refused on their seventeenth
    // birthday and confirmed a year later is not carrying a mark.
    data: { ageConfirmedAt: now, ageConfirmedMinimum: minimum, ageRefusedAt: null },
  });
  return { ok: true };
}
