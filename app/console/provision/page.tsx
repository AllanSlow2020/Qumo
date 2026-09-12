import type { Metadata } from "next";
import { ROOT_DOMAIN } from "@/lib/brand/host";
import { PRODUCT_NAME } from "@/lib/product";
import { ProvisionForm } from "./provision-form";

export const metadata: Metadata = { title: `Set up a brand · ${PRODUCT_NAME}` };

/**
 * Where a new tenant comes from.
 *
 * Outside the (authed) group and listed in the proxy's CONSOLE_PUBLIC, for
 * the reason that makes this route unusual: it creates the brand that a
 * staff session would have to belong to, so it cannot be behind one. Its
 * auth is the setup key, checked in the action.
 *
 * Deliberately unlinked from anywhere in the console. Somebody who needs it
 * has been told the address along with the key, and a link in the nav would
 * be an invitation to everybody who does not.
 */
export default function ProvisionPage() {
  return (
    <>
      <h1 className="cn-h1">Set up a brand</h1>
      <p className="cn-body">
        Creates the brand and its first owner. Everything else - promotions, stores, the rest of the team - they do
        themselves from the console.
      </p>
      <ProvisionForm rootDomain={ROOT_DOMAIN} />
    </>
  );
}
