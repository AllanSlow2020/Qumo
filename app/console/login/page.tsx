import { redirect } from "next/navigation";
import { PRODUCT_NAME } from "@/lib/product";
import { getStaffSession } from "@/lib/staff/session";
import { QumoMark } from "../qumo-mark";
import { StaffLoginForm } from "./login-form";

export default async function StaffLoginPage() {
  // Already signed in - no reason to make somebody prove a password they
  // proved this morning.
  if (await getStaffSession()) {
    redirect("/");
  }

  return (
    <div className="cn-login">
      <div className="cn-login-card">
        <div>
          <p className="cn-mark">
            <QumoMark />
            <span className="cn-mark-sr">{PRODUCT_NAME}</span>
            <span>console</span>
          </p>
          <p className="cn-label" style={{ marginTop: 6 }}>
            For brand staff. Shoppers sign in on their brand&apos;s own site.
          </p>
        </div>
        <StaffLoginForm />
      </div>
    </div>
  );
}
