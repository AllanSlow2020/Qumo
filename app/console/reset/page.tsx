import Link from "next/link";
import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/product";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: `Choose a password · ${PRODUCT_NAME}` };

/**
 * The other end of the emailed link.
 *
 * The token is not checked here, only carried. Validating it on render
 * would mean a preview fetch by a mail client or a link scanner could tell
 * somebody it was valid, and would burn a working link before its owner
 * clicked it. It is spent once, in the action, when a password is actually
 * submitted.
 */
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";

  return (
    <div className="cn-login">
      <div className="cn-login-card">
        <h1 className="cn-h1">Choose a password</h1>
        {token ? (
          <ResetForm token={token} />
        ) : (
          <>
            <p className="cn-body">That link is missing its code. Open the one from the email exactly as it was sent.</p>
            <Link className="cn-btn cn-btn-quiet" href="/forgot">
              Ask for a new link
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
