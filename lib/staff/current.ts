import { cache } from "react";
import { getStaffSession, type StaffIdentity } from "./session";

/**
 * The signed-in staff member, memoised for the request.
 *
 * `cache()` so a layout and three components asking cost one query, and
 * scoped to the request rather than the module - a module-level cache would
 * outlive the request and hand one brand's staff identity to the next
 * caller, which on this surface means handing them another brand's data.
 */
export const currentStaff = cache(async (): Promise<StaffIdentity | null> => getStaffSession());

/**
 * For pages under the (authed) group, which the layout has already gated.
 * Throwing rather than redirecting is right: reaching here without a session
 * means the layout's check was bypassed, and that is a bug to surface, not a
 * shopper to redirect.
 */
export async function requireStaff(): Promise<StaffIdentity> {
  const staff = await currentStaff();
  if (!staff) {
    throw new Error("Console route reached without a staff session");
  }
  return staff;
}
