import type { Role } from "@prisma/client";
import { requireStaff } from "@/lib/staff/current";
import { listTeam, MANAGE_USER_ROLES } from "@/lib/staff/users";
import { InviteForm } from "./invite-form";
import { TeamTable } from "./team-table";

export default async function ConsolePeoplePage() {
  const session = await requireStaff();
  const team = await listTeam(session.brandId);

  const canManage = MANAGE_USER_ROLES.includes(session.role as Role);
  const active = team.filter((m) => m.isActive).length;

  return (
    <>
      <h1 className="cn-h1">Team</h1>
      <p className="cn-body">
        Who can sign in to this console. {active} with access, {team.length - active} without.
      </p>

      {!canManage ? (
        <>
          <section className="cn-panel">
            <div className="cn-panel-head">
              <h2 className="cn-h2">
                {team.length} {team.length === 1 ? "person" : "people"}
              </h2>
            </div>
            <div className="cn-panel-body">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {team.map((member) => (
                  <li key={member.id} className="cn-body">
                    {member.name} — {member.role.toLowerCase()}
                    {!member.isActive && " (no access)"}
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <p className="cn-label">Only an owner can change the team.</p>
        </>
      ) : (
        <>
          <section className="cn-panel">
            <div className="cn-panel-head">
              <h2 className="cn-h2">
                {team.length} {team.length === 1 ? "person" : "people"}
              </h2>
            </div>
            <TeamTable team={team} selfId={session.userId} />
          </section>

          <section className="cn-panel">
            <div className="cn-panel-head">
              <h2 className="cn-h2">Add somebody</h2>
            </div>
            <InviteForm />
          </section>
        </>
      )}
    </>
  );
}
