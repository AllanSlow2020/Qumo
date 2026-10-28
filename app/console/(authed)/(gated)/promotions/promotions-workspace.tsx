"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConsoleCampaign } from "@/lib/campaigns/manage";
import type { ConsoleUiMode } from "@/lib/console/ui-mode";
import { CampaignCard } from "./campaign-card";
import { SetupDrawer } from "./setup-drawer";
import { SetupFlow } from "./setup-flow";

/**
 * The setup flow and what is already running, in one of two shells.
 *
 * ── drawer, the default ──────────────────────────────────────────────────
 *
 * The list gets the whole page and the flow slides over it when you open
 * one. This is the arrangement the original split layout was reaching for:
 * the thing read daily owns the screen, and the thing used occasionally
 * arrives when asked for and leaves again.
 *
 * ── stacked, behind ?ui=stacked ──────────────────────────────────────────
 *
 * What shipped before, kept as the way back without a deploy. The flow
 * sits above the list. Before that it sat in a 330px rail beside it, on
 * the argument that the list is what a brand reads every day and the form
 * is what they use once a month, so the list should have the width. That
 * was right about the priority and wrong about the consequence: the rail
 * was too narrow to explain anything, so three forms in it were nine
 * unexplained fields.
 *
 * Both shells render the same SetupFlow with the same props, which is what
 * made them comparable and is now what keeps the fallback honest: if the
 * drawer has to be switched off, nothing about the flow itself changes.
 *
 * ── What the two share ───────────────────────────────────────────────────
 *
 * Which promotion is open. The flow needs it to know whose steps to draw,
 * and every card needs it to know whether it is the one being worked on.
 */
export function PromotionsWorkspace({
  campaigns,
  canManage,
  photoReady,
  mode,
}: {
  campaigns: ConsoleCampaign[];
  canManage: boolean;
  photoReady: boolean;
  mode: ConsoleUiMode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Only consulted in drawer mode, where a null selection still means "new". */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const flowRef = useRef<HTMLDivElement>(null);

  /*
   * Resolved against the live list every render rather than held as an
   * object.
   *
   * The list is re-fetched by router.refresh() after every save, so a held
   * copy would go stale the moment somebody changed what a promotion
   * awards: the steps would keep showing the old state while the card
   * below showed the new one. Resolving by id means the flow always
   * renders what the server last said, and deletion is handled for free -
   * the row disappears, find() returns undefined, and the flow falls back
   * to step one instead of editing something that no longer exists.
   */
  const selected = campaigns.find((c) => c.id === selectedId) ?? null;
  const drawer = mode === "drawer";

  /*
   * Stacked only. On a phone the flow is above a list that may be long, so
   * tapping Edit on the fourth promotion would otherwise do nothing a
   * thumb could see. "nearest" so a wide screen, where the flow is already
   * in view, scrolls not at all. The drawer needs none of this: it arrives
   * over whatever you were looking at.
   */
  useEffect(() => {
    if (!drawer && selectedId) flowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId, drawer]);

  const close = useCallback(() => {
    setDrawerOpen(false);
    setSelectedId(null);
  }, []);

  const openNew = useCallback(() => {
    setSelectedId(null);
    setDrawerOpen(true);
  }, []);

  // In the drawer, Edit opens it. Stacked keeps the toggle it had: pressing
  // Edit on the promotion already open closes it, which is what a button
  // reading "Editing" and looking pressed implies.
  const onEdit = useCallback(
    (id: string) => {
      if (drawer) {
        setSelectedId(id);
        setDrawerOpen(true);
        return;
      }
      setSelectedId((cur) => (cur === id ? null : id));
    },
    [drawer],
  );

  const flow = (
    /* Keyed on the promotion, so opening a different one rebuilds the flow
       and its step state. Every field inside is a defaultValue, which React
       applies at mount and never again: without this, opening a second
       promotion would show the first one's numbers in boxes labelled with
       the second one's name. */
    <SetupFlow
      key={selected?.id ?? "new"}
      campaign={selected}
      canManage={canManage}
      photoReady={photoReady}
      // In the drawer there is always something to close, including a
      // promotion being created. On the page there is nothing to close
      // until one is open.
      closeLabel={drawer ? "Close" : selected ? "Start another" : null}
      onCreated={setSelectedId}
      onClose={close}
    />
  );

  const list = (
    <div className="cn-promo-list">
      <div className="cn-promo-head">
        <h2 className="cn-h1" style={{ fontSize: 20 }}>
          {campaigns.length === 0 ? "Nothing running yet" : "What is running"}
        </h2>
        {/* The only way into the flow in drawer mode, so it is a real
            button rather than a link in prose. */}
        {drawer && canManage && (
          <button type="button" className="cn-btn" onClick={openNew}>
            New promotion
          </button>
        )}
      </div>

      {campaigns.length === 0 ? (
        <p className="cn-empty">
          {drawer ? "No promotions yet. Start one with the button above." : "No promotions yet. The steps above make the first one."}
        </p>
      ) : (
        <div className="cn-promo-grid">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              canManage={canManage}
              selected={campaign.id === selectedId}
              onEdit={() => onEdit(campaign.id)}
              // Only clears the selection when it was this one. Deleting a
              // draft while editing a different promotion should not close
              // the editor you are working in.
              onDeleted={() => setSelectedId((cur) => (cur === campaign.id ? null : cur))}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (drawer) {
    return (
      <>
        {list}
        <SetupDrawer
          open={drawerOpen}
          onClose={close}
          label={selected ? `Set up ${selected.name}` : "Set up a promotion"}
        >
          {flow}
        </SetupDrawer>
      </>
    );
  }

  return (
    <>
      <div ref={flowRef}>{flow}</div>
      {list}
    </>
  );
}
