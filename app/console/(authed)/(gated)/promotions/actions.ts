"use server";

import { ForbiddenError } from "@/lib/auth/rbac";
import { requireStaff } from "@/lib/staff/current";
import {
  CampaignError,
  createCampaignForSession,
  deleteCampaignForSession,
  renameCampaignForSession,
  setCampaignLimitsForSession,
  setCardForSession,
  setCampaignStatusForSession,
} from "@/lib/campaigns/manage";
import { EarnRuleError, setEarnRuleForSession } from "@/lib/packs/earn-rule";
import { StoreError, setSpendRuleForSession } from "@/lib/stores/manage";
import { forBrand } from "@/lib/db/tenant";
import {
  PROMOTION_SHAPES,
  SHAPE_DEFAULTS,
  shapeOfRule,
  type PromotionShape,
} from "@/lib/console/promotion-shape";
import type { PromoActionState } from "./state";

/**
 * The console's write path for promotions. Thin wrappers, as with stores:
 * the engine already checks roles and scopes every query to the caller's
 * brand, so the work here is turning a staff session into the shape those
 * functions want and an exception into a sentence.
 */

function toState(err: unknown): PromoActionState {
  // These three carry messages written for a brand to read - the conflict
  // between two spend-based promotions in particular explains a rule nobody
  // would guess. Passing them through is the point of having them.
  if (err instanceof CampaignError || err instanceof StoreError || err instanceof EarnRuleError) {
    return { ok: false, error: err.message };
  }
  if (err instanceof ForbiddenError) {
    return { ok: false, error: "Your role can't change promotions. Ask an owner or admin." };
  }
  if (err instanceof Error && err.name === "ZodError") {
    return { ok: false, error: "Check the numbers. Each one has to be a whole number above zero." };
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
    const campaign = await createCampaignForSession(await engineSession(), formData);
    return { ok: true, id: campaign.id };
  } catch (err) {
    return toState(err);
  }
}

export async function renameCampaign(_prev: PromoActionState, formData: FormData): Promise<PromoActionState> {
  try {
    await renameCampaignForSession(
      await engineSession(),
      String(formData.get("campaignId") ?? ""),
      formData,
    );
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

/** The stored rule, or null, for deciding what a form is allowed to mean. */
async function storedRule(brandId: string, campaignId: string) {
  if (!campaignId) return null;
  const campaign = await forBrand(brandId).campaign.findFirst({
    where: { id: campaignId },
    select: {
      earnRule: { select: { type: true, unit: true, amount: true, basisPoints: true, minSpendCents: true } },
    },
  });
  return campaign?.earnRule ?? null;
}

/**
 * A number a person typed, as a count of its smallest unit.
 *
 * Brands think in rands and percentages; the ledger is integers all the
 * way down and nothing here changes that. The conversion happens at the
 * console edge so `lib` keeps taking cents and basis points, which is what
 * every test and every engine path already expects.
 *
 * Returns null for empty, which callers read as "not given", and NaN for
 * anything that is not a number, which they turn into a sentence.
 */
function scaled(raw: FormDataEntryValue | null, factor: number): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return Number.NaN;
  return Math.round(value * factor);
}

/**
 * Which of the three kinds this promotion is.
 *
 * Its own action, and that separation is what makes the step safe without
 * JavaScript. The fields a kind needs are different for each kind, so a
 * single form that both chose the kind and carried its numbers would
 * arrive holding the previous kind's answers. Choosing saves on its own,
 * the step redraws, and the second form can only ever submit fields that
 * belong to the kind on screen.
 */
export async function setShape(_prev: PromoActionState, formData: FormData): Promise<PromoActionState> {
  try {
    const session = await engineSession();
    const campaignId = String(formData.get("campaignId") ?? "");
    const shape = String(formData.get("shape") ?? "") as PromotionShape;
    if (!PROMOTION_SHAPES.includes(shape)) {
      return { ok: false, error: "Pick one of the kinds listed." };
    }

    const current = await storedRule(session.user.brandId, campaignId);
    // Re-saving the same kind is not a reset. Changing kind is: the figures
    // belong to the kind that was chosen, and carrying a share of spend
    // across into a fixed award would be inventing a number nobody typed.
    const keeping = shapeOfRule(current) === shape;
    const fallback = SHAPE_DEFAULTS[shape];

    const next = new FormData();
    next.set("campaignId", campaignId);
    next.set("unit", keeping && current ? current.unit : fallback.unit);

    if (shape === "SHARE_OF_SPEND") {
      next.set("basisPoints", String((keeping && current?.basisPoints) || fallback.basisPoints));
      if (keeping && current?.minSpendCents != null) next.set("minSpendCents", String(current.minSpendCents));
      await setSpendRuleForSession(session, next);
    } else {
      next.set("amount", String((keeping && current?.amount) || fallback.amount));
      await setEarnRuleForSession(session, next);
    }
    return { ok: true };
  } catch (err) {
    return toState(err);
  }
}

/**
 * The figures for the kind already chosen.
 *
 * Dispatches on what is stored rather than on anything the form says it
 * is. The form used to carry a `type` select, which meant a submission
 * could assert its own meaning: pick a kind, do not save it, fill in the
 * other kind's boxes, and the server believed the select. Reading the
 * stored rule makes that unrepresentable.
 *
 * A stamp card never reaches here. One stamp a purchase is the whole rule,
 * so choosing the kind is the entire step and there is no second form.
 */
export async function setRule(_prev: PromoActionState, formData: FormData): Promise<PromoActionState> {
  try {
    const session = await engineSession();
    const campaignId = String(formData.get("campaignId") ?? "");
    const shape = shapeOfRule(await storedRule(session.user.brandId, campaignId));
    if (!shape) {
      return { ok: false, error: "Choose what kind of promotion this is first." };
    }

    const next = new FormData();
    next.set("campaignId", campaignId);

    if (shape === "SHARE_OF_SPEND") {
      const basisPoints = scaled(formData.get("percent"), 100);
      if (basisPoints == null || Number.isNaN(basisPoints) || basisPoints < 1 || basisPoints > 10_000) {
        return { ok: false, error: "The share has to be a percentage between 0.01 and 100." };
      }
      const minimum = scaled(formData.get("minimumBasket"), 100);
      if (minimum != null && Number.isNaN(minimum)) {
        return { ok: false, error: "The minimum basket has to be an amount in rands, or empty." };
      }
      next.set("unit", "CENTS");
      next.set("basisPoints", String(basisPoints));
      if (minimum != null) next.set("minSpendCents", String(minimum));
      const proof = String(formData.get("minProofTier") ?? "");
      if (proof) next.set("minProofTier", proof);
      await setSpendRuleForSession(session, next);
      return { ok: true };
    }

    // A fixed award. Points are counted as themselves; rands are the only
    // thing on this form that is not already an integer.
    const unit = formData.get("unit") === "POINTS" ? "POINTS" : "CENTS";
    const amount = scaled(formData.get("amount"), unit === "CENTS" ? 100 : 1);
    if (amount == null || Number.isNaN(amount) || amount < 1) {
      return {
        ok: false,
        error: unit === "CENTS" ? "What a scan awards has to be an amount in rands." : "Points have to be a whole number above zero.",
      };
    }
    next.set("unit", unit);
    next.set("amount", String(amount));
    await setEarnRuleForSession(session, next);
    return { ok: true };
  } catch (err) {
    return toState(err);
  }
}

/**
 * The stamp card and what completing one earns.
 *
 * One action for both halves, matching the one form. Until this existed the
 * console could set a card's size and nothing at all about its reward, so a
 * brand could run a card that never paid out.
 */
export async function setCard(_prev: PromoActionState, formData: FormData): Promise<PromoActionState> {
  try {
    await setCardForSession(await engineSession(), formData);
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

/**
 * Deleting a promotion.
 *
 * As thin as the rest, and the refusals it passes through are the point:
 * deleteCampaignForSession explains in a sentence what the promotion is
 * still holding, and that sentence is the only thing standing between a
 * confirm dialogue and a shopper's unredeemed reward.
 */
export async function deleteCampaign(_prev: PromoActionState, formData: FormData): Promise<PromoActionState> {
  try {
    await deleteCampaignForSession(await engineSession(), String(formData.get("campaignId") ?? ""));
    return { ok: true };
  } catch (err) {
    return toState(err);
  }
}
