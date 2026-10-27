"use client";

import { useState } from "react";
import type { ConsoleCampaign } from "@/lib/campaigns/manage";
import {
  firstUnfinishedStep,
  promotionSteps,
  type StepId,
} from "@/lib/console/promotion-steps";
import { CreateCampaignForm } from "./create-campaign-form";
import { StepBody } from "./campaign-editor";
import { SetupStepper } from "./setup-stepper";

/**
 * Setting a promotion up, as one panel with five steps in it.
 *
 * ── Why this is remounted rather than reset ──────────────────────────────
 *
 * The workspace keys this component on the open promotion's id, so opening
 * a different one builds a new instance and `open` initialises again from
 * that promotion's own state. Doing it with an effect instead would mean a
 * render where the rail belongs to one promotion and the form to another,
 * and every field inside is a defaultValue, so that render is the one the
 * boxes keep.
 *
 * ── Why saving does not advance the step ─────────────────────────────────
 *
 * Each form saves on its own and the panel stays where it is. Advancing
 * automatically would be right if these were five questions asked once, and
 * they are not: most visits to this page are somebody changing one number
 * on a promotion that already runs. Being moved off the field you just
 * corrected, onto a step you did not ask for, is worse than pressing Next.
 * So Next exists, says where it goes, and is never pressed for you.
 */
export function SetupFlow({
  campaign,
  canManage,
  photoReady,
  onCreated,
  onClose,
}: {
  /** Null while no promotion is open, which is the page's starting state. */
  campaign: ConsoleCampaign | null;
  canManage: boolean;
  photoReady: boolean;
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const steps = promotionSteps(campaign);

  // Opens on the first thing still to do, which for a promotion carrying
  // one of the two costly states is that state rather than whatever comes
  // after it. Falls back to the last step, which is the summary: a promotion
  // with nothing outstanding is one you came here to switch on or read.
  const [open, setOpen] = useState<StepId>(() => firstUnfinishedStep(steps) ?? "live");

  const current = steps.find((s) => s.id === open) ?? steps[0]!;
  const at = steps.findIndex((s) => s.id === current.id);
  const number = at + 1;

  /*
   * Next is the next step in the sequence, locked or not.
   *
   * It used to be the next *reachable* step, which meant a fresh promotion
   * showed Back and no Next at all: the one screen where somebody has no
   * idea what comes next was the one that declined to say. The button is
   * there now, disabled, naming the step and the single thing that unlocks
   * it. Back stays reachable-only, since there is never a locked step
   * behind you.
   */
  const next = at >= 0 && at < steps.length - 1 ? steps[at + 1] : undefined;
  const nextLocked = next?.state === "locked";
  const reachable = steps.filter((s) => s.state !== "locked");
  const behind = reachable.findIndex((s) => s.id === current.id);
  const back = behind > 0 ? reachable[behind - 1] : undefined;

  // Every locked step in this flow is locked by one of two things, and
  // which one depends only on whether the promotion exists yet.
  const unlockedBy = campaign ? "Save what it awards to carry on." : "Create the promotion to carry on.";

  if (!canManage) {
    return (
      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">Read only</h2>
        </div>
        <div className="cn-panel-body">
          <p className="cn-body">
            Creating and changing promotions needs an owner or admin. You can see everything here, but not change it.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="cn-panel">
      <div className="cn-panel-head">
        <div>
          <h2 className="cn-h2">{campaign ? campaign.name : "Set up a promotion"}</h2>
          <p className="cn-label">
            {campaign
              ? "Five steps. Each one saves on its own, so you can stop and come back."
              : "Five steps, starting with a name. Nothing awards anything until the last one."}
          </p>
        </div>
        {/* Only when a promotion is open, because closing hands the flow
            back to step one. With nothing open there is nothing to close. */}
        {campaign && (
          <button type="button" className="cn-btn cn-btn-quiet" onClick={onClose}>
            Start another
          </button>
        )}
      </div>

      <div className="cn-panel-body">
        <SetupStepper steps={steps} open={open} onPick={setOpen} />

        <div className="cn-flow-panel">
          <h3 className="cn-h2">
            <span className="cn-flow-of">Step {number} of {steps.length}</span>
            {current.title}
          </h3>

          {campaign ? (
            <StepBody campaign={campaign} step={current} photoReady={photoReady} onDeleted={onClose} />
          ) : (
            <>
              <p className="cn-body" style={{ marginTop: 0 }}>
                {current.blurb}
              </p>
              <CreateCampaignForm onCreated={onCreated} />
            </>
          )}

          {/* Step navigation, separate from the save buttons above it. A
              form here saves one answer; these move between questions. */}
          {(back || next) && (
            <div className="cn-flow-nav">
              {back ? (
                <button type="button" className="cn-btn cn-btn-quiet" onClick={() => setOpen(back.id)}>
                  Back: {back.title}
                </button>
              ) : (
                <span />
              )}
              {next && (
                <span className="cn-flow-fwd">
                  {nextLocked && <span className="cn-label">{unlockedBy}</span>}
                  <button
                    type="button"
                    className="cn-btn cn-btn-quiet"
                    onClick={() => setOpen(next.id)}
                    disabled={nextLocked}
                    aria-disabled={nextLocked || undefined}
                  >
                    Next: {next.title}
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
