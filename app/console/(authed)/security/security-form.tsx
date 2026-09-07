"use client";

import { useActionState, useEffect, useState } from "react";
import { formatSecretForDisplay } from "@/lib/staff/totp";
import { confirmCode, newRecoveryCodes, startEnrolment, turnOff } from "./actions";
import { IDLE, type SecurityState } from "./state";

export function SecurityForm({
  enabled,
  recoveryCodesLeft,
}: {
  enabled: boolean;
  recoveryCodesLeft: number;
}) {
  const [state, setState] = useState<SecurityState>(IDLE);
  const [starting, setStarting] = useState(false);

  if (state.step === "codes") {
    return <RecoveryCodes codes={state.codes} />;
  }

  if (state.step === "confirm") {
    return <Confirm state={state} onState={setState} />;
  }

  if (enabled && state.step !== "done") {
    return <TurnOff recoveryCodesLeft={recoveryCodesLeft} onState={setState} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {state.error && (
        <p className="cn-err" role="alert">
          {state.error}
        </p>
      )}
      {state.step === "done" && <p className="cn-body">Two-factor authentication is off for your account.</p>}
      <button
        type="button"
        className="cn-btn"
        disabled={starting}
        style={{ alignSelf: "flex-start" }}
        onClick={async () => {
          setStarting(true);
          setState(await startEnrolment());
          setStarting(false);
        }}
      >
        {starting ? "Setting up…" : "Turn on two-factor authentication"}
      </button>
    </div>
  );
}

function Confirm({
  state,
  onState,
}: {
  state: Extract<SecurityState, { step: "confirm" }>;
  onState: (next: SecurityState) => void;
}) {
  const [result, action, pending] = useActionState(confirmCode, state);

  // In an effect, not during render. Handing the new state up mid-render is
  // a setState on a parent while a child is rendering - React warns about
  // it today and reserves the right to make it fatal, and it is the kind of
  // thing that works in development and tears on a slow phone.
  useEffect(() => {
    if (result !== state && result.step !== "confirm") {
      onState(result);
    }
  }, [result, state, onState]);

  return (
    <form action={action} className="cn-form">
      <p className="cn-body">
        Add this to your authenticator app - 1Password, Google Authenticator, Authy, whichever you already use - then
        type the six digits it shows.
      </p>

      <div className="cn-field">
        <span className="cn-label">Setup key</span>
        <p className="cn-secret-value" style={{ userSelect: "all" }}>
          {formatSecretForDisplay(state.secret)}
        </p>
        <p className="cn-label" style={{ marginTop: 6 }}>
          Most apps also accept this as a link: <span className="cn-mono">{state.otpauth}</span>
        </p>
      </div>

      <div className="cn-field">
        <label htmlFor="code">The six digits from your app</label>
        <input
          id="code"
          name="code"
          className="cn-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          required
          autoFocus
        />
      </div>

      {result.error && (
        <p className="cn-err" role="alert">
          {result.error}
        </p>
      )}

      <button type="submit" className="cn-btn" disabled={pending}>
        {pending ? "Checking…" : "Confirm and finish"}
      </button>
    </form>
  );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p className="cn-body">
        <strong>Save these somewhere safe now.</strong> Each one signs you in once if you lose your phone, and this is
        the only time they are shown. Reloading this page will not bring them back.
      </p>
      <div className="cn-secret">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 8,
          }}
        >
          {codes.map((code) => (
            <span key={code} className="cn-mono" style={{ userSelect: "all", fontSize: 15 }}>
              {code}
            </span>
          ))}
        </div>
      </div>
      <p className="cn-label">Using one signs you out everywhere else, so a lost phone cannot stay signed in.</p>
    </div>
  );
}

function TurnOff({
  recoveryCodesLeft,
  onState,
}: {
  recoveryCodesLeft: number;
  onState: (next: SecurityState) => void;
}) {
  const [offState, offAction, offPending] = useActionState(turnOff, IDLE);
  const [codesState, codesAction, codesPending] = useActionState(newRecoveryCodes, IDLE);

  useEffect(() => {
    if (offState.step === "done") onState(offState);
    else if (codesState.step === "codes") onState(codesState);
  }, [offState, codesState, onState]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <p className="cn-body">
        Two-factor authentication is on. You have{" "}
        <strong>
          {recoveryCodesLeft} recovery code{recoveryCodesLeft === 1 ? "" : "s"}
        </strong>{" "}
        left.
        {recoveryCodesLeft <= 2 && (
          <> That is not many - generate a fresh set before you need one.</>
        )}
      </p>

      <form action={codesAction} className="cn-form">
        <div className="cn-field">
          <label htmlFor="regen-password">Your password, to generate new recovery codes</label>
          <input
            id="regen-password"
            name="password"
            className="cn-input"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {codesState.error && (
          <p className="cn-err" role="alert">
            {codesState.error}
          </p>
        )}
        <button type="submit" className="cn-btn cn-btn-quiet" disabled={codesPending}>
          {codesPending ? "Generating…" : "Generate new recovery codes"}
        </button>
      </form>

      <form action={offAction} className="cn-form">
        <div className="cn-field">
          <label htmlFor="off-password">Your password, to turn two-factor off</label>
          <input
            id="off-password"
            name="password"
            className="cn-input"
            type="password"
            autoComplete="current-password"
            required
          />
          <p className="cn-label" style={{ marginTop: 6 }}>
            {/* Says why we ask, rather than just asking. */}
            Asked for so an open console left on a desk can&apos;t be used to strip the second factor off your account.
          </p>
        </div>
        {offState.error && (
          <p className="cn-err" role="alert">
            {offState.error}
          </p>
        )}
        <button type="submit" className="cn-btn cn-btn-quiet" disabled={offPending}>
          {offPending ? "Turning off…" : "Turn off two-factor authentication"}
        </button>
      </form>
    </div>
  );
}
