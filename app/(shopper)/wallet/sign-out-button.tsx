"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * A button that ends a session and then navigates.
 *
 * The navigation is here, on the client, rather than a redirect() in the
 * action — see the note in actions.ts. router.replace() rather than push()
 * so the back button does not return to a wallet the shopper no longer has
 * a session for.
 */
export function SignOutButton({
  action,
  children,
  variant = "ghost",
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  variant?: "ghost" | "quiet";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className={`sc-btn sc-btn-${variant}`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await action();
          router.replace("/wallet/login");
          // The destination reads the session cookie on the server, and that
          // cookie was just cleared — refresh so it renders against the new
          // state rather than a cached signed-in view.
          router.refresh();
        })
      }
    >
      {children}
    </button>
  );
}
