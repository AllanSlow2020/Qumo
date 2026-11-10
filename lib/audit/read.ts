import { forBrand } from "@/lib/db/tenant";

/**
 * Reading a brand's own log.
 *
 * Scoped through forBrand like everything else, so one brand's console
 * cannot read another's history - which matters more here than almost
 * anywhere, because this table names people and says what they did.
 */

export type AuditRow = {
  id: string;
  action: string;
  actorName: string;
  actorEmail: string | null;
  targetLabel: string | null;
  detail: unknown;
  createdAt: Date;
};

/** One screenful. Paged by cursor rather than offset - the table only grows. */
export const PAGE_SIZE = 50;

export async function listAuditEvents(
  brandId: string,
  options: { before?: Date; limit?: number } = {},
): Promise<AuditRow[]> {
  const limit = Math.min(options.limit ?? PAGE_SIZE, 200);

  const rows = await forBrand(brandId).auditEvent.findMany({
    where: options.before ? { createdAt: { lt: options.before } } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      actorName: true,
      actorEmail: true,
      targetLabel: true,
      detail: true,
      createdAt: true,
    },
  });

  return rows;
}

/**
 * Action names as a person reads them.
 *
 * The stored value is a machine-sortable verb ("store.secret_rotated"); a
 * console shows a sentence. Kept as a lookup with a fallback rather than an
 * exhaustive map, so recording a new kind of event never renders a blank
 * row - an unknown action shows its raw name, which is ugly and honest.
 */
const PHRASES: Record<string, string> = {
  "brand.identity_changed": "Changed how the brand looks to shoppers",
  "campaign.activated": "Switched a promotion on",
  "campaign.completed": "Ended a promotion",
  "campaign.created": "Created a promotion",
  "campaign.draft": "Moved a promotion back to draft",
  "campaign.limits_changed": "Changed a promotion's ceilings",
  "campaign.paused": "Paused a promotion",
  "campaign.renamed": "Renamed a promotion",
  "pack_batch.created": "Generated a batch of print codes",
  "store.created": "Added a store",
  "store.deactivated": "Switched a store off",
  "store.reactivated": "Switched a store back on",
  "store.secret_rotated": "Rotated a store's signing secret",
  "store.signing_disabled": "Turned off signing for a store",
  "subscription.cancelled": "Cancelled the programme",
  "subscription.closed": "Programme closed after the honour window",
  "subscription.resumed": "Resumed the programme",
  "user.deactivated": "Switched off someone's access",
  "user.invited": "Invited someone to the team",
  // These three were already being written by lib/staff/mfa.ts and had no
  // phrase, so they rendered as their raw action name on the activity page.
  // Added with the fourth rather than leaving three quarters of a feature
  // unreadable in the one place it is meant to be reviewed.
  "user.mfa_disabled": "Turned off their two-factor authentication",
  "user.mfa_enabled": "Turned on their two-factor authentication",
  "user.mfa_reset": "Reset someone's two-factor authentication",
  "user.password_reset": "Reset someone's password",
  "user.reactivated": "Restored someone's access",
  "user.recovery_codes_regenerated": "Generated new recovery codes",
  "user.role_changed": "Changed someone's role",
};

export function describeAction(action: string): string {
  return PHRASES[action] ?? action;
}

/**
 * Which entries deserve to stand out in a list.
 *
 * Not a severity - nothing here is an alert. It marks the changes an
 * auditor asks about first: the ones that move money, weaken verification,
 * or change who has access.
 */
const NOTABLE = new Set([
  "campaign.activated",
  "campaign.limits_changed",
  "store.secret_rotated",
  "store.signing_disabled",
  "subscription.cancelled",
  "user.deactivated",
  "user.invited",
  // Both weaken how an account proves it is that account, which is what
  // this list is for. Enrolling is not here: strengthening it is not what
  // an auditor is scanning for.
  "user.mfa_disabled",
  "user.mfa_reset",
  "user.password_reset",
  "user.role_changed",
]);

export function isNotable(action: string): boolean {
  return NOTABLE.has(action);
}
