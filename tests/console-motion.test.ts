import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The motion added to things that open and things that list.
 *
 * Every rule that moves something belongs inside a no-preference block, so a
 * reader who has asked for reduced motion gets the finished page and not a
 * page with its animations half switched off. What is held here is that
 * placement, read from console.css so it tests what ships.
 */

const CSS = readFileSync("app/console/console.css", "utf8");

/** The text between the braces of the first block that opens with `head`. */
function block(head: string): string {
  const at = CSS.indexOf(head);
  if (at < 0) throw new Error(`no block ${head}`);
  const open = CSS.indexOf("{", at);
  let depth = 0;
  let end = open;
  for (; end < CSS.length; end++) {
    if (CSS[end] === "{") depth++;
    else if (CSS[end] === "}" && --depth === 0) break;
  }
  return CSS.slice(open + 1, end);
}

describe("motion that opens and lists", () => {
  const moving = block("@media (prefers-reduced-motion: no-preference) {\n  /* A fold opens");

  it("slides a fold open by height", () => {
    expect(moving).toMatch(/interpolate-size:\s*allow-keywords/);
    for (const fold of [".cn-how-item", ".cn-how-more", ".cn-setup-more"]) {
      expect(moving, fold).toContain(`${fold}::details-content`);
    }
    expect(moving).toMatch(/block-size 280ms/);
  });

  it("brings in what is inside a step, and the rows of a table, in order", () => {
    expect(moving).toMatch(/\.cn-how-item\[open\] > \.cn-how-body > \* \{ animation: cn-rise/);
    expect(moving).toMatch(/\.cn-table tbody tr \{ animation: cn-rise/);
  });

  it("keeps the moving rules out of the rest of the file", () => {
    const outside = CSS.replace(moving, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(outside).not.toMatch(/::details-content/);
    expect(outside).not.toMatch(/\.cn-table tbody tr[^{]*\{[^}]*animation/);
  });
});
