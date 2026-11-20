"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { DEFAULT_OPEN, SECTION_IDS } from "./sections";

/**
 * Which sections are open, and which one is being read.
 *
 * The page is seven sections that each lead with their point and fold their
 * detail away. Folding is only useful if everything that wants to open a
 * section can: the section's own header, a link in the "Where to start" strip,
 * the reading rail, a link someone was sent. So the state lives here and each
 * of those asks it, rather than each holding its own idea of what is open.
 *
 * ── What is stored, and what is worked out ───────────────────────────────
 *
 * Only what the reader has done is stored: `override`, a section's open state
 * when they have set it themselves. Everything else is worked out when it is
 * asked for. A section is open if the reader said so, and otherwise if it is
 * open by default or the address is pointing at it. That is why a link to
 * #cost opens it on first load with no effect and no second render, and why
 * a reader who has closed a section is not fought by a default.
 *
 * The address is read as an external store (useSyncExternalStore) for the same
 * reason as use-hydrated.ts: the server renders with no hash, the first client
 * render matches it, and the real value arrives after, without a mismatch.
 *
 * ── Why the content stays in the page ────────────────────────────────────
 *
 * Closed sections are native <details>, so the content is in the document and
 * the browser's own find, anchor and print all still reach it. Nothing is
 * unmounted on close, which is also why the calculator keeps the numbers a
 * reader had set when they come back to it.
 */

type GuideState = {
  isOpen: (id: string) => boolean;
  /** The reader opened or closed one. */
  setOpen: (id: string, open: boolean) => void;
  /** Something wants this section shown: a link, the rail. */
  reveal: (id: string) => void;
  /** Open it and take the reader there. What the rail does. */
  go: (id: string) => void;
  setAll: (open: boolean) => void;
  allOpen: boolean;
  current: string;
  /** True for the moment a jump is opening a section, so it opens without the animation. */
  jumping: boolean;
};

const GuideContext = createContext<GuideState | null>(null);

export function useGuide(): GuideState {
  const ctx = useContext(GuideContext);
  if (!ctx) throw new Error("useGuide must be used inside GuideProvider");
  return ctx;
}

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const getHash = () => window.location.hash.slice(1);

/** Smooth unless the reader has asked their system for less motion. */
function scrollToSection(id: string, smooth: boolean) {
  const behavior = smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto";
  document.getElementById(id)?.scrollIntoView({ block: "start", behavior });
}
const getServerHash = () => "";

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [observed, setObserved] = useState<string>(SECTION_IDS[0]!);
  const [jumping, setJumping] = useState(false);
  const hash = useSyncExternalStore(subscribeHash, getHash, getServerHash);

  const isOpen = (id: string) => override[id] ?? (DEFAULT_OPEN.includes(id) || hash === id);

  const setOpen = (id: string, open: boolean) =>
    setOverride((prev) => (prev[id] === open ? prev : { ...prev, [id]: open }));

  const reveal = (id: string) => {
    setOpen(id, true);
    setObserved(id);
  };

  /*
   * Opened first, scrolled to second, and the order is the point. With most
   * sections folded the page is short, so a link that scrolls before the
   * section has opened is clamped by the end of the page and lands the heading
   * halfway down the window. Opening in the same tick (flushSync) gives the
   * page the height the jump needs before it jumps.
   *
   * The address is written with replaceState, which fires no hashchange, so
   * this is the only thing that handles the click and nothing opens twice.
   */
  const go = (id: string) => {
    // `jumping` switches the open animation off for this one open. Animated,
    // the section is still growing when the page scrolls, which is the same
    // clamp again: the height the jump needs arrives 300ms after it.
    flushSync(() => {
      setJumping(true);
      reveal(id);
    });
    // Smooth, because it is a deliberate move to somewhere else on the page and
    // an instant cut reads as the page jumping. The section is already full
    // height by now, so the scroll has somewhere to go.
    scrollToSection(id, true);
    window.history.replaceState(null, "", `#${id}`);
    requestAnimationFrame(() => setJumping(false));
  };

  /*
   * Open or fold every section, without moving the one being read.
   *
   * Folding seven sections removes thousands of pixels, most of them above or
   * below the reader, and the browser keeps the scroll offset, so whatever was
   * on screen is replaced by whatever now sits at that offset. So the section
   * being read is measured before and put back after: its header ends up where
   * it was under the reader's eye. Instant, for the same reason as `go`: an
   * animation over this much height is not a transition, it is a blur.
   */
  const setAll = (open: boolean) => {
    const anchor = document.getElementById(observed);
    const before = anchor?.getBoundingClientRect().top ?? 0;
    // The browser adjusts the scroll position by itself when content above the
    // viewport changes height (scroll anchoring). Left on, it and the
    // correction below both act and the section overshoots, so it is off for
    // the length of this one change.
    const root = document.documentElement;
    root.style.overflowAnchor = "none";
    flushSync(() => {
      setJumping(true);
      setOverride(Object.fromEntries(SECTION_IDS.map((id) => [id, open])));
    });
    if (anchor) window.scrollBy(0, anchor.getBoundingClientRect().top - before);
    requestAnimationFrame(() => {
      setJumping(false);
      root.style.overflowAnchor = "";
    });
  };

  /*
   * A link to a section from anywhere on the page, the start cards included,
   * goes through `go`. Left alone, the browser jumps first, instantly and
   * against a short page, and then the open-and-scroll corrects it a moment
   * later: two movements where there should be one smooth one.
   */
  const onClick = (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = (e.target as HTMLElement).closest("a")?.getAttribute("href");
    if (!href?.startsWith("#") || !SECTION_IDS.includes(href.slice(1))) return;
    e.preventDefault();
    go(href.slice(1));
  };

  // A link to a section the reader closed earlier still opens it: they asked
  // to go there. Listening is the effect; the state change is in the handler.
  useEffect(() => {
    const onHash = () => {
      const id = window.location.hash.slice(1);
      if (SECTION_IDS.includes(id)) {
        setJumping(true);
        setOverride((prev) => (prev[id] === true ? prev : { ...prev, [id]: true }));
        setObserved(id);
        // After the open has rendered, for the reason given at `go` above: the
        // browser has already jumped, against a page that was too short. Two
        // frames, so React has committed the open before this looks.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            scrollToSection(id, false);
            setJumping(false);
          }),
        );
      }
    };
    // Once now as well: arriving by a client-side link to /guide#cost fires no
    // hashchange, and the page would otherwise open on a closed section.
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Which section is being read: the first one crossing a band near the top of
  // the window. Where none is (above the first, or between two) the last stays.
  useEffect(() => {
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const first = SECTION_IDS.find((id) => visible.has(id));
        if (first) setObserved(first);
      },
      { rootMargin: "-12% 0px -68% 0px" },
    );
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  const allOpen = SECTION_IDS.every(isOpen);

  return (
    <GuideContext.Provider value={{ isOpen, setOpen, reveal, go, setAll, allOpen, current: observed, jumping }}>
      {/* Contents, so it adds no box of its own to the page's layout and exists
          only to hear clicks. */}
      <div style={{ display: "contents" }} onClick={onClick}>
        {children}
      </div>
    </GuideContext.Provider>
  );
}
