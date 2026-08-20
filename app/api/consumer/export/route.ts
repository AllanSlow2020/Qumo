import { NextResponse } from "next/server";
import { exportPerson } from "@/lib/consumer/export";
import { getConsumerSession } from "@/lib/consumer/session";

/**
 * A shopper downloading everything held about them.
 *
 * A route rather than a server action because the answer is a file, and a
 * server action cannot set Content-Disposition. The identity comes from the
 * session cookie and nothing in the request selects whose data this is —
 * there is no id to pass, so there is no id to tamper with.
 *
 * no-store because the response is one person's complete personal record;
 * a shared cache holding it would be the worst possible thing to get wrong
 * about a privacy feature.
 */
export async function GET(): Promise<NextResponse> {
  const personId = await getConsumerSession();
  if (!personId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const data = await exportPerson(personId);
  if (!data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="qumo-my-data-${stamp}.json"`,
      "Cache-Control": "no-store, private",
    },
  });
}
