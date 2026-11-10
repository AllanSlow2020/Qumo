import { requireStaff } from "@/lib/staff/current";
import { getSecondFactorState } from "@/lib/staff/mfa";
import { secondFactorRequired } from "@/lib/staff/mfa-policy";
import { SecurityForm } from "./security-form";

/**
 * Your own account's second factor.
 *
 * Outside the (gated) group on purpose, beside change-password: somebody
 * whose programme has closed still has an account, and locking them out of
 * their own security settings while leaving the account signed-in-able would
 * be exactly backwards.
 */
export default async function ConsoleSecurityPage() {
  const staff = await requireStaff({ allowPendingSecondFactor: true });
  const state = await getSecondFactorState(staff.userId);
  const required = secondFactorRequired(staff.role);

  /*
   * Somebody sent here by the gate arrived mid-task, having clicked
   * something else entirely. Saying so is the difference between a screen
   * that explains itself and a redirect that looks like a bug.
   */
  const owed = required && !state.enabled;

  return (
    <>
      <h1 className="cn-h1">Your sign-in security</h1>

      {owed && (
        /* The leading-edge rule that console.css already defines for a
           notice, rather than a tinted panel or a class invented here. */
        <p className="cn-body cn-note-warn" role="status" style={{ marginBottom: 12 }}>
          Set this up to carry on. Your role can change what the programme is, not just run it, so the console
          asks for a second factor before it will let you back in. It takes about a minute and you only do it
          once.
        </p>
      )}

      <p className="cn-body">
        Your account can create promotions that award real money, rotate the secrets that make a till slip
        trustworthy, and see everyone who shops with this brand. A second factor means a stolen password is not
        enough on its own.
      </p>

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">Two-factor authentication</h2>
          <span className={state.enabled ? "cn-pill cn-pill-ok" : "cn-pill cn-pill-off"}>
            {state.enabled ? "On" : "Off"}
          </span>
        </div>
        <div style={{ padding: "16px" }}>
          <SecurityForm
            enabled={state.enabled}
            recoveryCodesLeft={state.recoveryCodesLeft}
            required={required}
          />
        </div>
      </section>
    </>
  );
}
