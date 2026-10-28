import { describe, expect, it } from "vitest";
import { consoleUiMode } from "@/lib/console/ui-mode";

describe("which editor shell to draw", () => {
  it("defaults to what ships when nothing asks otherwise", () => {
    expect(consoleUiMode(undefined)).toBe("stacked");
    expect(consoleUiMode("")).toBe("stacked");
    expect(consoleUiMode("   ")).toBe("stacked");
  });

  it("opts in on the exact word", () => {
    expect(consoleUiMode("drawer")).toBe("drawer");
    expect(consoleUiMode("DRAWER")).toBe("drawer");
    expect(consoleUiMode(" drawer ")).toBe("drawer");
  });

  it("treats anything else as the shipped layout rather than as truthy", () => {
    // ?ui=1 names no mode. Landing on the candidate because a key was
    // present would make a typo in a shared link change what a colleague
    // is looking at without telling them.
    for (const raw of ["1", "true", "modal", "stacked", "drawr"]) {
      expect(consoleUiMode(raw)).toBe("stacked");
    }
  });

  it("takes the first value when a link repeats the parameter", () => {
    expect(consoleUiMode(["drawer", "stacked"])).toBe("drawer");
    expect(consoleUiMode(["stacked", "drawer"])).toBe("stacked");
    expect(consoleUiMode([])).toBe("stacked");
  });
});
