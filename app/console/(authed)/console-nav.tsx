"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The console's navigation, and the only reason it is a client component.
 *
 * Marking the current page needs the path, and the path is only knowable in
 * the browser. It is worth the boundary: a nav with nine items and no
 * indication of where you are makes somebody re-read all nine to find out,
 * and `aria-current` is what a screen reader announces for the same
 * question. The styling hangs off the same attribute rather than a class of
 * its own, so the two can never disagree.
 */

const ITEMS: { href: string; label: string }[] = [
  { href: "/", label: "Overview" },
  { href: "/performance", label: "Performance" },
  { href: "/promotions", label: "Promotions" },
  { href: "/stores", label: "Stores" },
  { href: "/codes", label: "Pack codes" },
  { href: "/people", label: "Team" },
  { href: "/activity", label: "Activity" },
  { href: "/settings", label: "Programme" },
  { href: "/billing", label: "Plan" },
];

/**
 * Whether `href` is the section the current path sits in.
 *
 * Prefix matching for everything except the overview, so a detail page
 * under /stores still shows Stores as current. "/" would prefix-match every
 * path in the console, so it is the one exact comparison.
 */
function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ConsoleNav() {
  const pathname = usePathname();

  return (
    <nav className="cn-nav" aria-label="Console sections">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
