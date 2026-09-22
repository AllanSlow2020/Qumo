"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { FailureNotice } from "./failure-notice";

/**
 * The boundary that catches almost everything.
 *
 * Placed at the root segment rather than inside each surface on purpose. An
 * error.tsx catches what its *children* throw, never what its own layout
 * throws, and the layouts are where the failure that prompted this actually
 * happens: app/(shopper)/layout.tsx resolves the brand from the database on
 * every request, so when the database is unreachable the shopper layout is
 * what fails. A boundary inside that group would never see it. This one
 * does, because the root layout above it reads only a cookie.
 *
 * ── Why the retry is not just reset() ────────────────────────────────────
 *
 * This was a bug before it was a comment, and it only showed up when the
 * button was clicked in a real browser against a real outage.
 *
 * Next hands this a `reset`, and the obvious thing is to wire it to the
 * button. It does not work here. `reset` re-renders the client tree from
 * what the client already has, and what failed was a *server* render: the
 * page is the result of a request that came back 500, so re-rendering it
 * produces the same 500's worth of nothing and the boundary immediately
 * catches itself again. The reader clicks, sees no change, and concludes
 * the button is decoration. It was.
 *
 * `router.refresh()` is the half that actually goes back to the server for
 * a fresh payload. Both are needed and they go in one transition: refresh
 * fetches, reset clears the boundary, and doing them together means the
 * reader sees the page or sees this again, rather than a flash of one and
 * then the other.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <FailureNotice
      digest={error.digest}
      onRetry={() =>
        startTransition(() => {
          router.refresh();
          reset();
        })
      }
    />
  );
}
