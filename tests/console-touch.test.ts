import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The console sidebar's tap targets.
 *
 * The usability audit measured the nav links at 34px, the brand mark at 18px
 * and the password and security links at 14px, against the 44px the design
 * system sets as its floor. They are one-line CSS values, which is the size of
 * change that drifts back when somebody tightens the sidebar, so the floor is
 * held here. Read from console.css, so this tests what ships.
 */

const CSS = readFileSync("app/console/console.css", "utf8");

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(CSS);
  if (!m) throw new Error(`no rule for ${selector}`);
  return m[1]!;
}

function minHeight(selector: string): number {
  const m = /min-height:\s*(\d+)px/.exec(rule(selector));
  if (!m) throw new Error(`${selector} sets no min-height in px`);
  return Number(m[1]);
}

describe("sidebar tap targets", () => {
  it.each([".cn-nav a", ".cn-side .cn-mark", ".cn-side-links a"])("%s is at least 44px tall", (selector) => {
    expect(minHeight(selector)).toBeGreaterThanOrEqual(44);
  });
});
