import { redirect } from "next/navigation";
import { requireBrand } from "@/lib/brand/current";
import { getConsumerSession } from "@/lib/consumer/session";
import { safeShopperRedirect } from "@/lib/consumer/redirect";
import { needsAgeStep } from "@/lib/consumer/age-check";
import { BrandHeader } from "../../brand-header";
import { AgeForm } from "./age-form";

/**
 * The age step, between proving a number and earning anything.
 *
 * ── Why the copy does not say eighteen ───────────────────────────────────
 *
 * It asks for a date of birth and nothing on the page names the threshold.
 * A gate that opens with "you must be 18 to continue" and then asks for a
 * birth year has told the reader the answer and is collecting a formality.
 * Asking neutrally is the difference between a question and a password
 * prompt, and it is the reason the honest answer is the common one.
 *
 * ── Why it is reached rather than shown ──────────────────────────────────
 *
 * A shopper only lands here when the brand they are on has set a minimum
 * and they have not met it. A brand with no restriction never sees this
 * route at all, and someone already confirmed passes straight through, so
 * the step costs nothing to the programmes that do not need it.
 */
export default async function AgePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeShopperRedirect(next);

  const personId = await getConsumerSession();
  if (!personId) {
    redirect(`/wallet/login?next=${encodeURIComponent(`/wallet/age?next=${destination}`)}`);
  }

  const brand = await requireBrand();

  // Already answered, or nothing to answer. Sending them on rather than
  // showing a form that would pass instantly - and this is also what stops
  // the back button parking somebody on a question they have dealt with.
  if (!(await needsAgeStep(brand.id, personId))) {
    redirect(destination);
  }

  return (
    <>
      <BrandHeader />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1 className="sc-h1">One more thing</h1>
        <p className="sc-body">
          {brand.name} needs to know your date of birth before their rewards can pay out. We keep the answer, not
          the date.
        </p>
      </div>
      <AgeForm next={destination} />
    </>
  );
}
