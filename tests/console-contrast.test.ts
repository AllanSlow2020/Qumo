import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The console's text colours against the surfaces they sit on.
 *
 * An accessibility audit of the live console found two tokens below the 4.5:1
 * that small text needs: the secondary grey (4.35:1 on the page grey) and the
 * status green (3.0:1), which together failed 30 elements on 8 screens. They
 * are two lines of CSS, which is exactly the size of change that drifts back
 * the next time somebody likes a lighter grey, so the ratios are held here.
 *
 * The values are read from console.css, so this tests what ships.
 */

const CSS = readFileSync("app/console/console.css", "utf8");

function block(selector: string): Record<string, string> {
  const start = CSS.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`no block for ${selector}`);
  const end = CSS.indexOf("\n}\n", start);
  const out: Record<string, string> = {};
  for (const m of CSS.slice(start, end).matchAll(/(--cn-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]!] = m[2]!;
  return out;
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

const themes: [string, Record<string, string>][] = [
  ["light", block(".cn")],
  ["dark", block(':root[data-theme="dark"] .cn')],
];

describe.each(themes)("%s theme", (_name, t) => {
  for (const text of ["--cn-ink", "--cn-ink-2", "--cn-ink-3", "--cn-pos"]) {
    for (const ground of ["--cn-bg", "--cn-surface", "--cn-raised"]) {
      it(`${text} on ${ground} is at least 4.5:1`, () => {
        expect(t[text], `${text} not found`).toBeDefined();
        expect(t[ground], `${ground} not found`).toBeDefined();
        expect(ratio(t[text]!, t[ground]!)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe("a title for every console screen", () => {
  // Screens share a layout title ("Console · Qumo"), which is no help in a row
  // of tabs. Each page file names itself.
  function pages(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) pages(p, out);
      else if (name === "page.tsx") out.push(p);
    }
    return out;
  }

  it("every page.tsx exports its own metadata", () => {
    const all = pages("app/console");
    const missing = all.filter((f) => !readFileSync(f, "utf8").includes("export const metadata"));
    // Dynamic children (a batch's labels, its tags) inherit their list's title.
    const unnamed = missing.filter((f) => !f.includes("["));
    expect(unnamed, `pages with no title: ${unnamed.join(", ")}`).toEqual([]);
    expect(all.length).toBeGreaterThan(10);
  });
});
