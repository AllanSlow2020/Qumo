import type { Role } from "@prisma/client";

export class ForbiddenError extends Error {
  constructor(role: string, allowed: readonly string[]) {
    super(`Role "${role}" is not permitted here (allowed: ${allowed.join(", ")})`);
    this.name = "ForbiddenError";
  }
}

/**
 * Call at the top of any server action / route handler that needs more than
 * "logged in" - e.g. only OWNER/ADMIN may manage users. Throws rather than
 * returning a boolean so a forgotten check fails loudly (an uncaught
 * exception / 500) instead of silently letting the request through.
 */
export function requireRole(role: Role, allowed: readonly Role[]): void {
  if (!allowed.includes(role)) {
    throw new ForbiddenError(role, allowed);
  }
}
