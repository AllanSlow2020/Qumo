"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConsoleCampaign } from "@/lib/campaigns/manage";
import { CampaignCard } from "./campaign-card";
import { SetupFlow } from "./setup-flow";

/**
 * The setup flow, and under it what is already running.
 *
 * ── Why setup is on top now ──────────────────────────────────────────────
 *
 * It used to sit in a 330px rail beside the list, on the argument that the
 * list is what a brand reads every day and the form is what they use once a
 * month, so the list should have the width. That argument was right about
 * the priority and wrong about the consequence: the rail was too narrow to
 * explain anything, so the three forms in it were nine unexplained fields,
 * and a brand setting up their first promotion was the one person the page
 * had no room for.
 *
 * Putting the sequence first only works because it is a sequence. One step
 * is short, so the list still starts above the fold on a laptop. Three
 * stacked forms there would have buried it, which is exactly what the old
 * comment warned about.
 *
 * ── What the two halves share ────────────────────────────────────────────
 *
 * Which promotion is open. The flow needs it to know whose steps to draw,
 * and every card needs it to know whether it is the one being worked on. A
 * panel of fields belonging to no visible row is a panel belonging to
 * nobody.
 */
export function PromotionsWorkspace({
  campaigns,
  canManage,
}: {
  campaigns: ConsoleCampaign[];
  canManage: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  /*
   * Resolved against the live list every render rather than held as an
   * object.
   *
   * The list is re-fetched by router.refresh() after every save, so a held
   * copy would go stale the moment somebody changed what a promotion
   * awards: the steps would keep showing the old state while the card below
   * showed the new one. Resolving by id means the flow always renders what
   * the server last said.
   *
   * It also handles deletion for free: the row disappears from the list,
   * find() returns undefined, and the flow falls back to step one instead
   * of editing something that no longer exists.
   */
  const selected = campaigns.find((c) => c.id === selectedId) ?? null;

  /*
   * Bring the flow into view when a promotion is opened from the list
   * below. "nearest" rather than "start", so opening one while the flow is
   * already on screen scrolls not at all.
   */
  useEffect(() => {
    if (selectedId) flowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  // Stable, because CreateCampaignForm has it in an effect's dependencies.
  const close = useCallback(() => setSelectedId(null), []);

  return (
    <>
      <div ref={flowRef}>
        {/* Keyed on the promotion, so opening a different one rebuilds the
            flow and its step state. Every field inside is a defaultValue,
            which React applies at mount and never again: without this,
            opening a second promotion would show the first one's numbers in
            boxes labelled with the second one's name. */}
        <SetupFlow
          key={selected?.id ?? "new"}
          campaign={selected}
          canManage={canManage}
          onCreated={setSelectedId}
          onClose={close}
        />
      </div>

      <div className="cn-promo-list">
        <h2 className="cn-h1" style={{ fontSize: 20 }}>
          {campaigns.length === 0 ? "Nothing running yet" : "What is running"}
        </h2>
        {campaigns.length === 0 ? (
          <p className="cn-empty">No promotions yet. The steps above make the first one.</p>
        ) : (
          <div className="cn-promo-grid">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                canManage={canManage}
                selected={campaign.id === selectedId}
                // A toggle, not a one-way door. Pressing Edit on the
                // promotion already open closes it, which is what a button
                // that reads "Editing" and looks pressed implies.
                onEdit={() => setSelectedId((cur) => (cur === campaign.id ? null : campaign.id))}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
