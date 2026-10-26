"use client";

import { FailureNotice } from "./failure-notice";

/**
 * The last resort: the root layout itself failed, so there is no <html> to
 * render into and this has to supply one.
 *
 * Should almost never be reached. app/layout.tsx reads a cookie and nothing
 * else, so the realistic causes are a font module or the stylesheet import
 * failing rather than anything to do with data. It exists because the
 * alternative when it is reached is Next's own unstyled error page, and the
 * cost of having it is one file.
 *
 * The retry is a full page load rather than the refresh-and-reset pair that
 * app/error.tsx uses. Nothing above this rendered, so there is no router
 * context to ask for a refresh and nothing partial worth preserving. A
 * reload is both the simplest thing and the most likely to work.
 *
 * Note this replaces the root layout, which means globals.css is not applied
 * here. FailureNotice carries its own styles, which is why.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <FailureNotice digest={error.digest} onRetry={() => window.location.reload()} />
      </body>
    </html>
  );
}
