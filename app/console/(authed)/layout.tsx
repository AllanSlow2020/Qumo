import Link from "next/link";
import { redirect } from "next/navigation";
import { PRODUCT_NAME } from "@/lib/product";
import { prisma } from "@/lib/db/client";
import { getStaffSession } from "@/lib/staff/session";
import { getTheme } from "@/lib/theme";
import { toggleTheme } from "@/app/theme-actions";
import { signOut } from "./actions";
import { ConsoleNav } from "./console-nav";
import { QumoMark } from "../qumo-mark";

/**
 * Everything behind the login, and the only place that check lives.
 *
 * A route group rather than a call at the top of each page: a page that
 * renders under here is a page that had a live session, so the next screen
 * somebody adds cannot forget. The proxy already redirected anyone with no
 * cookie at all; this is the half that runs in Node and can actually ask the
 * database, so it is what catches a revoked session, an expired one, and a
 * deactivated account.
 */
export default async function AuthedConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession();
  if (!session) {
    redirect("/login");
  }

  // The brand's name for the masthead, so a staff member can see at a glance
  // whose data they are looking at. Read via the session's brandId, which
  // came from the user row - never from the URL.
  const brand = await prisma.brand.findUnique({
    where: { id: session.brandId },
    select: { name: true },
  });

  // The console is dark unless somebody has said otherwise, so an unset
  // cookie is dark and the button offers the other one. The same cookie and
  // the same action the shopper surface uses - it is set on <html> in the
  // root layout, which is above both.
  const theme = await getTheme();

  return (
    <>
      {/* Two rows, not one.
          Nine nav items, an identity and a sign-out do not fit on one line
          at 1280px: the nav clipped mid-word into the brand name. Splitting
          identity from navigation is also the more honest structure - who
          you are signed in as does not belong in the same row as where you
          can go. */}
      <header className="cn-top">
        <div className="cn-top-in">
          <Link href="/" className="cn-mark" style={{ textDecoration: "none" }}>
            <QumoMark />
            <span className="cn-mark-sr">{PRODUCT_NAME}</span>
            <span>console</span>
          </Link>
          <div className="cn-who">
            <div>{brand?.name ?? "-"}</div>
            <div>
              {session.name} · {session.role.toLowerCase()} ·{" "}
              <Link href="/change-password">password</Link> · <Link href="/security">security</Link>
            </div>
          </div>
          <form action={toggleTheme}>
            <button type="submit" className="cn-theme">
              {/* Unset means light, so an unset preference is offered dark.
                  Reading the other way round labelled a light console
                  "Light", which is the state it is already in. */}
              {theme === "dark" ? "Light" : "Dark"}
            </button>
          </form>
          <form action={signOut}>
            <button type="submit" className="cn-btn cn-btn-quiet">
              Sign out
            </button>
          </form>
        </div>
        <div className="cn-nav-row">
          <ConsoleNav />
        </div>
      </header>
      <main className="cn-main">{children}</main>
    </>
  );
}
