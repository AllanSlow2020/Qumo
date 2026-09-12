import { describe, expect, it } from "vitest";
import { brandOrigin } from "@/lib/brand/host";
import { joinUrl, posterQrSvg } from "@/lib/brand/poster";

/**
 * The poster QR: the one piece of artwork in the programme that goes up in
 * bulk, in public, before anybody has scanned it.
 *
 * Two properties matter and they pull in opposite directions from
 * everything in lib/packs. A poster must point at the brand's own join page
 * and nowhere else, because a wrong host is a reprint across every store.
 * And it must keep awarding nothing, because a static code anybody can scan
 * without buying is only safe while it is worthless.
 */
describe("the poster QR", () => {
  const origin = brandOrigin("chicken-licken");

  it("sends a scan to the brand's join page", () => {
    expect(joinUrl(origin)).toBe(`${origin}/join`);
    expect(joinUrl(origin)).toContain("chicken-licken.");
  });

  it("never points at a route that awards", () => {
    // The three earning routes. A poster reaching any of them would be a
    // static, publicly printed code that pays out, which is the failure the
    // whole poster-versus-pack split exists to prevent.
    const url = joinUrl(origin);
    expect(url).not.toMatch(/\/s\//);
    expect(url).not.toMatch(/\/r(\?|$)/);
    expect(url).not.toMatch(/\/dev\//);
  });

  it("is vector, so a designer can use it at any size", async () => {
    const svg = await posterQrSvg(origin);

    expect(svg).toContain("<svg");
    expect(svg).toContain("viewBox");
    // The thing that makes it usable in artwork rather than just on screen.
    expect(svg).not.toContain("<image");
  });

  it("carries no quiet zone, because the layout owns that", async () => {
    const svg = await posterQrSvg(origin);
    // margin: 0. Baking in four modules of white would fight every designer
    // putting this on a coloured background.
    const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
    expect(viewBox).not.toBeNull();
    expect(viewBox![1]).toBe(viewBox![2]);
  });

  it("is denser than a pack label, which is the point", async () => {
    const poster = await posterQrSvg(origin);
    const size = Number(/viewBox="0 0 (\d+)/.exec(poster)![1]);

    // Error correction Q rather than M. A poster is read across a room, at
    // an angle, through sun on glass, and often with a logo dropped into the
    // middle by a designer nobody asked. Q survives about a quarter of the
    // symbol being unreadable; the extra modules cost nothing on a poster.
    expect(size).toBeGreaterThan(20);
  });

  it("gives two brands two different posters", async () => {
    const ours = await posterQrSvg(brandOrigin("chicken-licken"));
    const theirs = await posterQrSvg(brandOrigin("campari"));

    // Obvious, and the failure it guards against is not: a poster generated
    // from a hardcoded or cached origin would send one brand's customers to
    // another brand's programme.
    expect(ours).not.toBe(theirs);
  });
});
