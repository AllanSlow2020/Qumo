import { redirect } from "next/navigation";
import { PRODUCT_NAME } from "@/lib/product";
import { getStaffSession } from "@/lib/staff/session";
import { QumoMark } from "../qumo-mark";
import { StaffLoginForm } from "./login-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: `Sign in · ${PRODUCT_NAME}` };

export default async function StaffLoginPage() {
  // Already signed in - no reason to make somebody prove a password they
  // proved this morning.
  if (await getStaffSession()) {
    redirect("/");
  }

  return (
    <main className="cn-login">
      <div className="cn-login-card">
        <h1 className="cn-sr">Sign in to the console</h1>
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
    </main>
  );
}
