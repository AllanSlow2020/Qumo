import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brand } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { checkLogo, MAX_LOGO_BYTES } from "@/lib/brand/logo";
import { BrandIdentityError, getBrandIdentity, updateBrandIdentityForSession } from "@/lib/brand/manage";
import { toBrandTheme } from "@/lib/brand/theme";

/**
 * Uploading the picture that goes at the top of a brand's shopper pages.
 *
 * Two things are being proved here and they are different in kind. The first
 * is that we decide a file's type by reading it, not by believing what the
 * uploader called it - the interesting case is a file that claims to be a
 * PNG and is not, because that is the one a browser would otherwise be asked
 * to interpret on the brand's own origin. The second is quieter and is the
 * bug this shape was chosen to avoid: an appearance form with an untouched
 * file input must leave the existing logo exactly where it is.
 */

/** The eight bytes every PNG starts with, then enough body to be a file. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(0)]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(0)]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, ...new Array(64).fill(0),
]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...new Array(64).fill(0)]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe("what counts as a logo", () => {
  it("takes the three formats a browser can be trusted with", () => {
    for (const [bytes, mime] of [
      [PNG, "image/png"],
      [JPEG, "image/jpeg"],
      [WEBP, "image/webp"],
    ] as const) {
      const checked = checkLogo(bytes);
      expect(checked.ok).toBe(true);
      if (checked.ok) expect(checked.mime).toBe(mime);
    }
  });

  it("believes the bytes, not the name the file was given", () => {
    // This is the whole point of the check. A GIF renamed logo.png would be
    // stored with the type its uploader chose and served back under it, and
    // the type we serve decides what the browser does with it.
    const checked = checkLogo(GIF);
    expect(checked.ok).toBe(false);
  });

  it("refuses SVG, and says why rather than shrugging", () => {
    const checked = checkLogo(SVG);
    expect(checked.ok).toBe(false);
    // Somebody whose only copy of their logo is an SVG needs the next step,
    // not a validation message. The test pins that the next step is given.
    if (!checked.ok) {
      expect(checked.error).toMatch(/PNG/);
      expect(checked.error.toLowerCase()).toContain("svg");
    }
  });

  it("refuses an empty file and one over the cap", () => {
    expect(checkLogo(new Uint8Array(0)).ok).toBe(false);

    const huge = new Uint8Array(MAX_LOGO_BYTES + 1);
    huge.set(PNG.slice(0, 8));
    expect(checkLogo(huge).ok).toBe(false);
  });

  it("copies the bytes rather than holding the caller's view of them", () => {
    const source = new Uint8Array(PNG);
    const checked = checkLogo(source);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    source[9] = 0xff;
    // A view onto a buffer somebody else still owns is a row that changes
    // after it is written, which is a hard thing to ever see again.
    expect(checked.bytes[9]).toBe(0);
  });
});

describe("a brand uploading its logo", () => {
  const suffix = Date.now();
  let brand: Brand;

  const owner = (id: string) => ({ user: { id: `${id}-owner`, brandId: id, role: "OWNER", name: "Test Owner" } });

  /** The appearance form, which always posts every field it owns. */
  function form(fields: Record<string, string>, file?: File): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    if (file) fd.set("logoFile", file);
    return fd;
  }

  const base = { displayName: "Chicken Licken", accentColor: "#C8102E", accentInkColor: "#FFFFFF" };

  beforeAll(async () => {
    brand = await prisma.brand.create({ data: { name: "Licken Holdings (Pty) Ltd", slug: `logo-${suffix}` } });
  });

  afterAll(async () => {
    await prisma.brand.deleteMany({ where: { id: brand.id } });
  });

  it("stores the bytes and the type read off them", async () => {
    await updateBrandIdentityForSession(
      owner(brand.id),
      form(base, new File([PNG], "logo.png", { type: "image/png" })),
    );

    const row = await prisma.brand.findUniqueOrThrow({
      where: { id: brand.id },
      select: { logoData: true, logoMimeType: true, logoUpdatedAt: true },
    });
    expect(row.logoMimeType).toBe("image/png");
    expect(row.logoData?.length).toBe(PNG.length);
    expect(row.logoUpdatedAt).not.toBeNull();
  });

  it("serves the upload ahead of an address, and stamps the URL so it can be cached hard", async () => {
    const saved = await getBrandIdentity(brand.id);
    const theme = toBrandTheme({ id: brand.id, ...saved!, logoUrl: "https://elsewhere.invalid/old.png" });

    expect(theme.logoUrl).toContain("/api/brand-logo");
    expect(theme.logoUrl).toContain(`v=${saved!.logoUpdatedAt!.getTime()}`);
  });

  it("leaves the logo alone when the file input was never touched", async () => {
    const before = await prisma.brand.findUniqueOrThrow({
      where: { id: brand.id },
      select: { logoUpdatedAt: true },
    });

    // Exactly what a browser posts for an untouched file input: a File with
    // no name and no bytes. Treating that as "clear it" the way every text
    // field on this form is treated would wipe a brand's logo every time
    // somebody changed their support address, and it would look like a fault
    // in the upload rather than in the save.
    await updateBrandIdentityForSession(
      owner(brand.id),
      form({ ...base, supportEmail: "rewards@example.invalid" }, new File([], "", { type: "application/octet-stream" })),
    );

    const after = await prisma.brand.findUniqueOrThrow({
      where: { id: brand.id },
      select: { logoData: true, logoMimeType: true, logoUpdatedAt: true, supportEmail: true },
    });
    expect(after.supportEmail).toBe("rewards@example.invalid");
    expect(after.logoMimeType).toBe("image/png");
    expect(after.logoUpdatedAt?.getTime()).toBe(before.logoUpdatedAt?.getTime());
  });

  it("refuses the save outright when the file is wrong, rather than saving half of it", async () => {
    await expect(
      updateBrandIdentityForSession(
        owner(brand.id),
        form({ ...base, tagline: "Should not survive" }, new File([SVG], "logo.svg", { type: "image/svg+xml" })),
      ),
    ).rejects.toBeInstanceOf(BrandIdentityError);

    const after = await prisma.brand.findUniqueOrThrow({
      where: { id: brand.id },
      select: { tagline: true, logoMimeType: true },
    });
    // The tagline came in on the same form. A file check that ran after the
    // write would have let it through and left the brand with half a save.
    expect(after.tagline).toBeNull();
    expect(after.logoMimeType).toBe("image/png");
  });

  it("removes it only when asked to, and then completely", async () => {
    await updateBrandIdentityForSession(owner(brand.id), form({ ...base, removeLogo: "1" }));

    const after = await prisma.brand.findUniqueOrThrow({
      where: { id: brand.id },
      select: { logoData: true, logoMimeType: true, logoUpdatedAt: true },
    });
    expect(after.logoData).toBeNull();
    expect(after.logoMimeType).toBeNull();
    expect(after.logoUpdatedAt).toBeNull();

    // And the render path falls back to the address rather than to nothing.
    const saved = await getBrandIdentity(brand.id);
    const theme = toBrandTheme({ id: brand.id, ...saved!, logoUrl: "https://elsewhere.invalid/old.png" });
    expect(theme.logoUrl).toBe("https://elsewhere.invalid/old.png");
  });

  it("records the upload in the audit log without the bytes", async () => {
    await updateBrandIdentityForSession(
      owner(brand.id),
      form(base, new File([JPEG], "logo.jpg", { type: "image/jpeg" })),
    );

    const event = await prisma.auditEvent.findFirst({
      where: { brandId: brand.id, action: "brand.identity_changed" },
      orderBy: { createdAt: "desc" },
    });
    const detail = event?.detail as { changed?: string[] } | null;
    expect(detail?.changed).toContain("logoUpload");
    expect(JSON.stringify(detail)).not.toContain("logoData");
  });
});
