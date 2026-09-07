/**
 * The gate on everything under /dev.
 *
 * These pages hand out signed till slips - the exact artefact the whole
 * verification scheme exists to make unforgeable. In development that is
 * the point: without a way to produce a valid slip you cannot use the
 * product, only look at it. In production it would be a machine for
 * minting balance.
 *
 * So the gate is deliberately blunt and in one place. NODE_ENV is set by
 * the build, not by a request, and `next build` sets it to "production" -
 * there is no header, cookie or query string that reaches this.
 *
 * A 404 rather than a 403: a 403 confirms the route exists.
 */
export function devOnly(): boolean {
  return process.env.NODE_ENV !== "production";
}
