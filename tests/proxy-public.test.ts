import { describe, expect, it } from "vitest";
import { isPublic } from "@/proxy";

/**
 * Which shopper-surface paths are served without a session.
 *
 * This list is the boundary between "a page somebody can read before they
 * have told us anything" and "a page about one person". Both mistakes are
 * quiet: a public asset behind the session check is redirected to a login
 * and disappears from the page that needed it, and a private route in front
 * of it is readable by anyone who types the address.
 */
describe("the shopper surface's public paths", () => {
  it("serves a brand's logo to somebody with no session", () => {
    // The join page and the login page are both public and both put the
    // brand's logo at the top. Behind the session check the image request
    // was redirected to /wallet/login, so a brand's own customers met a
    // wordmark on the two screens where the logo is doing the most work.
    expect(isPublic("/api/brand-logo")).toBe(true);
  });

  it("serves the pages a stranger is meant to land on", () => {
    for (const path of ["/", "/join", "/wallet/login", "/s/K7M2-P9QR-3XVW", "/r", "/legal/privacy", "/api/health"]) {
      expect(isPublic(path), path).toBe(true);
    }
  });

  it("does not serve anything about a person", () => {
    for (const path of ["/wallet", "/wallet/me", "/api/brand-logo/../wallet", "/api/export"]) {
      expect(isPublic(path), path).toBe(false);
    }
  });
});
