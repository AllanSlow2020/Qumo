"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ConsoleCampaign } from "@/lib/campaigns/manage";
import { setStatus } from "./actions";
import { IDLE, type PromoActionState } from "./state";

/**
 * Switching a promotion on or off.
 *
 * Extracted from the card because the last step of the setup flow is this
 * same action, and two copies of it would be two places for the engine's
 * refusal to be rendered differently.
 *
 * Remounted by key when the campaign changes, which resets the action
 * state. Without that, "set what this promotion awards before switching it
 * on" stayed on screen after the rule had been set: an error describing a
 * state that no longer existed.
 */
export function StatusButton({
  campaign,
  live,
  solid = false,
}: {
  campaign: ConsoleCampaign;
  live: boolean;
  /** The setup flow's last step makes this the primary action; the list does not. */
  solid?: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PromoActionState, FormData>(setStatus, IDLE);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <>
      <form action={action}>
        <input type="hidden" name="campaignId" value={campaign.id} />
        <input type="hidden" name="status" value={live ? "PAUSED" : "ACTIVE"} />
        <button type="submit" className={`cn-btn${solid ? "" : " cn-btn-quiet"}`} disabled={pending}>
          {pending ? "…" : live ? "Pause" : "Switch on"}
        </button>
      </form>
      {state.ok === false && (
        <p className="cn-err" role="alert">
          {state.error}
        </p>
      )}
    </>
  );
}
