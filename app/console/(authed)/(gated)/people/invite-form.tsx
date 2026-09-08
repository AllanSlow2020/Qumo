"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { invite } from "./actions";
import { IDLE, type TeamActionState } from "./state";
import { TempPassword } from "./temp-password";

export function InviteForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<TeamActionState, FormData>(invite, IDLE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="cn-panel-body">
      {state.ok === true && state.temporaryPassword && (
        <TempPassword password={state.temporaryPassword} email={state.forEmail} />
      )}

      <form ref={formRef} action={action} className="cn-form">
        <div className="cn-field">
          <label htmlFor="invite-name">Name</label>
          <input id="invite-name" name="name" className="cn-input" required maxLength={120} />
        </div>

        <div className="cn-field">
          <label htmlFor="invite-email">Work email</label>
          <input id="invite-email" name="email" className="cn-input" type="email" required maxLength={200} />
          <p className="cn-label">This is what they sign in with. We don&apos;t send email - you pass on the password.</p>
        </div>

        <div className="cn-field">
          <label htmlFor="invite-role">Role</label>
          <select id="invite-role" name="role" className="cn-input" defaultValue="MARKETING">
            <option value="OWNER">Owner - everything, including the team</option>
            <option value="ADMIN">Admin - everything except the team</option>
            <option value="MARKETING">Marketing - promotions and reporting</option>
            <option value="QUALITY">Quality - reporting only</option>
          </select>
        </div>

        {state.ok === false && (
          <p className="cn-err" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="cn-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "Adding…" : "Add to the team"}
        </button>
      </form>
    </div>
  );
}
