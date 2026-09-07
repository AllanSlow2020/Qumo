import type { Instrumentation } from "next";
import { reportError } from "@/lib/observability/report";

/**
 * Next's own hook for "something threw and the framework handled it".
 *
 * This is the seam that closes the gap. Every server error - a page that
 * throws while rendering, a server action that rejects, a route handler
 * that blows up - arrives here with the route that produced it, whether or
 * not anybody wrote a try/catch. Before this file existed, all of that
 * produced a digest for the user and nothing for us.
 *
 * The request's headers are deliberately not passed on. They carry the
 * session cookie, and an error report is not a place to put one.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  await reportError(err, {
    where: `${request.method} ${request.path}`,
    detail: {
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    },
  });
};

/**
 * Required for the instrumentation file to be picked up. Nothing to set up
 * - the reporter has no client to initialise - so this exists to say so out
 * loud once per boot, which is also how you tell from a log whether the
 * hook is installed at all.
 */
export function register(): void {
  console.info(
    JSON.stringify({
      message: "error reporting installed",
      meta: { webhook: process.env.ERROR_WEBHOOK_URL ? "configured" : "not configured" },
    }),
  );
}
