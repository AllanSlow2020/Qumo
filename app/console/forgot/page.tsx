import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/product";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: `Forgotten password · ${PRODUCT_NAME}` };

/**
 * Outside (authed) and public in the proxy, because somebody who cannot
 * sign in cannot be asked to sign in first.
 *
 * The hole this fills is narrower than it looks. An owner could already
 * reset a colleague; the person with nobody to ask was the only owner of a
 * brand.
 */
export default function ForgotPage() {
  return (
    <div className="cn-login">
      <div className="cn-login-card">
        <h1 className="cn-h1">Forgotten password</h1>
        <p className="cn-body">We will email you a link to choose a new one.</p>
        <ForgotForm />
      </div>
    </div>
  );
}
