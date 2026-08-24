import type { Role, SubscriptionStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { HONOUR_WINDOW_MS, programmeState, type ProgrammeState } from "./state";

/**
 * Starting, cancelling and resuming a brand's programme.
 *
 * Owner-only. Cancelling ends a brand's earning and starts a clock on their
 * shoppers' balances; that is not a decision for whoever happens to be
 * logged in.
 */
export const MANAGE_SUBSCRIPTION_ROLES: Role[] = ["OWNER"];

export class SubscriptionError extends Error {}

export type SessionLike = { user: { brandId: string; role: string } };

const SELECT = { status: true, cancelledAt: true, honourRedemptionUntil: true } as const;

/**
 * The programme state for a brand, for the engine to act on.
 *
 * Not scoped through forBrand(): the callers are scan paths that already
 * resolved a brandId from a code or a store, and adding a tenant guard round
 * a lookup by primary key would only obscure that.
 */
export async function getProgrammeState(brandId: string, now: Date = new Date()): Promise<ProgrammeState> {
  const row = await prisma.subscription.findUnique({ where: { brandId }, select: SELECT });
  return programmeState(row, now);
}

export type SubscriptionView = ProgrammeState & {
  startedAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelledAt: Date | null;
};

/** The same thing, with the dates a console screen wants to show. */
export async function getSubscriptionView(brandId: string, now: Date = new Date()): Promise<SubscriptionView> {
  const row = await prisma.subscription.findUnique({
    where: { brandId },
    select: { ...SELECT, startedAt: true, currentPeriodEnd: true },
  });
  return {
    ...programmeState(row, now),
    startedAt: row?.startedAt ?? null,
    currentPeriodEnd: row?.currentPeriodEnd ?? null,
    cancelledAt: row?.cancelledAt ?? null,
  };
}

/**
 * Cancels, and writes down exactly what was promised.
 *
 * The honour date is computed once, here, and stored. Changing
 * HONOUR_WINDOW_DAYS later moves nothing for anybody already cancelled — a
 * shopper was told sixty days and gets sixty days.
 */
export async function cancelForSession(session: SessionLike, now: Date = new Date()): Promise<void> {
  requireRole(session.user.role as Role, MANAGE_SUBSCRIPTION_ROLES);

  const current = await prisma.subscription.findUnique({
    where: { brandId: session.user.brandId },
    select: { status: true },
  });
  if (current && (current.status === "CANCELLED" || current.status === "CLOSED")) {
    throw new SubscriptionError("This programme is already cancelled.");
  }

  const honourRedemptionUntil = new Date(now.getTime() + HONOUR_WINDOW_MS);
  const data = { status: "CANCELLED" as const, cancelledAt: now, honourRedemptionUntil };

  await prisma.subscription.upsert({
    where: { brandId: session.user.brandId },
    update: data,
    // A brand that never had a row can still cancel — it is how an
    // unmanaged pilot brand leaves.
    create: { brandId: session.user.brandId, ...data },
  });
}

/**
 * Brings a cancelled programme back.
 *
 * Allowed after the window has closed as well as during it. Nothing was
 * deleted at closure — balances are ledger rows and the ledger is immutable
 * — so resuming genuinely restores what shoppers had, which is the reason
 * closure freezes rather than erases.
 */
export async function resumeForSession(session: SessionLike): Promise<void> {
  requireRole(session.user.role as Role, MANAGE_SUBSCRIPTION_ROLES);

  await prisma.subscription.upsert({
    where: { brandId: session.user.brandId },
    update: { status: "ACTIVE", cancelledAt: null, honourRedemptionUntil: null },
    create: { brandId: session.user.brandId, status: "ACTIVE" },
  });
}

/** Puts a brand on a plan. Stands in for what billing will eventually do. */
export async function setStatusForSession(
  session: SessionLike,
  status: Extract<SubscriptionStatus, "TRIALING" | "ACTIVE">,
): Promise<void> {
  requireRole(session.user.role as Role, MANAGE_SUBSCRIPTION_ROLES);

  await prisma.subscription.upsert({
    where: { brandId: session.user.brandId },
    update: { status, cancelledAt: null, honourRedemptionUntil: null },
    create: { brandId: session.user.brandId, status },
  });
}

/**
 * Marks elapsed windows CLOSED.
 *
 * Tidying, not enforcement. programmeState() already treats an elapsed
 * window as closed, so this changes no behaviour — it just stops a row
 * saying CANCELLED forever, which makes the console and any future report
 * easier to read. Safe to never run.
 */
export async function closeElapsedProgrammes(now: Date = new Date()): Promise<number> {
  const result = await prisma.subscription.updateMany({
    where: { status: "CANCELLED", honourRedemptionUntil: { lt: now } },
    data: { status: "CLOSED" },
  });
  return result.count;
}
