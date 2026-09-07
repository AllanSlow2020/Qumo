import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireStaff } from "@/lib/staff/current";

/**
 * Everything an account gets to see only once it owns its own password.
 *
 * A route group rather than a check in each page, and rather than reading
 * the pathname in the layout above — a layout is not given one. Nesting is
 * the mechanism that already gates login from the rest of the console, and
 * it has the property that matters: a page added under here inherits the
 * gate, and a page that renders is one that passed it.
 *
 * /change-password sits one level up, outside this group, because it is the
 * screen that satisfies the condition and cannot require it.
 *
 * Checked per request rather than stamped into the session, so it lifts the
 * moment it is satisfied.
 */
export default async function GatedConsoleLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const user = await prisma.user.findUnique({
    where: { id: staff.userId },
    select: { mustChangePassword: true },
  });

  if (user?.mustChangePassword) {
    redirect("/change-password");
  }

  return <>{children}</>;
}
