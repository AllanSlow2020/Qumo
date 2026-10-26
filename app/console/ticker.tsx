"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * A figure that counts up to itself.
 *
 * ── Why it takes the finished string ─────────────────────────────────────
 *
 * Every number on this console is already formatted by the time it reaches
 * a screen, and formatted several different ways: "R3068.45" is assembled
 * by hand in formatLedgerAmount, "1 234" comes from toLocaleString, and
 * "286 stamps" and "R123.45 · 286 stamps" are both strings with more than
 * one number in them. Passing a raw value and a formatter would mean
 * teaching this component every one of those, and teaching it again each
 * time somebody adds a unit.
 *
 * So it takes the finished text and animates the digits inside it, leaving
 * everything else exactly where it is. "R3068.45" counts the 3068.45,
 * "286 stamps" counts the 286, "-" does nothing at all.
 *
 * ── Why the server still renders the real number ─────────────────────────
 *
 * The value passed in is what is rendered on the server and what the first
 * client render produces, so the markup matches and hydration is clean -
 * and a browser with JavaScript off, or one that fails to run it, shows the
 * true figure rather than a zero. The animation is decoration layered on
 * afterwards; the number is never the animation's to get right.
 *
 * ── Why it ends on the original string ───────────────────────────────────
 *
 * The last frame assigns the text it was given, verbatim, rather than
 * reformatting the final value. Intermediate frames only have to look
 * plausible; the one that stays on screen has to be exactly right, and the
 * only way to guarantee that is not to compute it. en-ZA alone would
 * otherwise be a trap: it groups with a non-breaking space and uses a comma
 * for the decimal point, so a number rebuilt with the wrong assumption
 * settles on a figure that reads as ten times itself.
 */

const DURATION_MS = 760;

/*
 * How late is too late to start counting.
 *
 * The server renders the real figure and the browser paints it before React
 * has hydrated, so the count-up necessarily begins after the true number
 * has already been on screen for a moment. While that moment is short it is
 * hidden under the card's own fade-in, and the whole thing reads as the
 * figure settling.
 *
 * On a slow device it is not short. Hydration lands a second in, somebody
 * has read the number, and resetting it to zero to count back up to the
 * same figure is worse than never animating at all - it looks like the page
 * lost the value. So past this point the animation is simply skipped, which
 * also means the slowest devices do the least work.
 *
 * It doubles as the guard against re-animating on every save: the console
 * calls router.refresh() after each one, and performance.now() is long past
 * this by then.
 */
const ENTRANCE_WINDOW_MS = 420;

/* Digits, the separators that can sit between them, and at most one decimal
   mark - which is "." in a hand-built "R3068.45" and "," in anything that
   went through en-ZA. Both are accepted because both appear on this page.
 *
 * Two deliberate restrictions, both found by watching it run rather than by
 * reading it:
 *
 * A separator only counts when digits follow it. A looser class swallowed
 * the trailing space of "286 stamps" into the match, so every frame of the
 * animation rendered "110stamps" and only the final one, which is assigned
 * verbatim, looked right.
 *
 * An ordinary space is not a separator at all. en-ZA groups with a
 * non-breaking space, so an ASCII space between digits means two numbers,
 * and reading it as grouping would turn "5 10" into five hundred and ten. */
const NUMBER = /\d+(?:[\u00A0\u202F]\d+)*(?:[.,]\d+)?/g;

type Run = { text: string; value: number; decimals: number; grouped: boolean };

function readRuns(text: string): Run[] {
  return [...text.matchAll(NUMBER)].map((m) => {
    const raw = m[0];
    const bare = raw.replace(/[\u00A0\u202F]/g, "");
    const mark = /[.,]/.exec(bare);
    const decimals = mark ? bare.length - mark.index - 1 : 0;
    return {
      text: raw,
      value: Number(bare.replace(",", ".")),
      decimals,
      grouped: raw !== bare,
    };
  });
}

function render(run: Run, value: number): string {
  if (run.grouped) {
    return value.toLocaleString("en-ZA", {
      minimumFractionDigits: run.decimals,
      maximumFractionDigits: run.decimals,
    });
  }
  const fixed = value.toFixed(run.decimals);
  // A hand-built figure keeps whichever mark it arrived with.
  return run.text.includes(",") ? fixed.replace(".", ",") : fixed;
}

/** Fast at the start, settling at the end, which is how a total behaves. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// useLayoutEffect on the client so the first animated frame is painted
// instead of the final value flashing once before the animation starts.
// useEffect on the server, where useLayoutEffect warns and neither runs.
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function Ticker({ value }: { value: string }) {
  // Seeded with the finished text, so the server's markup and the first
  // client render are the same string.
  const [shown, setShown] = useState(value);
  const frame = useRef(0);

  useBeforePaint(() => {
    // Always land on the current value, whatever happens below. This is
    // also the whole implementation for somebody who asked for less motion.
    setShown(value);

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || performance.now() > ENTRANCE_WINDOW_MS) return;

    const runs = readRuns(value);
    if (runs.length === 0) return;

    // Nothing to count up to.
    if (runs.every((r) => r.value === 0)) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      if (t >= 1) {
        // Verbatim, not rebuilt. See the note at the top.
        setShown(value);
        return;
      }
      const eased = easeOut(t);
      /* The runs come back in the order replace() walks them, so an index
         is enough to pair each match with the value it was read from.
         Sharing one global regex between matchAll and replace is safe:
         matchAll clones it, and replace resets lastIndex when it finishes. */
      let i = 0;
      setShown(
        value.replace(NUMBER, (match) => {
          const run = runs[i++];
          return run ? render(run, run.value * eased) : match;
        }),
      );
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame.current);
  }, [value]);

  return <>{shown}</>;
}
