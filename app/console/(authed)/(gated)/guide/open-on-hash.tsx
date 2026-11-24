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
 * It also keeps a step in view as it opens. Steps slide open and shut together
 * (console.css, "motion"), so opening one below the open step pulls the page up
 * under the pointer; once the slide is done, a step whose head has ended up
 * off screen is brought back, and one that is already in view is left alone.
 *
 * It renders nothing. It runs on load and again when the address changes, which
 * is what a link to another part of this page does.
 */

/** A little over the slide in console.css, so the layout has settled before the page is moved. */
const SLIDE_MS = 320;
export function OpenOnHash() {
  useEffect(() => {
    // While a link is landing, the page is being taken somewhere on purpose.
    let landingUntil = 0;

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
      landingUntil = Date.now() + 1500;
      // Twice, so what was just opened has been laid out and there is a page tall enough to scroll to it.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => target.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" })),
      );
      // Whatever was open above is still closing, which moves the target. Once it has, land exactly.
      if (!calm) window.setTimeout(() => target.scrollIntoView({ block: "start", behavior: "auto" }), SLIDE_MS);
    };

    const keepInView = (e: Event) => {
      const step = e.target;
      if (!(step instanceof HTMLDetailsElement) || !step.open || !step.classList.contains("cn-how-item")) return;
      if (Date.now() < landingUntil || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      window.setTimeout(() => step.querySelector("summary")?.scrollIntoView({ block: "nearest", behavior: "smooth" }), SLIDE_MS);
    };

    go();
    window.addEventListener("hashchange", go);
    document.addEventListener("toggle", keepInView, true);
    return () => {
      window.removeEventListener("hashchange", go);
      document.removeEventListener("toggle", keepInView, true);
    };
  }, []);
  return null;
}
