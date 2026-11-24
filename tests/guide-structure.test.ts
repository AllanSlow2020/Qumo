import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { setupSteps } from "@/lib/console/setup-state";
import { ANCHORS, STEPS } from "@/app/console/(authed)/(gated)/guide/steps";

// Built from its code point so this file is not itself an offender; see no-em-dashes.test.ts.
const EM_DASH = String.fromCharCode(0x2014);

/**
 * The shape of the How to use the console page.
 *
 * Six steps in an order, one open at a time, the first open on arrival, and a
 * set of addresses that other screens link into. These hold the three
 * together: the steps are the Overview's checklist, the page puts every
 * address on an element exactly once, and nothing elsewhere in the console
 * links to an address the page does not have.
 */

const GUIDE = "app/console/(authed)/(gated)/guide";
const PAGE = readFileSync(`${GUIDE}/page.tsx`, "utf8");
const LIST = readFileSync(`${GUIDE}/how-steps.tsx`, "utf8");

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

describe("the steps", () => {
  it("are the Overview checklist, in its order and in its words", () => {
    const checklist = setupSteps({
      campaigns: 0,
      campaignsWithRule: 0,
      campaignsWithBudget: 0,
      activeCampaigns: 0,
      packBatches: 0,
      signingStores: 0,
      everAwarded: false,
    });
    expect(STEPS.map((s) => s.title)).toEqual(checklist.map((s) => s.title));
    expect(STEPS.map((s) => s.text)).toEqual(checklist.map((s) => s.detail));
    expect(STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("each have a short line, at least one screen and at least one way in", () => {
    for (const s of STEPS) {
      expect(s.sub.length).toBeGreaterThan(0);
      expect(s.sub.length).toBeLessThanOrEqual(60);
      expect(s.screens.length).toBeGreaterThan(0);
      expect(s.actions.length).toBeGreaterThan(0);
      for (const a of s.actions) expect(a.href.startsWith("/")).toBe(true);
    }
  });

  it("keep the product's voice: no em dashes, no exclamation marks", () => {
    for (const s of STEPS) {
      for (const text of [s.title, s.sub, s.text]) {
        expect(text).not.toContain(EM_DASH);
        expect(text).not.toContain("!");
      }
    }
  });

  it("share one name, so opening one closes the others, and only the first starts open", () => {
    expect(LIST).toMatch(/name="how-steps"/);
    expect(LIST).toMatch(/open=\{step\.n === 1\}/);
  });
});

describe("the addresses", () => {
  it("are each on the page exactly once", () => {
    for (const id of ANCHORS) {
      const found = PAGE.match(new RegExp(`id="${id}"`, "g")) ?? [];
      expect(found, `id="${id}"`).toHaveLength(1);
    }
  });

  it("take the honour window from the code that enforces it", () => {
    expect(PAGE).toMatch(/days=\{HONOUR_WINDOW_DAYS\}/);
  });
});

describe("links into the guide from the rest of the console", () => {
  it("all point at an address the page has", () => {
    const files = walk("app").filter((f) => !f.includes("/guide/"));
    const found: { file: string; id: string }[] = [];
    for (const file of files) {
      for (const m of readFileSync(file, "utf8").matchAll(/\/guide#([a-z-]+)/g)) found.push({ file, id: m[1]! });
    }
    // There are some today; the point is that none of them has gone stale.
    expect(found.length).toBeGreaterThan(0);
    for (const { file, id } of found) {
      expect(ANCHORS as readonly string[], `${file} links to /guide#${id}`).toContain(id);
    }
  });
});
