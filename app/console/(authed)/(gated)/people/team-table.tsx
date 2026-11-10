"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import type { TeamMember } from "@/lib/staff/users";
import { resetPassword, resetSecondFactor, setActive, setRole } from "./actions";
import { IDLE, type TeamActionState } from "./state";
import { TempPassword } from "./temp-password";

const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner: everything, including the team",
  ADMIN: "Admin: everything except the team",
  MARKETING: "Marketing: promotions and reporting",
  QUALITY: "Quality: reporting only",
};

/**
 * One row's controls.
 *
 * Its own action state per person, so an error against one row cannot appear
 * against another - which matters here more than most places, because the
 * errors are refusals ("this is your only owner") that only make sense
 * beside the person they are about.
 */
function MemberControls({ member, isSelf }: { member: TeamMember; isSelf: boolean }) {
  const router = useRouter();
  const [roleState, roleAction, rolePending] = useActionState<TeamActionState, FormData>(setRole, IDLE);
  const [activeState, activeAction, activePending] = useActionState<TeamActionState, FormData>(setActive, IDLE);
  const [resetState, resetAction, resetPending] = useActionState<TeamActionState, FormData>(resetPassword, IDLE);
  const [mfaState, mfaAction, mfaPending] = useActionState<TeamActionState, FormData>(resetSecondFactor, IDLE);

  useEffect(() => {
    if (roleState.ok || activeState.ok || resetState.ok || mfaState.ok) router.refresh();
  }, [roleState, activeState, resetState, mfaState, router]);

  const error =
    (roleState.ok === false && roleState.error) ||
    (activeState.ok === false && activeState.error) ||
    (resetState.ok === false && resetState.error) ||
    (mfaState.ok === false && mfaState.error) ||
    null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {resetState.ok && resetState.temporaryPassword && (
        <TempPassword password={resetState.temporaryPassword} email={resetState.forEmail} />
      )}

      <div className="cn-actions">
        <form action={roleAction} style={{ display: "flex", gap: 6 }}>
          <input type="hidden" name="userId" value={member.id} />
          <select
            name="role"
            className="cn-input"
            defaultValue={member.role}
            style={{ fontSize: 13, padding: "6px 30px 6px 10px", width: "auto" }}
            disabled={rolePending}
          >
            {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
              <option key={role} value={role}>
                {role.toLowerCase()}
              </option>
            ))}
          </select>
          <button type="submit" className="cn-btn cn-btn-quiet" disabled={rolePending}>
            {rolePending ? "…" : "Save role"}
          </button>
        </form>

        <form action={resetAction}>
          <input type="hidden" name="userId" value={member.id} />
          <input type="hidden" name="email" value={member.email} />
          <button type="submit" className="cn-btn cn-btn-quiet" disabled={resetPending}>
            {resetPending ? "…" : "Reset password"}
          </button>
        </form>

        {/* No switch-off button on your own row. The engine refuses it
            anyway; offering a button whose only outcome is a refusal is just
            an invitation to read an error message. */}
        {!isSelf && (
          <form action={activeAction}>
            <input type="hidden" name="userId" value={member.id} />
            <input type="hidden" name="isActive" value={String(!member.isActive)} />
            <button type="submit" className="cn-btn cn-btn-quiet" disabled={activePending}>
              {activePending ? "…" : member.isActive ? "Switch off access" : "Switch access back on"}
            </button>
          </form>
        )}
      </div>

      {/* Only where there is something to clear, and never on your own row.
          Hidden on your own because the engine refuses it there - that
          refusal is what stops this becoming a way to turn your own second
          factor off, which disableMfa does not allow - and a button whose
          only outcome is an error is an invitation to read one.

          The password is this owner's own, asked for the same reason
          disableMfa asks: an open console on an unattended desk must not be
          enough to strip a colleague's protection. */}
      {!isSelf && member.hasSecondFactor && (
        <form action={mfaAction} className="cn-actions" style={{ alignItems: "center", gap: 6 }}>
          <input type="hidden" name="userId" value={member.id} />
          <input
            name="password"
            type="password"
            className="cn-input"
            autoComplete="current-password"
            placeholder="Your password"
            required
            style={{ fontSize: 13, padding: "6px 10px", width: 170 }}
            disabled={mfaPending}
          />
          <button type="submit" className="cn-btn cn-btn-quiet" disabled={mfaPending}>
            {mfaPending ? "…" : "Reset two-factor"}
          </button>
          <span className="cn-label">
            {/* Says what happens next, because "reset" could be read as
                "switch off" and it is not: they must enrol again. */}
            They sign in with their password, then set it up again.
          </span>
        </form>
      )}

      {error && (
        <p className="cn-err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TeamTable({ team, selfId }: { team: TeamMember[]; selfId: string }) {
  return (
    <div className="cn-scroll">
      <table className="cn-table">
        <thead>
          <tr>
            <th>Person</th>
            <th>Role</th>
            <th>Status</th>
            <th>Manage</th>
          </tr>
        </thead>
        <tbody>
          {team.map((member) => (
            <tr key={member.id}>
              <td>
                {member.name}
                {member.id === selfId && <span className="cn-label"> (you)</span>}
                <div className="cn-label">{member.email}</div>
              </td>
              <td>
                <span className="cn-label">{ROLE_LABELS[member.role]}</span>
              </td>
              <td>
                {!member.isActive ? (
                  <span className="cn-pill cn-pill-off">No access</span>
                ) : member.mustChangePassword ? (
                  // Worth surfacing: it means a password somebody else chose
                  // is still live on that account.
                  <span className="cn-pill cn-pill-warn">Hasn&apos;t set a password</span>
                ) : (
                  <span className="cn-pill cn-pill-ok">Active</span>
                )}
              </td>
              <td>
                <MemberControls member={member} isSelf={member.id === selfId} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
