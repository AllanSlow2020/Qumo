"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConsoleCampaign } from "@/lib/campaigns/manage";
import { setLimits, setRule, setStatus } from "./actions";
import { IDLE, type PromoActionState } from "./state";

/** Cents to rands for display; everything is stored and compared as integers. */
function money(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}

function unitAmount(amount: number, unit: string): string {
  if (unit === "CENTS") return money(amount);
  if (unit === "STAMPS") return `${amount} stamp${amount === 1 ? "" : "s"}`;
  return `${amount} point${amount === 1 ? "" : "s"}`;
}

/**
 * One promotion: what it awards, what it may cost, and whether it is live.
 *
 * The three panels are in that order deliberately. A brand decides the offer
 * first, then bounds it, then switches it on - and the engine enforces the
 * same sequence, refusing to activate a promotion with no rule and refusing
 * a ceiling on one that awards nothing yet.
 */
/**
 * Switching a promotion on or off.
 *
 * Its own component so it can be remounted by key when the campaign
 * changes, which resets the action state. Without that, "set what this
 * promotion awards before switching it on" stayed on screen after the rule
 * had been set - an error describing a state that no longer existed.
 */
function StatusButton({ campaign, live }: { campaign: ConsoleCampaign; live: boolean }) {
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
        <button type="submit" className="cn-btn cn-btn-quiet" disabled={pending}>
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

export function CampaignCard({ campaign, canManage }: { campaign: ConsoleCampaign; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [ruleState, ruleAction, rulePending] = useActionState<PromoActionState, FormData>(setRule, IDLE);
  const [limitState, limitAction, limitPending] = useActionState<PromoActionState, FormData>(setLimits, IDLE);

  // Refresh only. The editor deliberately stays open after a save: the
  // offer and its ceilings are two forms filled in one after the other, and
  // closing the panel on the first save would hide the second one just as
  // somebody reached for it. The metrics above update, which is the
  // confirmation that matters.
  useEffect(() => {
    if (ruleState.ok || limitState.ok) {
      router.refresh();
    }
  }, [ruleState, limitState, router]);

  const rule = campaign.rule;
  const live = campaign.status === "ACTIVE";
  const unit = rule?.unit ?? "CENTS";

  // The number a finance director cares about, per promotion: how much of
  // the agreed budget this campaign has already spent. Only meaningful when
  // there is a budget, which is exactly the argument for setting one.
  const budgetUsed = rule?.maxTotalAmount ? Math.min(100, Math.round((campaign.issued / rule.maxTotalAmount) * 100)) : null;

  return (
    <section className="cn-panel">
      <div className="cn-panel-head">
        <div>
          <h2 className="cn-h2">{campaign.name}</h2>
          {campaign.description && <p className="cn-label">{campaign.description}</p>}
        </div>
        <span className={`cn-pill ${live ? "cn-pill-ok" : "cn-pill-off"}`}>
          {live ? "Live" : campaign.status === "DRAFT" ? "Not started" : "Paused"}
        </span>
      </div>

      <div className="cn-panel-body">
        {!rule ? (
          <p className="cn-body">This promotion doesn&apos;t award anything yet.</p>
        ) : (
          <div className="cn-grid">
            <div className="cn-metric">
              <div className="cn-metric-v">
                {rule.type === "PERCENT_OF_SPEND" && rule.basisPoints
                  ? `${Number((rule.basisPoints / 100).toFixed(2))}%`
                  : unitAmount(rule.amount, unit)}
              </div>
              <div className="cn-metric-k">{rule.type === "PERCENT_OF_SPEND" ? "Of every basket" : "Per scan"}</div>
              {rule.minSpendCents ? (
                <div className="cn-metric-note">Baskets over {money(rule.minSpendCents)}</div>
              ) : rule.completesAt ? (
                <div className="cn-metric-note">{rule.completesAt} completes a card</div>
              ) : null}
            </div>

            <div className="cn-metric">
              <div className="cn-metric-v">{unitAmount(campaign.issued, unit)}</div>
              <div className="cn-metric-k">Issued so far</div>
              {rule.maxTotalAmount ? (
                <div className={`cn-metric-note${budgetUsed !== null && budgetUsed >= 80 ? " cn-warn-note" : ""}`}>
                  {budgetUsed}% of {unitAmount(rule.maxTotalAmount, unit)}
                </div>
              ) : (
                <div className="cn-metric-note cn-warn-note">No budget set</div>
              )}
            </div>

            <div className="cn-metric">
              <div className="cn-metric-v">
                {rule.maxPerPersonPerDay ? unitAmount(rule.maxPerPersonPerDay, unit) : "-"}
              </div>
              <div className="cn-metric-k">Per person, per day</div>
              <div className="cn-metric-note">
                {rule.maxScansPerPersonPerDay ? `${rule.maxScansPerPersonPerDay} scans a day` : "No scan limit"}
              </div>
            </div>
          </div>
        )}

        {/* Stated on the promotion itself, not only on the stores page,
            because this is where somebody is deciding what to give away.
            The ceilings are what stands between a store that can't sign its
            slips and an unbounded payout - that is what the forgery suite
            established, and a brand should read it at the moment it matters. */}
        {rule && !rule.maxTotalAmount && (
          <p className="cn-body cn-warn-note">
            No total budget. If any of your stores can&apos;t sign their slips, nothing bounds what this promotion can
            issue - a shopper who has seen one of their own receipts can invent more.
          </p>
        )}

        {canManage && (
          <div className="cn-actions">
            <button type="button" className="cn-btn cn-btn-quiet" onClick={() => setEditing((v) => !v)}>
              {editing ? "Done editing" : rule ? "Edit" : "Set what it awards"}
            </button>

            <StatusButton key={`${campaign.status}-${rule ? "ruled" : "bare"}`} campaign={campaign} live={live} />
          </div>
        )}

        {editing && canManage && (
          <div className="cn-edit">
            {/* Keyed on the rule that came back from the server.
                defaultValue only applies at mount, so after saving a stamp
                rule these selects still read "share of spend" and "rands" -
                the card above said one thing and the form beneath said
                another, and pressing save again would have quietly replaced
                the stamp card with 5% cash. Remounting re-applies them. */}
            <form
              key={`${rule?.type}-${rule?.unit}-${rule?.amount}-${rule?.basisPoints}-${rule?.minSpendCents}`}
              action={ruleAction}
              className="cn-form"
            >
              <h3 className="cn-h2">What it awards</h3>
              <input type="hidden" name="campaignId" value={campaign.id} />

              <div className="cn-field">
                <label htmlFor={`type-${campaign.id}`}>Kind</label>
                <select
                  id={`type-${campaign.id}`}
                  name="type"
                  className="cn-input"
                  defaultValue={rule?.type ?? "PERCENT_OF_SPEND"}
                >
                  <option value="PERCENT_OF_SPEND">A share of what they spend - needs a till slip</option>
                  <option value="FLAT_PER_SCAN">A fixed amount per scan - works on packs and stickers</option>
                </select>
              </div>

              <div className="cn-field">
                <label htmlFor={`unit-${campaign.id}`}>Awarded in</label>
                <select id={`unit-${campaign.id}`} name="unit" className="cn-input" defaultValue={unit}>
                  <option value="CENTS">Rands, spendable at the till</option>
                  <option value="POINTS">Points</option>
                  <option value="STAMPS">Stamps, toward a card</option>
                </select>
              </div>

              {/* Both sets of fields are always present. The engine reads
                  only the ones its rule type needs, and hiding the others
                  behind JavaScript would mean a form that behaves
                  differently depending on whether the script loaded. */}
              <div className="cn-field">
                <label htmlFor={`bp-${campaign.id}`}>Share of the basket, in basis points</label>
                <input
                  id={`bp-${campaign.id}`}
                  name="basisPoints"
                  className="cn-input"
                  type="number"
                  min={1}
                  max={10000}
                  defaultValue={rule?.basisPoints ?? 500}
                />
                <p className="cn-label">500 is 5%. Only used for a share-of-spend promotion.</p>
              </div>

              <div className="cn-field">
                <label htmlFor={`amt-${campaign.id}`}>Fixed amount per scan</label>
                <input
                  id={`amt-${campaign.id}`}
                  name="amount"
                  className="cn-input"
                  type="number"
                  min={1}
                  defaultValue={rule?.amount || 1}
                />
                <p className="cn-label">In the unit above - cents, points or stamps. Only used for a fixed promotion.</p>
              </div>

              <div className="cn-field">
                <label htmlFor={`min-${campaign.id}`}>Minimum basket, in cents (optional)</label>
                <input
                  id={`min-${campaign.id}`}
                  name="minSpendCents"
                  className="cn-input"
                  type="number"
                  min={0}
                  defaultValue={rule?.minSpendCents ?? ""}
                />
              </div>

              {ruleState.ok === false && (
                <p className="cn-err" role="alert">
                  {ruleState.error}
                </p>
              )}
              <button type="submit" className="cn-btn" disabled={rulePending} style={{ alignSelf: "flex-start" }}>
                {rulePending ? "Saving…" : ruleState.ok ? "Saved - save again" : "Save what it awards"}
              </button>
            </form>

            <form
              key={`${rule?.maxTotalAmount}-${rule?.maxPerPersonPerDay}-${rule?.maxScansPerPersonPerDay}-${rule?.completesAt}`}
              action={limitAction}
              className="cn-form"
            >
              <h3 className="cn-h2">What it may cost</h3>
              <input type="hidden" name="campaignId" value={campaign.id} />

              <div className="cn-field">
                <label htmlFor={`cap-total-${campaign.id}`}>Total this promotion may ever issue</label>
                <input
                  id={`cap-total-${campaign.id}`}
                  name="maxTotalAmount"
                  className="cn-input"
                  type="number"
                  min={1}
                  defaultValue={rule?.maxTotalAmount ?? ""}
                  placeholder="e.g. 500000 for R5,000"
                />
                <p className="cn-label">
                  In the promotion&apos;s own unit. Once reached, it stops awarding - it does not stop existing.
                </p>
              </div>

              <div className="cn-field">
                <label htmlFor={`cap-day-${campaign.id}`}>Most one person can earn in a day</label>
                <input
                  id={`cap-day-${campaign.id}`}
                  name="maxPerPersonPerDay"
                  className="cn-input"
                  type="number"
                  min={1}
                  defaultValue={rule?.maxPerPersonPerDay ?? ""}
                />
              </div>

              <div className="cn-field">
                <label htmlFor={`cap-scans-${campaign.id}`}>Most scans one person can make in a day</label>
                <input
                  id={`cap-scans-${campaign.id}`}
                  name="maxScansPerPersonPerDay"
                  className="cn-input"
                  type="number"
                  min={1}
                  defaultValue={rule?.maxScansPerPersonPerDay ?? ""}
                />
              </div>

              <div className="cn-field">
                <label htmlFor={`completes-${campaign.id}`}>Stamps that complete a card (optional)</label>
                <input
                  id={`completes-${campaign.id}`}
                  name="completesAt"
                  className="cn-input"
                  type="number"
                  min={1}
                  defaultValue={rule?.completesAt ?? ""}
                />
                <p className="cn-label">Buy ten, get the tenth free: put 10 here.</p>
              </div>

              {limitState.ok === false && (
                <p className="cn-err" role="alert">
                  {limitState.error}
                </p>
              )}
              {/* Said next to the button that clears them, because an empty
                  box meaning "no ceiling" is the sort of thing people
                  discover afterwards. */}
              <p className="cn-label">
                A box left empty means no ceiling at all. Saving with them empty removes any you had.
              </p>
              <button type="submit" className="cn-btn" disabled={limitPending} style={{ alignSelf: "flex-start" }}>
                {limitPending ? "Saving…" : limitState.ok ? "Saved - save again" : "Save the ceilings"}
              </button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
