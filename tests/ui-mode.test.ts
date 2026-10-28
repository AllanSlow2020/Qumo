import { describe, expect, it } from "vitest";
import { consoleUiMode } from "@/lib/console/ui-mode";

describe("which editor shell to draw", () => {
  it("defaults to the drawer, which is what ships", () => {
    expect(consoleUiMode(undefined)).toBe("drawer");
    expect(consoleUiMode("")).toBe("drawer");
    expect(consoleUiMode("   ")).toBe("drawer");
  });

  it("falls back to the old layout on the exact word", () => {
    expect(consoleUiMode("stacked")).toBe("stacked");
    expect(consoleUiMode("STACKED")).toBe("stacked");
    expect(consoleUiMode(" stacked ")).toBe("stacked");
  });

  it("treats anything else as the default rather than as truthy", () => {
    // ?ui=1 names no mode. Dropping somebody onto the old layout because a
    // key was present would make a typo in a shared link change what a
    // colleague is looking at without telling them.
    for (const raw of ["1", "true", "modal", "drawer", "stackd"]) {
      expect(consoleUiMode(raw)).toBe("drawer");
    }
  });

  it("takes the first value when a link repeats the parameter", () => {
    expect(consoleUiMode(["stacked", "drawer"])).toBe("stacked");
    expect(consoleUiMode(["drawer", "stacked"])).toBe("drawer");
    expect(consoleUiMode([])).toBe("drawer");
  });
});
