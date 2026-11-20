import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The shopper screens' text colours against the surfaces they sit on.
 *
 * The usability audit found the tertiary grey (#8a8a90) at 3.4:1 on white, and
 * the dark one (#71717a) at 4.1:1, both under the 4.5:1 small text needs. It
 * carries the small print a shopper actually reads: dates, labels, the
 * "powered by" line, input placeholders. Values are read from shopper.css, so
 * this tests what ships.
 */

const CSS = readFileSync("app/(shopper)/shopper.css", "utf8");

/** Every `--sc-x: #hex` declaration, in file order. */
function declarations(name: string): string[] {
  return [...CSS.matchAll(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`, "g"))].map((m) => m[1]!);
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c((n >> 16) & 255) + 0.7152 * c((n >> 8) & 255) + 0.0722 * c(n & 255);
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// shopper.css declares light once, then dark twice (OS setting, explicit choice).
const light = 0;
const darkOs = 1;
const darkChosen = 2;

describe("shopper text colours", () => {
  const sets: [string, number][] = [
    ["light", light],
    ["dark (system setting)", darkOs],
    ["dark (chosen)", darkChosen],
  ];

  for (const [name, i] of sets) {
    for (const text of ["--sc-ink", "--sc-ink-2", "--sc-ink-3", "--sc-neg"]) {
      for (const ground of ["--sc-bg", "--sc-raised"]) {
        it(`${name}: ${text} on ${ground} is at least 4.5:1`, () => {
          const grounds = declarations(ground);
          // The dark blocks do not redeclare the raised-or-bg tokens identically
          // in every case, so a missing one is a failure, not a skip.
          const fg = declarations(text)[i === light ? 0 : i];
          const bg = grounds[i];
          expect(fg, `${text} (${name})`).toBeDefined();
          expect(bg, `${ground} (${name})`).toBeDefined();
          expect(ratio(fg!, bg!)).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});
