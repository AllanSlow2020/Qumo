import { prisma } from "@/lib/db/client";
import { requireStaff } from "@/lib/staff/current";
import { PasswordForm } from "./password-form";

export default async function ChangePasswordPage() {
  const staff = await requireStaff();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: staff.userId },
    select: { mustChangePassword: true },
  });

  return (
    <>
      <h1 className="cn-h1">{user.mustChangePassword ? "Choose your password" : "Change your password"}</h1>

      {user.mustChangePassword && (
        <p className="cn-body">
          {/* Says why, rather than just demanding. The reason is real: an
              owner read them this password, so two people know it. */}
          Somebody set up your account and gave you a password, which means two people know it. Choose your own and
          that stops being true.
        </p>
      )}

      <section className="cn-panel">
        <div className="cn-panel-body">
          <PasswordForm forced={user.mustChangePassword} />
        </div>
      </section>
    </>
  );
}
