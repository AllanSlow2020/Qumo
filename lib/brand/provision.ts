import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { isValidBrandSlug } from "@/lib/brand/host";
import { generateTempPassword, hashPassword } from "@/lib/staff/password";
import { logger } from "@/lib/security/logger";

/**
 * Creating a brand, which until now nothing could do.
 *
 * Every tenant in this system arrived by being seeded, which meant a new
 * brand needed somebody with a database connection. That is fine for
 * demonstrating and impossible as a business.
 *
 * ── Why a shared secret and not an admin login ───────────────────────────
 *
 * Three options were on the table and two were wrong for where this is.
 *
 * Public self-serve signup is the eventual answer and is deliberately not
 * this: it only makes sense once there is a subscription to charge for, and
 * a form that mints tenants for free on a wildcard domain is an abuse
 * surface with no upside.
 *
 * A platform-administrator principal is the heavyweight answer. It means a
 * third authenticated surface with its own sessions, its own roles and its
 * own opportunities to get tenancy wrong, built for something done a
 * handful of times a year. This system keeps exactly two principals apart
 * and that separation is one of the better things about it; adding a third
 * to save a few minutes is a bad trade.
 *
 * So: a shared secret, which is what the cron routes and the SMS webhook
 * already use for precisely this shape - a caller with no session and no
 * cookie. Same constant-time compare, and the same rule that an unset
 * secret refuses everything rather than waving it through.
 *
 * ── What the secret is worth, stated honestly ────────────────────────────
 *
 * If it leaks, somebody can create brands. That is a nuisance - a junk
 * tenant on a subdomain, rate-limited - and not a breach: it grants no
 * access to any existing brand's data, because nothing here reads or writes
 * another tenant's rows. Rotate it and delete the junk. That is a
 * proportionate risk for this, and would not be for anything that could
 * read a ledger.
 */

export class ProvisionError extends Error {}

const schema = z.object({
  name: z.string().trim().min(1, "The brand needs a name.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "The brand needs an address.")
    .max(63),
  ownerEmail: z.string().trim().toLowerCase().email("That doesn't look like an email address."),
  ownerName: z.string().trim().min(1, "The first owner needs a name.").max(80),
});

export type ProvisionedBrand = {
  brandId: string;
  slug: string;
  name: string;
  ownerEmail: string;
  /** Shown once and never stored in the clear. The owner must change it at first sign-in. */
  temporaryPassword: string;
};

/**
 * Constant time, like every other secret comparison here, and for the
 * reason the cron route gives: `!==` on strings stops at the first differing
 * byte. Hard to exploit across a network and free to avoid.
 */
export function provisionSecretMatches(supplied: string): boolean {
  const expected = process.env.PROVISION_SECRET;
  // Unset means no request can ever match, which is the safe direction for
  // an endpoint whose whole job is creating tenants.
  if (!expected || expected.length === 0) return false;

  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Which field's unique constraint a P2002 actually violated.
 *
 * Not as simple as it should be, and worth writing down because the obvious
 * two attempts are both wrong. Matching on the error message text is
 * brittle. Reading `meta.target`, which is what Prisma's own documentation
 * describes and what most examples use, returns nothing here: under the pg
 * driver adapter the violated constraint arrives nested at
 * meta.driverAdapterError.cause.constraint.fields instead.
 *
 * So both are read, adapter shape first. lib/staff/users.ts does not need
 * this because only one unique column is reachable from there and any P2002
 * means the email; here two are, and they need different answers.
 */
function violatedFields(err: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = err.meta as
    | { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } }
    | undefined;

  const fromAdapter = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(fromAdapter)) return fromAdapter.map(String);
  if (Array.isArray(meta?.target)) return meta.target.map(String);
  if (typeof meta?.target === "string") return [meta.target];
  return [];
}

/**
 * Creates a brand and the one account that can then invite everybody else.
 *
 * Both rows or neither. A brand with no owner is a tenant nobody can sign
 * in to and nobody can fix from the console, which would need the database
 * connection this whole function exists to avoid.
 */
export async function provisionBrand(input: unknown): Promise<ProvisionedBrand> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ProvisionError(parsed.error.issues[0]?.message ?? "Check the details and try again.");
  }
  const { name, slug, ownerEmail, ownerName } = parsed.data;

  // Asked of the host resolver rather than re-derived here. A slug this
  // rejects would give the brand a console that cheerfully printed a poster
  // URL resolving to nothing.
  if (!isValidBrandSlug(slug)) {
    throw new ProvisionError(
      "That address can't be used. Lower-case letters, numbers and hyphens only, and some names are reserved.",
    );
  }

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    const brand = await prisma.$transaction(async (tx) => {
      const created = await tx.brand.create({ data: { name, slug } });
      await tx.user.create({
        data: {
          brandId: created.id,
          email: ownerEmail,
          name: ownerName,
          role: "OWNER",
          passwordHash,
          // The password below is handed over in a chat message or read out
          // over a phone, so it is a delivery mechanism rather than a
          // credential. It stops being either at their first sign-in.
          mustChangePassword: true,
        },
      });
      return created;
    });

    // No audit entry: lib/audit/record.ts is brand-scoped and needs a staff
    // actor, and there is no staff member here by construction. The log is
    // the record, and it names the slug rather than the secret.
    logger.info("brand provisioned", { brandId: brand.id, slug: brand.slug });

    return {
      brandId: brand.id,
      slug: brand.slug,
      name: brand.name,
      ownerEmail,
      temporaryPassword,
    };
  } catch (err) {
    // Both unique constraints are reachable from here and they need
    // different answers: pick another address, or that person already has an
    // account. See violatedFields() for why telling them apart is fiddlier
    // than it looks.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const fields = violatedFields(err);
      if (fields.includes("slug")) {
        throw new ProvisionError("That address is already taken.");
      }
      if (fields.includes("email")) {
        // Vague about *where* it exists, like the invite path: an address
        // may belong to another brand, and confirming that maps out who
        // works where.
        throw new ProvisionError("That email address already has an account.");
      }
    }
    logger.error("brand provisioning failed", { err: String(err) });
    throw new ProvisionError("Something went wrong. Nothing was created.");
  }
}
