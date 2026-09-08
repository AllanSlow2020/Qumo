import { redirect } from "next/navigation";
import { getConsumerSession } from "@/lib/consumer/session";

/**
 * The bare address, typed rather than scanned.
 *
 * Almost nobody arrives here - the whole product is reached by pointing a
 * camera at something, and every one of those codes carries a path. But
 * "almost nobody" is not nobody: a shopper who saw the address on a poster
 * and typed it later, or who bookmarked it, lands exactly here, and until
 * now they got a login form. That was the proxy doing its job on a route
 * nobody had thought about - `/` was not in the public list, so a request
 * with no session was bounced to /wallet/login, which asks for a phone
 * number before saying what the offer is. The join page exists precisely so
 * that never happens.
 *
 * So: a returning shopper gets their balance, and everyone else gets the
 * page that explains the programme. Neither of them gets a form first.
 *
 * A redirect rather than a copy of either page, because two routes
 * rendering the same thing is two routes to keep in step, and the address
 * a shopper ends up on is the one worth bookmarking.
 */
export default async function BrandHomePage() {
  const personId = await getConsumerSession();
  redirect(personId ? "/wallet" : "/join");
}
