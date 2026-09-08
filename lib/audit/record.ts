import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { redact } from "@/lib/security/logger";

/**
 * The record of what a brand's staff did.
 *
 * ── Why this is not "nice to have" ───────────────────────────────────────
 *
 * The console can create a promotion that awards real money, rotate the
 * secret that decides whether a till slip is trustworthy, reset a
 * colleague's password, and cancel the programme. Until now none of it left
 * a trace. When a brand asks who changed the earn rate the week their
 * liability doubled, "we don't know" is not an answer a platform holding
 * their customers' balances gets to give.
 *
 * ── The write is part of the action, not a side effect ───────────────────
 *
 * `record` throws if it cannot write. That is deliberate and it is the
 * opposite of lib/observability/report.ts, which must never throw: an error
 * report is a best-effort notification about something that already
 * happened, while an audit entry is part of the thing happening. A
 * privileged action that completed with no record of who did it is worse
 * than one that failed and can be retried.
 *
 * Every caller that already runs inside a transaction passes its client, so
 * the entry and the change commit together or not at all. Where there is no
 * transaction the entry is written immediately after the change - the
 * narrow window where a crash could separate them is named here rather than
 * papered over, and closing it means wrapping single-statement updates in
 * transactions for a failure mode nobody has met.
 *
 * ── What must never end up in here ───────────────────────────────────────
 *
 * `detail` goes through the same redaction the logger uses, because this
 * table is read by a brand's staff in their console. A rotated signing
 * secret, a generated password, a shopper's phone number: none of them
 * belong in a record of the fact that something changed. The *fact* of a
 * rotation is the useful part; the secret is what the rotation exists to
 * keep out of places like this.
 */

/** A Prisma client or an open transaction - the entry goes wherever the change went. */
type Writer = Pick<typeof prisma, "auditEvent"> | Prisma.TransactionClient;

export type AuditActor = {
  id: string;
  brandId: string;
  name?: string;
  email?: string | null;
};

export type AuditEntry = {
  /**
   * A dotted verb, past tense, naming the thing and what happened to it:
   * "store.secret_rotated", "campaign.activated", "user.role_changed".
   * Read as a list, so the noun comes first and sorts with its siblings.
   */
  action: string;
  targetId?: string | null;
  /** How the target should read months later, when its name may have changed. */
  targetLabel?: string | null;
  detail?: Record<string, unknown>;
};

/**
 * Write one entry as a signed-in staff member.
 *
 * The actor's name and email are copied in rather than joined at read time
 * - see the note on the model. A log answers "who did this" with who they
 * were at the time, not who the row points at today.
 */
export async function record(writer: Writer, actor: AuditActor, entry: AuditEntry): Promise<void> {
  await writer.auditEvent.create({
    data: {
      brandId: actor.brandId,
      actorId: actor.id,
      // A verified session always carries a name. The fallback exists so a
      // missing one produces an honest row rather than a thrown error that
      // would block the action the log is supposed to be recording.
      actorName: actor.name ?? "(unknown)",
      actorEmail: actor.email ?? null,
      action: entry.action,
      targetId: entry.targetId ?? null,
      targetLabel: entry.targetLabel ?? null,
      detail: entry.detail ? (redact(entry.detail) as Prisma.InputJsonValue) : undefined,
    },
  });
}

/**
 * Write one entry for something the system did on its own - a scheduled
 * programme closure, a sweep.
 *
 * Separate from `record` rather than an optional actor, because "no actor"
 * has to be a decision at the call site. An automated action attributed to
 * whichever user happened to be in scope is the one kind of falsehood this
 * table cannot survive.
 */
export async function recordSystem(
  writer: Writer,
  brandId: string,
  entry: AuditEntry,
  actorName = "Qumo (automatic)",
): Promise<void> {
  await writer.auditEvent.create({
    data: {
      brandId,
      actorId: null,
      actorName,
      actorEmail: null,
      action: entry.action,
      targetId: entry.targetId ?? null,
      targetLabel: entry.targetLabel ?? null,
      detail: entry.detail ? (redact(entry.detail) as Prisma.InputJsonValue) : undefined,
    },
  });
}
