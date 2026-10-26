"use client";

import { useEffect, useRef, useState } from "react";
import type { ConsoleCampaign } from "@/lib/campaigns/manage";
import { CampaignCard } from "./campaign-card";
import { CampaignEditor } from "./campaign-editor";
import { CreateCampaignForm } from "./create-campaign-form";

/**
 * The two halves of this page and the one thing they share: which promotion
 * is open.
 *
 * It lives here rather than in a card because both sides need it. The rail
 * needs to know what to render, and every card needs to know whether it is
 * the one being edited - a panel on the right with nothing marked on the
 * left is a panel belonging to nobody.
 *
 * A client component wrapping both grid areas, returning them as siblings
 * rather than wrapping them in a div: the grid's named areas are placed on
 * these elements, and an extra wrapper between them and .cn-split would
 * collapse the layout into one cell.
 */
export function PromotionsWorkspace({
  campaigns,
  canManage,
}: {
  campaigns: ConsoleCampaign[];
  canManage: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const railRef = useRef<HTMLElement>(null);

  /*
   * Resolved against the live list every render rather than held as an
   * object.
   *
   * The list is re-fetched by router.refresh() after every save, so a held
   * copy would go stale the moment somebody changed what a promotion
   * awards - the rail would keep showing the old values while the card
   * beside it showed the new ones. Resolving by id means the editor always
   * renders what the server last said.
   *
   * It also handles deletion for free: the row disappears from the list,
   * find() returns undefined, and the rail falls back to New promotion
   * instead of editing something that no longer exists.
   */
  const selected = campaigns.find((c) => c.id === selectedId) ?? null;

  /*
   * Bring the rail into view when a promotion is opened.
   *
   * On a phone the rail is below the whole list, so tapping Edit on the
   * first of four promotions would otherwise do nothing a thumb could see.
   * "nearest" rather than "start" so the common case - a wide screen where
   * the rail is already beside the list - scrolls not at all.
   */
  useEffect(() => {
    if (selectedId) railRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return (
    <>
      <div className="cn-split-main">
        {campaigns.length === 0 ? (
          <p className="cn-empty">No promotions yet. Start one on the right.</p>
        ) : (
          campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              canManage={canManage}
              selected={campaign.id === selectedId}
              // A toggle, not a one-way door. Pressing Edit on the promotion
              // already open closes it, which is what a button that reads
              // "Editing" and looks pressed implies.
              onEdit={() => setSelectedId((current) => (current === campaign.id ? null : campaign.id))}
            />
          ))
        )}
      </div>

      <aside className="cn-split-side" ref={railRef}>
        {!canManage ? (
          <section className="cn-panel">
            <div className="cn-panel-head">
              <h2 className="cn-h2">Read only</h2>
            </div>
            <div className="cn-panel-body">
              <p className="cn-body">
                Creating and changing promotions needs an owner or admin. You can see everything here, but not change
                it.
              </p>
            </div>
          </section>
        ) : selected ? (
          /* Keyed on the promotion, so switching from one to another
             remounts the forms. Every field in there is a defaultValue,
             which React applies at mount and never again - without this,
             opening a second promotion would show the first one's numbers
             in boxes labelled with the second one's name. */
          <CampaignEditor key={selected.id} campaign={selected} onDone={() => setSelectedId(null)} />
        ) : (
          <section className="cn-panel">
            <div className="cn-panel-head">
              <h2 className="cn-h2">New promotion</h2>
            </div>
            <CreateCampaignForm />
          </section>
        )}
      </aside>
    </>
  );
}
