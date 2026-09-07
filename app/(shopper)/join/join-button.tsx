"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { join } from "./actions";

/**
 * Opts in, then goes to the wallet — or to sign-in first, carrying the
 * destination so the shopper comes back here rather than being dropped
 * somewhere they did not ask for.
 *
 * Navigation is on the client for the same reason sign-out's is: a
 * redirect() from a server action resolves against the wrong origin on a
 * subdomain-per-brand deployment and loses the brand.
 */
export function JoinButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className="sc-btn"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const outcome = await join();
          if (outcome === "NEEDS_SIGN_IN") {
            router.push(`/wallet/login?next=${encodeURIComponent("/join")}`);
          } else {
            router.push("/wallet");
          }
          router.refresh();
        })
      }
    >
      {pending ? "Joining…" : label}
    </button>
  );
}
