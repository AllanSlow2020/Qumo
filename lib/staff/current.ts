import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getStaffSession, type StaffIdentity } from "./session";
import { secondFactorRequired } from "./mfa-policy";

/**
 * The signed-in staff member, memoised for the request.
 *
 * `cache()` so a layout and three components asking cost one query, and
 * scoped to the request rather than the module - a module-level cache would
 * outlive the request and hand one brand's staff identity to the next
 * caller, which on this surface means handing them another brand's data.
 */
export const currentStaff = cache(async (): Promise<StaffIdentity | null> => getStaffSession());

/** Where an account that owes a second factor is sent to enrol. */
export const SECURITY_PATH = "/security";

/**
 * Whether this account has actually enrolled, memoised for the same reason
 * currentStaff is: requireStaff() is called around thirty times across the
 * console, several times in one render, and this must not be thirty reads.
 *
 * Read per request rather than stamped onto the session, so enrolling lifts
 * the requirement on the very next request instead of after a sign-out, and
 * so a promotion to ADMIN applies it just as quickly.
 */
const secondFactorEnrolled = cache(async (userId: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpConfirmedAt: true },
  });
  return Boolean(user?.totpConfirmedAt);
});

export type RequireStaffOptions = {
  /**
   * Let an account through that owes a second factor but has not enrolled.
   *
   * Only for the screens that *satisfy* the requirement, which cannot
   * themselves require it: /security, and /change-password beside it. Every
   * other caller takes the default.
   */
  allowPendingSecondFactor?: boolean;
};

/**
 * For pages under the (authed) group, which the layout has already gated.
 * Throwing rather than redirecting is right: reaching here without a session
 * means the layout's check was bypassed, and that is a bug to surface, not a
 * shopper to redirect.
 *
 * ── Why the second-factor check lives here and not only in a layout ──────
 *
 * A layout gate is what the rest of this console uses, and for
 * mustChangePassword it is enough. For this it is not, because layouts do
 * not run for server actions. An attacker holding a stolen password signs
 * in - which they can, since enrolment has to be reachable - and then posts
 * the actions directly instead of using the screens. Every action would
 * execute, and the enforcement would be a redirect that only honest
 * browsers follow.
 *
 * Every server action in the console already starts by calling this
 * function, so this is the one place that covers pages and actions alike.
 *
 * Deny by default, with an explicit opt-out, for the same reason the tenant
 * guard denies by default: the next action somebody adds is protected by
 * having forgotten about this, rather than exposed by it.
 *
 * ── Why redirect rather than throw ───────────────────────────────────────
 *
 * In a page, a throw is a 500 where a redirect is the enrolment screen. In
 * an action, `redirect()` aborts before the action body runs, which is the
 * property that matters.
 *
 * One honest caveat: an action whose own `catch` swallows everything will
 * turn Next's redirect signal into its generic error state rather than
 * navigating. The action is still refused - it never ran - so the security
 * property holds; only the message degrades. It is a path the UI cannot
 * reach anyway, because the layout redirects such an account to /security
 * before it can render a form.
 */
export async function requireStaff(options: RequireStaffOptions = {}): Promise<StaffIdentity> {
  const staff = await currentStaff();
  if (!staff) {
    throw new Error("Console route reached without a staff session");
  }

  if (options.allowPendingSecondFactor) {
    return staff;
  }

  if (secondFactorRequired(staff.role) && !(await secondFactorEnrolled(staff.userId))) {
    redirect(SECURITY_PATH);
  }

  return staff;
}

/**
 * Whether this account owes a second factor it has not set up yet.
 *
 * For the two callers that need to know rather than be redirected: the
 * gated layout, which orders this against the password and brand checks,
 * and the security screen, which says so on the page.
 */
export async function secondFactorOutstanding(staff: StaffIdentity): Promise<boolean> {
  return secondFactorRequired(staff.role) && !(await secondFactorEnrolled(staff.userId));
}
