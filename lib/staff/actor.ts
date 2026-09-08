import type { Role } from "@prisma/client";

/**
 * Who is performing a console action.
 *
 * This existed eight times, once per engine module, and had drifted: five
 * copies carried `{ brandId, role }` and three also carried `id`. That was
 * survivable while nothing needed the id. The audit log needs it
 * everywhere - an entry that cannot say who did the thing is not worth
 * writing - so the shape is settled here and imported rather than
 * re-declared.
 *
 * Still a structural type rather than the full StaffIdentity: the engine
 * needs the three fields it acts on, and passing the whole session in would
 * hand every manage function a session token and an email it has no
 * business seeing.
 */
export type Actor = {
  user: {
    id: string;
    brandId: string;
    role: Role | string;
    /**
     * Carried so the audit log can name who acted without a second query,
     * and so it names them as they were at the time. Optional only because
     * a handful of engine tests construct an actor directly and have no
     * user row behind it; every real caller comes from a verified session
     * and has both.
     */
    name?: string;
    email?: string | null;
  };
};
