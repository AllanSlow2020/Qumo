"use server";

import { PRODUCT_NAME } from "@/lib/product";
import { requireStaff } from "@/lib/staff/current";
import {
  MfaError,
  beginEnrolment,
  confirmEnrolment,
  disableMfa,
  regenerateRecoveryCodes,
} from "@/lib/staff/mfa";
import { logger } from "@/lib/security/logger";
import { IDLE, type SecurityState } from "./state";

/** Never leak an internal message to a screen; log it and say less. */
function toState(err: unknown, previous: SecurityState): SecurityState {
  if (err instanceof MfaError) {
    return { ...previous, error: err.message };
  }
  logger.error("console: second factor action failed", { err: String(err) });
  return { ...previous, error: "Something went wrong. Please try again." };
}

async function actor() {
  const staff = await requireStaff();
  return {
    user: {
      id: staff.userId,
      brandId: staff.brandId,
      role: staff.role,
      name: staff.name,
      email: staff.email,
    },
  };
}

export async function startEnrolment(): Promise<SecurityState> {
  try {
    const offer = await beginEnrolment(await actor(), PRODUCT_NAME);
    return { step: "confirm", secret: offer.secret, otpauth: offer.otpauthUrl, error: null };
  } catch (err) {
    return toState(err, IDLE);
  }
}

export async function confirmCode(previous: SecurityState, formData: FormData): Promise<SecurityState> {
  try {
    const codes = await confirmEnrolment(await actor(), String(formData.get("code") ?? ""));
    return { step: "codes", codes, error: null };
  } catch (err) {
    return toState(err, previous);
  }
}

export async function turnOff(previous: SecurityState, formData: FormData): Promise<SecurityState> {
  try {
    await disableMfa(await actor(), String(formData.get("password") ?? ""));
    return { step: "done", error: null };
  } catch (err) {
    return toState(err, previous);
  }
}

export async function newRecoveryCodes(previous: SecurityState, formData: FormData): Promise<SecurityState> {
  try {
    const codes = await regenerateRecoveryCodes(await actor(), String(formData.get("password") ?? ""));
    return { step: "codes", codes, error: null };
  } catch (err) {
    return toState(err, previous);
  }
}
