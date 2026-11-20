"use client";

import { useFormStatus } from "react-dom";

/**
 * Sign out, with an answer while it happens. Ending a session and redirecting
 * is a round trip, and a button that does nothing visible for that long gets
 * pressed again.
 */
export function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="cn-btn cn-btn-quiet" disabled={pending}>
      {pending ? "Signing out" : "Sign out"}
    </button>
  );
}
