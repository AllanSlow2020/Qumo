"use client";

import type { ConsoleCampaign } from "@/lib/campaigns/manage";
import { Ticker } from "@/app/console/ticker";
import { StatusButton } from "./status-button";

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
 * One promotion, as the list shows it: what it does, what it has cost, and
 * whether it is on. No forms - those moved to the rail (campaign-editor).
 *
 * `selected` is drawn rather than inferred from anything, because a brand
 * looking at a column of four cards and a panel on the right has to be able
 * to tell at a glance which of the four the panel belongs to.
 */
export function CampaignCard({
  campaign,
  canManage,
  selected,
  onEdit,
}: {
  campaign: ConsoleCampaign;
  canManage: boolean;
  selected: boolean;
  onEdit: () => void;
}) {
  const rule = campaign.rule;
  const live = campaign.status === "ACTIVE";
  const unit = rule?.unit ?? "CENTS";

  // The number a finance director cares about, per promotion: how much of
  // the agreed budget this campaign has already spent. Only meaningful when
  // there is a budget, which is exactly the argument for setting one.
  const budgetUsed = rule?.maxTotalAmount ? Math.min(100, Math.round((campaign.issued / rule.maxTotalAmount) * 100)) : null;

  return (
    <section className={`cn-panel${selected ? " cn-panel-on" : ""}`}>
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
                <Ticker
                  value={
                    rule.type === "PERCENT_OF_SPEND" && rule.basisPoints
                      ? `${Number((rule.basisPoints / 100).toFixed(2))}%`
                      : unitAmount(rule.amount, unit)
                  }
                />
              </div>
              <div className="cn-metric-k">{rule.type === "PERCENT_OF_SPEND" ? "Of every basket" : "Per scan"}</div>
              {rule.minSpendCents ? (
                <div className="cn-metric-note">Baskets over {money(rule.minSpendCents)}</div>
              ) : rule.completesAt ? (
                <div className={`cn-metric-note${campaign.reward ? "" : " cn-warn-note"}`}>
                  {rule.completesAt} completes a card
                  {campaign.reward ? `: ${campaign.reward.rewardName}` : ", earning nothing"}
                </div>
              ) : null}
            </div>

            <div className="cn-metric">
              <div className="cn-metric-v">
                <Ticker value={unitAmount(campaign.issued, unit)} />
              </div>
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
                <Ticker value={rule.maxPerPersonPerDay ? unitAmount(rule.maxPerPersonPerDay, unit) : "-"} />
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
        {/* The failure this form was built to stop. A threshold with no
            reward behind it issues nothing on completion - applyAccrual
            needs both - so the card fills past the end and the shopper is
            never given anything. Switching it on is refused now, but a
            paused promotion in this state should still say so. */}
        {rule?.completesAt && !campaign.reward && (
          <p className="cn-body cn-warn-note">
            This card completes at {rule.completesAt} and nothing says what it earns, so shoppers would collect
            forever and be given nothing. Set the reward before switching it on.
          </p>
        )}

        {rule && !rule.maxTotalAmount && (
          <p className="cn-body cn-warn-note">
            No total budget. If any of your stores can&apos;t sign their slips, nothing bounds what this promotion can
            issue - a shopper who has seen one of their own receipts can invent more.
          </p>
        )}

        {canManage && (
          <div className="cn-actions">
            {/* aria-pressed rather than a class alone: "which one am I
                editing" is a state, and a sighted brand reads it off the
                panel's border while everybody else reads it off this. */}
            <button
              type="button"
              className={`cn-btn ${selected ? "" : "cn-btn-quiet"}`}
              aria-pressed={selected}
              onClick={onEdit}
            >
              {selected ? "Editing" : rule ? "Edit" : "Set what it awards"}
            </button>

            <StatusButton key={`${campaign.status}-${rule ? "ruled" : "bare"}`} campaign={campaign} live={live} />
          </div>
        )}

      </div>
    </section>
  );
}
