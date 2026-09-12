import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import type { Brand } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ForbiddenError } from "@/lib/auth/rbac";
import { BrandIdentityError, getBrandIdentity, updateBrandIdentityForSession } from "@/lib/brand/manage";
import { toBrandTheme, brandStyle } from "@/lib/brand/theme";

/**
 * Editing the face a brand shows its shoppers.
 *
 * The interesting property is that this module and lib/brand/theme.ts treat
 * the same bad input in opposite ways on purpose: the render path degrades so
 * a shopper always gets a page, and this path refuses so somebody filling in
 * a form is told what happened.
 */
describe("a brand editing its own appearance", () => {
  const suffix = Date.now();
  let brand: Brand;
  let other: Brand;

  const owner = (id: string) => ({ user: { id: `${id}-owner`, brandId: id, role: "OWNER", name: "Test Owner" } });
  const marketing = (id: string) => ({ user: { id: `${id}-marketing`, brandId: id, role: "MARKETING", name: "Test Marketing" } });

  function form(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Licken Holdings (Pty) Ltd", slug: `id-a-${suffix}` } });
    other = await prisma.brand.create({ data: { name: "Campari", slug: `id-b-${suffix}` } });
  });

  afterAll(async () => {
    await prisma.brand.deleteMany({ where: { id: { in: [brand.id, other.id] } } });
  });

  it("saves a name, colour and tagline", async () => {
    await updateBrandIdentityForSession(
      owner(brand.id),
      form({
        displayName: "Chicken Licken",
        tagline: "Soul food rewards",
        accentColor: "#C8102E",
        accentInkColor: "#FFFFFF",
        supportEmail: "rewards@example.invalid",
      }),
    );

    const saved = await getBrandIdentity(brand.id);
    expect(saved?.displayName).toBe("Chicken Licken");
    // Normalised on the way in, so the render path never has to care about case.
    expect(saved?.accentColor).toBe("#c8102e");

    const theme = toBrandTheme({ id: brand.id, ...saved! });
    // The legal name is what the row holds; the signage name is what a
    // shopper reads.
    expect(theme.name).toBe("Chicken Licken");
    expect(brandStyle(theme)).toEqual({ "--sc-brand-accent": "#c8102e", "--sc-brand-ink": "#ffffff" });
  });

  describe("the dark mode pair", () => {
    it("saves a second pair and emits it alongside the first", async () => {
      await updateBrandIdentityForSession(
        owner(brand.id),
        form({
          accentColor: "#C8102E",
          accentInkColor: "#FFFFFF",
          accentColorDark: "#FF3355",
          accentInkColorDark: "#0A0A0B",
        }),
      );

      const theme = toBrandTheme({ id: brand.id, ...(await getBrandIdentity(brand.id))! });
      expect(brandStyle(theme)).toEqual({
        "--sc-brand-accent": "#c8102e",
        "--sc-brand-ink": "#ffffff",
        "--sc-brand-accent-dark": "#ff3355",
        "--sc-brand-ink-dark": "#0a0a0b",
      });
    });

    it("writes no dark tokens when a brand did not choose one", async () => {
      await updateBrandIdentityForSession(
        owner(brand.id),
        form({ accentColor: "#C8102E", accentInkColor: "#FFFFFF" }),
      );

      // The absence is the feature. With no dark token written, shopper.css
      // falls through to the light pair, which is exactly what every brand
      // got before this existed - so adding the columns changed nothing for
      // anybody who ignores them.
      const theme = toBrandTheme({ id: brand.id, ...(await getBrandIdentity(brand.id))! });
      const style = brandStyle(theme) as Record<string, string>;
      expect(style["--sc-brand-accent-dark"]).toBeUndefined();
      expect(style["--sc-brand-ink-dark"]).toBeUndefined();
    });

    it("refuses a dark colour with no light one to be a variant of", async () => {
      // Otherwise a brand gets its identity on one theme and Qumo's black on
      // the other, which reads as a fault rather than a choice.
      await expect(
        updateBrandIdentityForSession(owner(brand.id), form({ accentColorDark: "#FF3355" })),
      ).rejects.toThrow(/light mode/i);
    });

    it("refuses dark ink with no dark button under it", async () => {
      await expect(
        updateBrandIdentityForSession(
          owner(brand.id),
          form({ accentColor: "#C8102E", accentInkColorDark: "#000000" }),
        ),
      ).rejects.toThrow(/dark mode button colour/i);
    });

    it("drops a dark colour on the render path rather than half-painting a page", async () => {
      // The render path never throws - a shopper in a queue gets a page. So
      // a row that somehow holds a dark colour with no light one (written
      // directly, or predating the rule) resolves to no brand colour at all
      // rather than to an accent that only appears at night.
      const theme = toBrandTheme({
        id: "b1",
        slug: "x",
        name: "X",
        displayName: null,
        tagline: null,
        logoUrl: null,
        accentColor: null,
        accentInkColor: null,
        accentColorDark: "#ff3355",
        accentInkColorDark: "#0a0a0b",
        displayFont: null,
        figureFont: null,
        supportEmail: null,
        supportUrl: null,
      });

      expect(theme.accentDark).toBeNull();
      expect(brandStyle(theme)).toBeUndefined();
    });
  });

  it("refuses a malformed colour instead of quietly dropping it", async () => {
    // The render path takes anything and falls back, because a shopper in a
    // queue must get a page. Here somebody is watching, and a form that
    // saves nothing while reporting success is worse than an error.
    await expect(updateBrandIdentityForSession(owner(brand.id), form({ accentColor: "red" }))).rejects.toThrow(
      ZodError,
    );
    await expect(updateBrandIdentityForSession(owner(brand.id), form({ accentColor: "#fff" }))).rejects.toThrow(
      ZodError,
    );
    // And the previous value survives the refusal.
    expect((await getBrandIdentity(brand.id))?.accentColor).toBe("#c8102e");
  });

  it("refuses an insecure logo, which would render as nothing at all", async () => {
    await expect(
      updateBrandIdentityForSession(owner(brand.id), form({ logoUrl: "http://cdn.example/logo.png" })),
    ).rejects.toThrow(ZodError);
  });

  it("refuses button text without a button colour", async () => {
    await expect(
      updateBrandIdentityForSession(owner(brand.id), form({ accentInkColor: "#ffffff" })),
    ).rejects.toThrow(BrandIdentityError);
  });

  it("treats an empty field as clearing it", async () => {
    await updateBrandIdentityForSession(owner(brand.id), form({ displayName: "", tagline: "" }));
    const saved = await getBrandIdentity(brand.id);
    expect(saved?.displayName).toBeNull();
    expect(saved?.tagline).toBeNull();
    // Falls back to the registered name, rather than rendering an empty
    // masthead.
    const theme = toBrandTheme({ id: brand.id, ...saved! });
    expect(theme.name).toBe("Licken Holdings (Pty) Ltd");
  });

  it("won't let marketing change the brand's face", async () => {
    await expect(
      updateBrandIdentityForSession(marketing(brand.id), form({ displayName: "Nope" })),
    ).rejects.toThrow(ForbiddenError);
  });

  it("won't reach another brand", async () => {
    // The tenant guard scopes the update to the session's own brand, so an
    // owner of one cannot repaint another.
    await updateBrandIdentityForSession(owner(other.id), form({ displayName: "Campari SA" }));
    expect((await getBrandIdentity(brand.id))?.displayName).toBeNull();
    expect((await getBrandIdentity(other.id))?.displayName).toBe("Campari SA");
  });
});
