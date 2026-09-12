"use server";

import { brandOrigin, CONSOLE_SUBDOMAIN, ROOT_DOMAIN } from "@/lib/brand/host";
import { provisionBrand, provisionSecretMatches, ProvisionError } from "@/lib/brand/provision";
import { rateLimit } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";

export type ProvisionResult =
  | { ok: false; error: string }
  | {
      ok: true;
      brandName: string;
      shopperUrl: string;
      consoleUrl: string;
      ownerEmail: string;
      temporaryPassword: string;
    };

// Generous for somebody typing one form, and tight enough that the secret
// cannot be searched for. One counter for everybody, because there is no
// session or account here to key it to - the whole point of this route.
const ATTEMPT_LIMIT = 10;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Creates a brand, given the shared secret.
 *
 * The secret is checked before anything is parsed, so a caller without it
 * cannot learn from the errors which slugs are taken or which email
 * addresses already have accounts.
 */
export async function provision(formData: FormData): Promise<ProvisionResult> {
  const allowed = await rateLimit("provision", ATTEMPT_LIMIT, ATTEMPT_WINDOW_MS);
  if (!allowed.allowed) {
    return { ok: false, error: "Too many attempts. Try again shortly." };
  }

  if (!provisionSecretMatches(String(formData.get("secret") ?? ""))) {
    // One message for a wrong secret and for no secret configured. Telling
    // them apart would say "this deployment can be provisioned, you just
    // need the key", which is the one fact worth withholding here.
    logger.info("provisioning refused");
    return { ok: false, error: "That setup key isn't right." };
  }

  try {
    const brand = await provisionBrand({
      name: formData.get("name"),
      slug: formData.get("slug"),
      ownerEmail: formData.get("ownerEmail"),
      ownerName: formData.get("ownerName"),
    });

    const consoleHost = `${CONSOLE_SUBDOMAIN}.${ROOT_DOMAIN}${ROOT_DOMAIN.split(":")[0] === "localhost" ? ":3000" : ""}`;
    return {
      ok: true,
      brandName: brand.name,
      shopperUrl: brandOrigin(brand.slug),
      consoleUrl: `${ROOT_DOMAIN.split(":")[0] === "localhost" ? "http" : "https"}://${consoleHost}`,
      ownerEmail: brand.ownerEmail,
      temporaryPassword: brand.temporaryPassword,
    };
  } catch (err) {
    if (err instanceof ProvisionError) {
      return { ok: false, error: err.message };
    }
    logger.error("provisioning threw", { err: String(err) });
    return { ok: false, error: "Something went wrong. Nothing was created." };
  }
}
