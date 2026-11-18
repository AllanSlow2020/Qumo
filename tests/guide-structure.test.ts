import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_OPEN, SECTIONS, SECTION_IDS, TOTAL_MINS } from "@/app/console/(authed)/(gated)/guide/sections";

/**
 * The shape of the How it works page.
 *
 * Seven sections, each with a one-line point, a read time and an address that
 * other pages link into. These hold the three together: the rail is built
 * from the same list as the sections, so what is checked here is that the page
 * really uses every entry once, that nothing elsewhere in the console links to
 * a section that does not exist, and that the points follow the voice the rest
 * of the product keeps.
 */

const PAGE = readFileSync("app/console/(authed)/(gated)/guide/page.tsx", "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(path, out);
    } else if (/\.(tsx?|mdx?)$/.test(name)) out.push(path);
  }
  return out;
}

describe("the sections", () => {
  it("have unique addresses and read times worth showing", () => {
    expect(new Set(SECTION_IDS).size).toBe(SECTIONS.length);
    for (const s of SECTIONS) {
      expect(s.mins).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(s.mins)).toBe(true);
      expect(s.title.length).toBeGreaterThan(0);
    }
    expect(TOTAL_MINS).toBe(SECTIONS.reduce((n, s) => n + s.mins, 0));
  });

  it("are each on the page exactly once, in the order the rail lists them", () => {
    const used = [...PAGE.matchAll(/<FoldSection id="([a-z]+)"/g)].map((m) => m[1]);
    expect(used).toEqual(SECTION_IDS);
  });

  it("open by default only on sections that exist", () => {
    for (const id of DEFAULT_OPEN) expect(SECTION_IDS).toContain(id);
  });
});

describe("the one-line points", () => {
  const points = [...PAGE.matchAll(/<FoldSection id="[a-z]+" point=(?:"([^"]+)"|\{`([^`]+)`\})/g)].map((m) => m[1] ?? m[2]!);

  it("there is one for every section", () => {
    expect(points).toHaveLength(SECTIONS.length);
  });

  it("are one sentence each, and short enough to skim", () => {
    for (const p of points) {
      expect(p.length).toBeLessThanOrEqual(100);
      expect(p.endsWith(".")).toBe(true);
      // One sentence: nothing but the closing full stop.
      expect(p.slice(0, -1)).not.toMatch(/[.!?]\s/);
    }
  });

  it("keep the product's voice: no em dashes, no exclamation marks", () => {
    for (const p of points) {
      expect(p).not.toMatch(/[—–]/);
      expect(p).not.toContain("!");
    }
  });

  it("take the honour window from the code that enforces it", () => {
    expect(PAGE).toMatch(/\$\{HONOUR_WINDOW_DAYS\}/);
  });
});

describe("links into the guide from the rest of the console", () => {
  it("all point at a section that exists", () => {
    const files = walk("app").filter((f) => !f.includes("/guide/"));
    const found: { file: string; id: string }[] = [];
    for (const file of files) {
      for (const m of readFileSync(file, "utf8").matchAll(/\/guide#([a-z-]+)/g)) found.push({ file, id: m[1]! });
    }
    // There are some today; the point is that none of them has gone stale.
    expect(found.length).toBeGreaterThan(0);
    for (const { file, id } of found) {
      expect(SECTION_IDS, `${file} links to /guide#${id}`).toContain(id);
    }
  });
});
