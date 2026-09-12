import { describe, expect, it } from "vitest";
import { brandSlugFromHost, RESERVED_SUBDOMAINS } from "@/lib/brand/host";
import { brandStyle, safeColor, safeLogoUrl, toBrandTheme } from "@/lib/brand/theme";

/**
 * Which brand a request is for is decided entirely by these two files, and
 * everything else in the product trusts the answer. No database here on
 * purpose - this is the pure half, and it is the half that has to be right
 * before the impure half can be safe.
 */
describe("reading a brand out of a host", () => {
  const ROOT = "qumo.co.za";

  it("takes the one label in front of the root domain", () => {
    expect(brandSlugFromHost("chicken-licken.qumo.co.za", ROOT)).toBe("chicken-licken");
    expect(brandSlugFromHost("campari.qumo.co.za", ROOT)).toBe("campari");
  });

  it("ignores the port, the case, and a trailing dot", () => {
    // A browser sends none of these three. A health check, a proxy and a
    // crafted request each send one, and "Brand.Qumo.co.za." must not be a
    // different brand than "brand.qumo.co.za".
    expect(brandSlugFromHost("Chicken-Licken.Qumo.CO.ZA:443", ROOT)).toBe("chicken-licken");
    expect(brandSlugFromHost("chicken-licken.qumo.co.za.", ROOT)).toBe("chicken-licken");
  });

  it("finds no brand at the apex", () => {
    expect(brandSlugFromHost("qumo.co.za", ROOT)).toBeNull();
    expect(brandSlugFromHost("www.qumo.co.za", ROOT)).toBeNull();
  });

  it("refuses every reserved subdomain", () => {
    // Enforced here rather than only at sign-up, so a row written straight
    // into the database still cannot take the console's address.
    for (const reserved of RESERVED_SUBDOMAINS) {
      expect(brandSlugFromHost(`${reserved}.qumo.co.za`, ROOT)).toBeNull();
    }
  });

  it("refuses a host deeper than one label", () => {
    // The attack this exists for: anyone who controls a domain can point
    // evil.chicken-licken.example.com at us. Only exactly-one-label-deep
    // resolves, so a nested host names no brand rather than the brand whose
    // name it happens to contain.
    expect(brandSlugFromHost("evil.chicken-licken.qumo.co.za", ROOT)).toBeNull();
    expect(brandSlugFromHost("a.b.qumo.co.za", ROOT)).toBeNull();
  });

  it("refuses a host that is not ours at all", () => {
    expect(brandSlugFromHost("chicken-licken.evil.com", ROOT)).toBeNull();
    // The near miss that a naive endsWith() would accept: a domain that
    // merely ends in our name.
    expect(brandSlugFromHost("notqumo.co.za", ROOT)).toBeNull();
    expect(brandSlugFromHost("chicken-licken.notqumo.co.za", ROOT)).toBeNull();
    expect(brandSlugFromHost("197.242.94.1", ROOT)).toBeNull();
    expect(brandSlugFromHost("qumo-git-main.vercel.app", ROOT)).toBeNull();
  });

  it("finds no brand in nothing", () => {
    expect(brandSlugFromHost(null, ROOT)).toBeNull();
    expect(brandSlugFromHost("", ROOT)).toBeNull();
    expect(brandSlugFromHost(".qumo.co.za", ROOT)).toBeNull();
    expect(brandSlugFromHost("-bad-.qumo.co.za", ROOT)).toBeNull();
  });

  it("works on localhost, because that is where it gets developed", () => {
    // *.localhost resolves to 127.0.0.1 in every current browser, so this is
    // a real local brand host and not a test-only fiction.
    expect(brandSlugFromHost("chicken-licken.localhost:3000", "localhost")).toBe("chicken-licken");
    expect(brandSlugFromHost("localhost:3000", "localhost")).toBeNull();
  });
});

describe("what a brand is allowed to put on the page", () => {
  it("accepts a plain six-digit hex colour and nothing else", () => {
    expect(safeColor("#E4002B")).toBe("#e4002b");
    expect(safeColor("#fff")).toBeNull();
    expect(safeColor("red")).toBeNull();
    expect(safeColor("rgb(255,0,0)")).toBeNull();
  });

  it("refuses a colour that tries to leave the declaration", () => {
    // The reason this is a match and not a sanitiser. Each of these is a
    // valid-ish CSS fragment, and the middle one calls home from every
    // shopper's phone.
    expect(safeColor("red;background:url(https://evil.example/?c=x)")).toBeNull();
    expect(safeColor("#000}body{display:none}")).toBeNull();
    expect(safeColor("url(https://evil.example/pixel.png)")).toBeNull();
    expect(safeColor("#e4002b /* */")).toBeNull();
  });

  it("accepts only an absolute https logo", () => {
    expect(safeLogoUrl("https://cdn.example/licken.svg")).toBe("https://cdn.example/licken.svg");
    // Inert in a modern browser, and still not something to hand to an img.
    expect(safeLogoUrl("javascript:alert(1)")).toBeNull();
    expect(safeLogoUrl("data:image/svg+xml,<svg onload=alert(1)/>")).toBeNull();
    // Not an attack - a mixed-content block, which presents as a brand with
    // no logo and nobody knowing why. Better to fall back deliberately.
    expect(safeLogoUrl("http://cdn.example/licken.svg")).toBeNull();
    expect(safeLogoUrl("/logo.svg")).toBeNull();
  });

  it("falls back to a correct plain page rather than a half-painted one", () => {
    const theme = toBrandTheme({
      id: "b1",
      slug: "chicken-licken",
      name: "Chicken Licken Holdings (Pty) Ltd",
      displayName: "Chicken Licken",
      tagline: null,
      logoUrl: "http://insecure.example/logo.png",
      accentColor: "not-a-colour",
      accentInkColor: "#ffffff",
      accentColorDark: null,
      accentInkColorDark: null,
      displayFont: null,
      figureFont: null,
      supportEmail: null,
      supportUrl: null,
    });

    expect(theme.name).toBe("Chicken Licken");
    expect(theme.logoUrl).toBeNull();
    expect(theme.accent).toBeNull();
    // Ink only means anything against an accent. Kept on its own it would
    // recolour the default black button's text and could land white on white.
    expect(theme.accentInk).toBeNull();
    expect(brandStyle(theme)).toBeUndefined();
  });

  it("overrides only what the brand actually chose", () => {
    const theme = toBrandTheme({
      id: "b1",
      slug: "chicken-licken",
      name: "Chicken Licken",
      displayName: null,
      tagline: "Soul food since 1981",
      logoUrl: null,
      accentColor: "#E4002B",
      accentInkColor: "#FFFFFF",
      accentColorDark: null,
      accentInkColorDark: null,
      displayFont: null,
      figureFont: null,
      supportEmail: null,
      supportUrl: null,
    });

    // A brand owns the element that says what happens next, and the type it
    // is read in. It does not get to recolour the ground or the rules, so it
    // cannot make its own programme unreadable.
    //
    // No font in this row, so no font token: an override that is not asked
    // for is not written, which is what lets the default in globals.css
    // apply with no cascade to reason about.
    //
    // Under its own name rather than --sc-btn directly, which is what lets
    // shopper.css decide per theme. See brandStyle().
    expect(brandStyle(theme)).toEqual({ "--sc-brand-accent": "#e4002b", "--sc-brand-ink": "#ffffff" });
  });
});
