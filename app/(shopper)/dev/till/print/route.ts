import { randomUUID } from "node:crypto";
import { devOnly } from "@/lib/dev/guard";

/**
 * Mint one slip and send you to it.
 *
 * The transaction id cannot be generated while the till page renders -
 * React refuses an impure render, and it is right to: every re-render
 * produced a different slip, so the QR could change while a phone was
 * pointed at it and the thing you scanned was not the thing on screen.
 *
 * It is a route handler rather than a server action because the server
 * action version did not stay on the brand's host. Printing a slip on
 * chicken-licken.localhost:3000 produced a render on localhost:3000 -
 * a host that names no brand - so the answer to "print a slip" was "this
 * link needs a brand". The Location below is relative, and a browser
 * resolves a relative Location against the address it asked for, so
 * whatever host you print from is the host you land on. That property is
 * worth more here than knowing exactly which layer lost the hostname.
 */
export async function GET(request: Request): Promise<Response> {
  if (!devOnly()) return new Response("Not found", { status: 404 });

  const params = new URL(request.url).searchParams;
  const target = new URLSearchParams({
    store: params.get("store") ?? "",
    cents: params.get("cents") ?? "",
    txn: `TILL-${randomUUID().slice(0, 8).toUpperCase()}`,
  });

  return new Response(null, {
    status: 303,
    headers: { Location: `/dev/till?${target.toString()}`, "cache-control": "no-store" },
  });
}
