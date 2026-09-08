import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No em dashes. Anywhere.
 *
 * A house style rule rather than a technical one, and it is a test because
 * that is the only form a style rule survives in. Asking people to remember
 * works until the day somebody does not, and the place it surfaces is a
 * screen in front of a customer.
 *
 * The rule covers everything the repository ships: shopper copy, console
 * copy, the terms, the documentation, and the comments. It is deliberately
 * not limited to user-facing strings, because a comment is read by whoever
 * writes the next screen and sets the tone for what they type.
 *
 * En dashes and the box-drawing rules used in comment banners are a
 * different character and are left alone.
 */
// Built from its code point rather than typed, so this file is not itself
// an offender: the walk below covers every tracked file, this one included.
const EM_DASH = String.fromCharCode(0x2014);
const ROOT = path.resolve(__dirname, "..");

/** Tracked files only, so node_modules and build output are out of scope by construction. */
function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((f) => !f.endsWith("pnpm-lock.yaml"));
}

describe("house style", () => {
  it("has no em dashes in anything the repository ships", () => {
    const offenders: string[] = [];

    for (const rel of trackedFiles()) {
      let text: string;
      try {
        text = readFileSync(path.join(ROOT, rel), "utf8");
      } catch {
        continue; // a path that is not a readable text file
      }
      if (!text.includes(EM_DASH)) continue;

      text.split("\n").forEach((line, i) => {
        if (line.includes(EM_DASH)) offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 90)}`);
      });
    }

    // Named rather than counted: a failure should say where to go, not how
    // many there are.
    expect(offenders, `Use a plain hyphen instead:\n${offenders.join("\n")}`).toEqual([]);
  });
});
