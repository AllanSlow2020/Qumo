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
 *
 * ── Why it is grouped, and why down the side ─────────────────────────────
 *
 * Nine items in one row is a list you read left to right every time,
 * because nothing about the order tells you where to look. The same nine in
 * three named groups is three short lists, and the heading answers most of
 * the question before you read any item: somebody after their scan figures
 * reads "Measure" and stops.
 *
 * Down the side rather than across the top because this is a desk tool read
 * on a wide screen, where horizontal space is what there is most of and
 * vertical space is what the tables want. It also ends the problem the old
 * two-row masthead existed to work around: nine items, an identity and a
 * sign-out did not fit on one line at 1280px.
 */

type Item = { href: string; label: string; icon: React.ReactNode };
type Group = { heading: string; items: Item[] };

/** Stroke icons on a 16 box, so they sit with the label rather than on it. */
const icon = (paths: React.ReactNode) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {paths}
  </svg>
);

const GROUPS: Group[] = [
  {
    heading: "Measure",
    items: [
      {
        href: "/",
        label: "Overview",
        icon: icon(
          <>
            <rect x="2" y="2" width="5" height="5" rx="1" />
            <rect x="9" y="2" width="5" height="5" rx="1" />
            <rect x="2" y="9" width="5" height="5" rx="1" />
            <rect x="9" y="9" width="5" height="5" rx="1" />
          </>,
        ),
      },
      {
        href: "/performance",
        label: "Performance",
        icon: icon(<path d="M2 13V7M6 13V3M10 13V9M14 13V5" />),
      },
      {
        href: "/activity",
        label: "Activity",
        icon: icon(
          <>
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v3.4l2.2 1.3" />
          </>,
        ),
      },
    ],
  },
  {
    heading: "Running it",
    items: [
      {
        href: "/promotions",
        label: "Promotions",
        icon: icon(<path d="M2.5 6.5 8 2l5.5 4.5V13a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" />),
      },
      {
        href: "/codes",
        label: "Pack codes",
        icon: icon(
          <>
            <rect x="2" y="2" width="4.5" height="4.5" />
            <rect x="9.5" y="2" width="4.5" height="4.5" />
            <rect x="2" y="9.5" width="4.5" height="4.5" />
            <path d="M9.5 9.5h2v2h-2zM12.5 12.5H14V14h-1.5z" />
          </>,
        ),
      },
      {
        href: "/stores",
        label: "Stores",
        icon: icon(
          <>
            <path d="M2 6h12v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
            <path d="M2 6 3.5 2.5h9L14 6" />
          </>,
        ),
      },
    ],
  },
  {
    heading: "Settings",
    items: [
      {
        href: "/people",
        label: "Team",
        icon: icon(
          <>
            <circle cx="6" cy="6" r="2.6" />
            <path d="M1.6 13.4c.6-2.3 2.3-3.6 4.4-3.6s3.8 1.3 4.4 3.6" />
            <path d="M11 4.2a2.2 2.2 0 0 1 0 4.1" />
          </>,
        ),
      },
      {
        href: "/settings",
        label: "Programme",
        icon: icon(
          <>
            <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
            <path d="M5.5 8h5M5.5 11h3M5.5 5h5" />
          </>,
        ),
      },
      {
        href: "/billing",
        label: "Plan",
        icon: icon(
          <>
            <rect x="1.8" y="4" width="12.4" height="8.5" rx="1.6" />
            <path d="M1.8 7h12.4" />
          </>,
        ),
      },
    ],
  },
  {
    /* Its own group with one item in it, and that is the point: it is not a
       thing you run or measure, so putting it among the pages that do would
       cost a reader a beat every time they scanned the list for a real
       destination. It is also where a second item would go if this grows. */
    heading: "Help",
    items: [
      {
        href: "/guide",
        label: "How it works",
        icon: icon(
          <>
            <circle cx="8" cy="8" r="6" />
            <path d="M6.2 6.1a1.85 1.85 0 0 1 3.6.6c0 1.2-1.8 1.5-1.8 2.6" />
            <path d="M8 11.6h.01" />
          </>,
        ),
      },
    ],
  },
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
      {GROUPS.map((group) => (
        <div className="cn-nav-group" key={group.heading}>
          {/* A heading rather than a label on each item: it answers "which
              kind of thing is this" once instead of nine times. */}
          <h2 className="cn-nav-head">{group.heading}</h2>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
