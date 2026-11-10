import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ROLES_REQUIRING_SECOND_FACTOR, secondFactorRequired } from "@/lib/staff/mfa-policy";

/**
 * Which roles may not sign in on a password alone.
 *
 * A pure function with its own file, because it is policy rather than
 * mechanism: the question "who does this apply to" gets asked by people who
 * will not read lib/staff/mfa.ts, and the answer should be readable on its
 * own.
 */

describe("secondFactorRequired", () => {
  it("requires it of the roles that can change what the programme is", () => {
    expect(secondFactorRequired("OWNER")).toBe(true);
    expect(secondFactorRequired("ADMIN")).toBe(true);
  });

  it("does not require it of the roles that only operate within it", () => {
    expect(secondFactorRequired("MARKETING")).toBe(false);
    expect(secondFactorRequired("QUALITY")).toBe(false);
  });

  it("decides every role the schema defines", () => {
    /*
     * The guard that makes this list maintainable. Adding a role to the
     * Prisma schema and not to the thinking here would leave it silently
     * exempt, which is the failure mode that matters: a new role is added
     * because somebody needs new powers.
     *
     * This does not assert what the answer should be for a future role,
     * only that each one has been looked at. The assertion below is the
     * one that fails when a role appears.
     */
    const decided = Object.values(Role).map((role) => ({ role, required: secondFactorRequired(role) }));

    expect(decided).toEqual([
      { role: "OWNER", required: true },
      { role: "ADMIN", required: true },
      { role: "MARKETING", required: false },
      { role: "QUALITY", required: false },
    ]);
  });

  it("exposes the list, and it holds only required roles", () => {
    // Exported so the console can explain the rule without restating it.
    // Checked against the function so the two cannot drift.
    for (const role of ROLES_REQUIRING_SECOND_FACTOR) {
      expect(secondFactorRequired(role)).toBe(true);
    }
    expect([...ROLES_REQUIRING_SECOND_FACTOR].sort()).toEqual(["ADMIN", "OWNER"]);
  });
});
