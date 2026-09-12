import { z } from "zod";
import type { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/rbac";
import { forBrand } from "@/lib/db/tenant";
import { prisma } from "@/lib/db/client";
import { record } from "@/lib/audit/record";
import { findFont } from "@/lib/brand/fonts";
import type { Actor } from "@/lib/staff/actor";

/**
 * Editing the face a brand shows its shoppers.
 *
 * The fields have existed since the brand layer landed and every shopper page
 * reads them - what was missing was any way to change them, which meant a
 * brand's colours were set by whoever had database access. This is the screen
 * that makes "all we do is reskin" a thing a brand can do rather than a thing
 * we do for them.
 *
 * Owner or admin. A brand's public face is not a marketing tweak.
 */
export const MANAGE_IDENTITY_ROLES: Role[] = ["OWNER", "ADMIN"];

export class BrandIdentityError extends Error {}

export type SessionLike = Actor;

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Rejects rather than degrades, and that is the difference between this and
 * lib/brand/theme.ts.
 *
 * The render path takes anything and quietly falls back, because a shopper
 * standing in a queue must get a page whatever nonsense is in the database.
 * A settings form is the opposite situation: somebody is present, they
 * intended something, and silently dropping it would leave them staring at a
 * saved form that did nothing. Same values, opposite failure mode.
 */
const identitySchema = z.object({
  displayName: z.string().trim().max(120).optional(),
  tagline: z.string().trim().max(120).optional(),
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine((v) => !v || /^https:\/\//i.test(v), {
      message: "The logo address has to start with https:// - an http image is blocked as insecure and shows as nothing.",
    }),
  accentColor: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || HEX.test(v), { message: "Use a six-digit colour like #C8102E." }),
  accentInkColor: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || HEX.test(v), { message: "Use a six-digit colour like #FFFFFF." }),
  // The same pair again, for dark mode. Optional in the same way and for
  // the same reason: a brand that sets neither keeps its light colours in
  // both themes, which is what every brand had before these existed.
  accentColorDark: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || HEX.test(v), { message: "Use a six-digit colour like #C8102E." }),
  accentInkColorDark: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || HEX.test(v), { message: "Use a six-digit colour like #FFFFFF." }),
  supportEmail: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), { message: "That doesn't look like an email address." }),
  supportUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine((v) => !v || /^https:\/\//i.test(v), { message: "The support address has to start with https://." }),
  // Checked against the registry rather than against a pattern. A font id is
  // a key we look up, so "is this well-formed" is the wrong question - the
  // only thing worth knowing is whether we have the face.
  displayFont: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || findFont(v) !== null, { message: "That isn't one of the fonts we can serve." }),
  figureFont: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || findFont(v) !== null, { message: "That isn't one of the fonts we can serve." }),
});

/** Empty form fields mean "clear this", not "leave it alone". */
function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function updateBrandIdentityForSession(session: SessionLike, formData: FormData): Promise<void> {
  requireRole(session.user.role as Role, MANAGE_IDENTITY_ROLES);

  const parsed = identitySchema.parse({
    displayName: formData.get("displayName")?.toString(),
    tagline: formData.get("tagline")?.toString(),
    logoUrl: formData.get("logoUrl")?.toString(),
    accentColor: formData.get("accentColor")?.toString(),
    accentInkColor: formData.get("accentInkColor")?.toString(),
    accentColorDark: formData.get("accentColorDark")?.toString(),
    accentInkColorDark: formData.get("accentInkColorDark")?.toString(),
    supportEmail: formData.get("supportEmail")?.toString(),
    supportUrl: formData.get("supportUrl")?.toString(),
    displayFont: formData.get("displayFont")?.toString(),
    figureFont: formData.get("figureFont")?.toString(),
  });

  const accentColor = blankToNull(parsed.accentColor);
  const accentInkColor = blankToNull(parsed.accentInkColor);
  const accentColorDark = blankToNull(parsed.accentColorDark);
  const accentInkColorDark = blankToNull(parsed.accentInkColorDark);

  // Ink without an accent recolours the default black button's text and can
  // land white on white. The render path drops it silently; here, where
  // somebody is watching, say so instead.
  if (accentInkColor && !accentColor) {
    throw new BrandIdentityError("Pick a button colour before choosing the text colour that sits on it.");
  }

  // The same two rules one level down. A dark colour with no light one to be
  // a variant of would give the brand its identity on one theme and Qumo's
  // black on the other, which reads as a fault rather than a choice, and the
  // render path drops it for exactly that reason.
  if ((accentColorDark || accentInkColorDark) && !accentColor) {
    throw new BrandIdentityError("Pick a button colour for light mode before setting the dark mode one.");
  }
  if (accentInkColorDark && !accentColorDark) {
    throw new BrandIdentityError("Pick a dark mode button colour before choosing the text colour that sits on it.");
  }

  await forBrand(session.user.brandId).brand.update({
    where: { id: session.user.brandId },
    data: {
      displayName: blankToNull(parsed.displayName),
      tagline: blankToNull(parsed.tagline),
      logoUrl: blankToNull(parsed.logoUrl),
      accentColor: accentColor?.toLowerCase() ?? null,
      accentInkColor: accentInkColor?.toLowerCase() ?? null,
      accentColorDark: accentColorDark?.toLowerCase() ?? null,
      accentInkColorDark: accentInkColorDark?.toLowerCase() ?? null,
      supportEmail: blankToNull(parsed.supportEmail),
      supportUrl: blankToNull(parsed.supportUrl),
      // Blank is "use Qumo's", which is a real choice rather than an absence
      // - the picker's first option, not an empty select.
      displayFont: blankToNull(parsed.displayFont),
      figureFont: blankToNull(parsed.figureFont),
    },
  });

  // Names which fields were set, not what they were set to: a shopper-facing
  // identity change is worth knowing about, and the values are visible on
  // the screen next door.
  await record(prisma, session.user, {
    action: "brand.identity_changed",
    targetId: session.user.brandId,
    detail: {
      changed: Object.entries({
        displayName: blankToNull(parsed.displayName),
        tagline: blankToNull(parsed.tagline),
        logoUrl: blankToNull(parsed.logoUrl),
        accentColor,
        accentInkColor,
        accentColorDark,
        accentInkColorDark,
        supportEmail: blankToNull(parsed.supportEmail),
        supportUrl: blankToNull(parsed.supportUrl),
        displayFont: blankToNull(parsed.displayFont),
        figureFont: blankToNull(parsed.figureFont),
      })
        .filter(([, value]) => value !== null)
        .map(([key]) => key),
    },
  });
}

export type BrandIdentity = {
  name: string;
  slug: string;
  displayName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  accentInkColor: string | null;
  accentColorDark: string | null;
  accentInkColorDark: string | null;
  displayFont: string | null;
  figureFont: string | null;
  supportEmail: string | null;
  supportUrl: string | null;
};

export async function getBrandIdentity(brandId: string): Promise<BrandIdentity | null> {
  return forBrand(brandId).brand.findFirst({
    where: { id: brandId },
    select: {
      name: true,
      slug: true,
      displayName: true,
      tagline: true,
      logoUrl: true,
      accentColor: true,
      accentInkColor: true,
      accentColorDark: true,
      accentInkColorDark: true,
      displayFont: true,
      figureFont: true,
      supportEmail: true,
      supportUrl: true,
    },
  });
}
