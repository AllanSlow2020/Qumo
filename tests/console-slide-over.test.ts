import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The slide-over's sizes and breakpoint.
 *
 * It has two fixed widths and one rule about when it stops being a side panel,
 * and all three are single numbers in console.css. They are the kind of value
 * that drifts when somebody makes a panel "just a bit wider" for one screen, so
 * they are held here. Read from console.css, so this tests what ships.
 */

const CSS = readFileSync("app/console/console.css", "utf8");

/** The declarations of the first top-level rule whose selector is exactly `selector`. */
function rule(selector: string, source = CSS): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(source);
  if (!m) throw new Error(`no rule for ${selector}`);
  return m[1]!;
}

/** The text between the braces of the first `@media` block whose condition is exactly `query` and that contains `needle`. */
function media(query: string, needle: string): string {
  let from = 0;
  for (;;) {
    const at = CSS.indexOf(`@media ${query} {`, from);
    if (at < 0) throw new Error(`no @media ${query} block containing ${needle}`);
    const open = CSS.indexOf("{", at);
    let depth = 0;
    let end = open;
    for (; end < CSS.length; end++) {
      if (CSS[end] === "{") depth++;
      else if (CSS[end] === "}" && --depth === 0) break;
    }
    const body = CSS.slice(open + 1, end);
    if (body.includes(needle)) return body;
    from = end;
  }
}

describe("slide-over", () => {
  it("is 480px wide by default", () => {
    expect(rule(".cn-slide")).toMatch(/width:\s*min\(480px,\s*100vw\)/);
  });

  it("is 720px wide at most, and never more than 60% of the window", () => {
    expect(rule('.cn-slide[data-size="wide"]')).toMatch(/width:\s*min\(720px,\s*60vw\)/);
  });

  it("has a Close button at least 44px tall", () => {
    const m = /min-height:\s*(\d+)px/.exec(rule(".cn-slide-close"));
    expect(m, "no min-height in px").not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(44);
  });

  it("becomes a bottom sheet below 1100px, for both sizes", () => {
    const sheet = media("(max-width: 1099.98px)", ".cn-slide");
    expect(sheet).toContain('.cn-slide[data-size="wide"]');
    expect(sheet).toMatch(/border-radius:\s*18px 18px 0 0/);
    expect(sheet).toMatch(/translate:\s*0 100%/);
  });

  it("stops travelling when the reader asks for reduced motion", () => {
    const reduced = media("(prefers-reduced-motion: reduce)", ".cn-slide[open]");
    expect(reduced).toMatch(/\.cn-slide::backdrop/);
    expect(reduced).toMatch(/transition:\s*none/);
  });
});
