"use client";

import { useEffect } from "react";

/**
 * Opens whatever holds the address in the URL, and scrolls to it.
 *
 * The steps and the folds inside them are plain <details> elements, so the
 * browser already opens one when you click its summary and, because the steps
 * share a name, closes the others. What it does not do is open the one that
 * holds a link's target, and the console links into this page from four
 * screens (`/guide#cost` and the rest). So this walks up from the target and
 * opens every <details> on the way, then scrolls once they have laid out.
 *
 * It renders nothing. It runs on load and again when the address changes, which
 * is what a link to another part of this page does.
 */
export function OpenOnHash() {
  useEffect(() => {
    const go = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      if (target instanceof HTMLDetailsElement) target.open = true;
      for (let el = target.parentElement; el; el = el.parentElement) {
        if (el instanceof HTMLDetailsElement) el.open = true;
      }
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // Twice, so what was just opened has been laid out and there is a page tall enough to scroll to it.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => target.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" })),
      );
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, []);
  return null;
}
