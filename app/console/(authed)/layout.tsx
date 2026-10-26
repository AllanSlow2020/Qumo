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
    // accentColor is not displayed. It answers "has this brand been set up
    // yet", which decides whether there is anywhere to navigate to - see
    // the nav below. Selected here rather than in a second query because
    // this one is already being made.
    select: { name: true, accentColor: true },
  });

  /**
   * A brand that has not chosen its colours yet is held on /setup by the
   * gate in (gated)/layout.tsx, so every nav item would bounce straight
   * back to the screen they are already on. Offering nine of those is
   * offering nine dead ends, and it makes a one-step setup look like a
   * console somebody is locked out of. The nav appears when it leads
   * somewhere.
   */
  const setUp = brand?.accentColor != null;

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
        {setUp && (
          <div className="cn-nav-row">
            <ConsoleNav />
          </div>
        )}
      </header>
      <main className="cn-main">{children}</main>
    </>
  );
}
