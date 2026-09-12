"use client";

import { useState, useTransition } from "react";
import { provision, type ProvisionResult } from "./actions";

/**
 * The form that creates a tenant.
 *
 * The interesting part is what happens after success. The temporary
 * password exists in exactly one place - this response - and is never
 * recoverable, so the screen has to say that loudly and stop offering to
 * create another brand over the top of it. A form that quietly reset itself
 * here would lose the one thing the operator came for.
 */
export function ProvisionForm({ rootDomain }: { rootDomain: string }) {
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Every field is controlled, which is not the usual choice for a form
   * posting to a server action and is the right one here.
   *
   * React resets an uncontrolled <form action={...}> once the action
   * resolves, including when it resolved by refusing. Getting the setup key
   * wrong therefore wiped the brand name, the owner and their email, and the
   * operator got to type all four again. That is a small thing on a form
   * somebody fills once a year, and it was the first thing that happened
   * when this was actually driven.
   */
  const [fields, setFields] = useState({
    secret: "",
    name: "",
    slug: "",
    ownerName: "",
    ownerEmail: "",
  });
  const set = (key: keyof typeof fields) => (event: { target: { value: string } }) =>
    setFields((f) => ({
      ...f,
      [key]: key === "slug" ? event.target.value.toLowerCase() : event.target.value,
    }));

  function submit(formData: FormData) {
    startTransition(async () => setResult(await provision(formData)));
  }

  if (result?.ok) {
    return (
      <div className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">{result.brandName} is live</h2>
        </div>
        <div className="cn-panel-body">
          <p className="cn-body">
            Send these to the owner. The password is shown once and cannot be recovered.
          </p>

          <dl className="cn-handover">
            <dt>Their site</dt>
            <dd className="cn-mono">{result.shopperUrl}</dd>
            <dt>Console</dt>
            <dd className="cn-mono">{result.consoleUrl}</dd>
            <dt>Sign in as</dt>
            <dd className="cn-mono">{result.ownerEmail}</dd>
            <dt>One-time password</dt>
            <dd className="cn-mono cn-secret-value">{result.temporaryPassword}</dd>
          </dl>

          <p className="cn-label">
            They will be asked to choose their own password at first sign-in, and nothing in the
            console works until they have.
          </p>
          {/* A full reload rather than clearing state, so nobody lands back
              on a filled form and wonders whether it submitted twice. */}
          <a className="cn-btn cn-btn-quiet" href="/provision">
            Set up another brand
          </a>
        </div>
      </div>
    );
  }

  return (
    <section className="cn-panel">
      <div className="cn-panel-body">
        <form action={submit} className="cn-form">
          <div className="cn-field">
            <label htmlFor="secret">Setup key</label>
            <input
              id="secret"
              name="secret"
              type="password"
              className="cn-input"
              autoComplete="off"
              value={fields.secret}
              onChange={set("secret")}
              required
            />
            <p className="cn-label">
              From the deployment&apos;s environment. Not a password anybody signs in with.
            </p>
          </div>

          <div className="cn-field">
            <label htmlFor="name">Brand name</label>
            <input
              id="name"
              name="name"
              className="cn-input"
              placeholder="Chicken Licken"
              value={fields.name}
              onChange={set("name")}
              required
            />
          </div>

          <div className="cn-field">
            <label htmlFor="slug">Address</label>
            <input
              id="slug"
              name="slug"
              className="cn-input"
              value={fields.slug}
              onChange={set("slug")}
              placeholder="chicken-licken"
              required
            />
            {/* Shown as they type, because this is the one field that cannot be
            changed later without dead-ending every poster and slip already
            printed. Better to see it before committing than after. */}
            <p className="cn-label">
              Lower-case letters, numbers and hyphens. This becomes{" "}
              <span className="cn-mono">
                {fields.slug || "their-name"}.{rootDomain}
              </span>{" "}
              and goes into every QR code they ever print, so it cannot be changed afterwards.
            </p>
          </div>

          <div className="cn-field">
            <label htmlFor="ownerName">First owner</label>
            <input
              id="ownerName"
              name="ownerName"
              className="cn-input"
              placeholder="Their name"
              value={fields.ownerName}
              onChange={set("ownerName")}
              required
            />
          </div>

          <div className="cn-field">
            <label htmlFor="ownerEmail">Their email</label>
            <input
              id="ownerEmail"
              name="ownerEmail"
              type="email"
              className="cn-input"
              value={fields.ownerEmail}
              onChange={set("ownerEmail")}
              required
            />
            <p className="cn-label">
              What they sign in with. We don&apos;t send email, so you pass the password on
              yourself.
            </p>
          </div>

          <button type="submit" className="cn-btn" disabled={pending}>
            {pending ? "Setting up…" : "Set up the brand"}
          </button>

          {result && !result.ok && <p className="cn-err">{result.error}</p>}
        </form>
      </div>
    </section>
  );
}
