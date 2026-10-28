import type { ConsoleCampaign } from "@/lib/campaigns/manage";
import { shapeNeedsCard, shapeOfRule } from "@/lib/console/promotion-shape";

/**
 * Setting up one promotion, as an ordered sequence rather than three forms
 * in a column.
 *
 * ── Why this is a function and not markup ────────────────────────────────
 *
 * Every one of these states is read off the campaign the server last sent:
 * whether a rule exists, whether a card threshold has a reward behind it,
 * whether a budget is set, whether it is live. Put that logic in the
 * component and it is only checkable by loading the page and squinting at
 * five circles. Here it is checkable by assertion, which matters because
 * two of the states are the exact failures this page already shouts about
 * in prose, and a stepper that marked them "done" would be arguing with the
 * warning three inches below it.
 *
 * ── Why "attention" is a state and not an error ──────────────────────────
 *
 * A card threshold with no reward, and a live promotion with no budget, are
 * both legal in the database and both already warned about on the card. The
 * engine refuses to *activate* the first and permits the second. So neither
 * is an error to be raised and neither is done: they are steps somebody
 * walked past, where walking past has a cost. The rail draws them
 * differently so the sequence tells the truth about the promotion rather
 * than about how many forms have been submitted.
 */

export type StepId = "name" | "award" | "card" | "cost" | "live";

/**
 * - `done`: there is nothing more to do here.
 * - `todo`: not done, and reachable.
 * - `attention`: answered in a way that has a cost, named in the blurb.
 * - `skipped`: deliberately not used, and that is a complete answer. Only
 *   the card step can be skipped: a promotion that just adds up is a
 *   perfectly ordinary promotion.
 * - `locked`: cannot be started yet, because an earlier step has to exist
 *   first. Only before a promotion exists at all.
 */
export type StepState = "done" | "todo" | "attention" | "skipped" | "locked";

export type PromotionStep = {
  id: StepId;
  /** Two or three words, for the rail. */
  title: string;
  /** One line under the title, in the panel. Says what the step is for. */
  blurb: string;
  state: StepState;
  /** Shown as a word in the rail, so "skipped" does not read as "missed". */
  optional: boolean;
};

/** The order the decision is actually made in, which the engine enforces too. */
export const STEP_ORDER: StepId[] = ["name", "award", "card", "cost", "live"];

const TITLES: Record<StepId, string> = {
  name: "Name it",
  award: "What it awards",
  card: "Stamp card",
  cost: "What it may cost",
  live: "Switch it on",
};

/**
 * Turns a campaign into the five steps, with the state of each.
 *
 * `null` means no promotion is open, which is the state the page starts in:
 * step one is the only thing available and the rest are visibly waiting.
 */
export function promotionSteps(campaign: ConsoleCampaign | null): PromotionStep[] {
  const rule = campaign?.rule ?? null;
  const reward = campaign?.reward ?? null;
  const live = campaign?.status === "ACTIVE";

  const step = (id: StepId, state: StepState, blurb: string, optional = false): PromotionStep => ({
    id,
    title: TITLES[id],
    blurb,
    state,
    optional,
  });

  if (!campaign) {
    return [
      step("name", "todo", "Give it a name you will recognise in a list. Only you see this one."),
      step("award", "locked", "What a shopper gets for a scan. Nothing can be set until the promotion exists."),
      step("card", "locked", "Collect stamps toward something free. Optional.", true),
      step("cost", "locked", "The ceilings that bound what this can ever pay out."),
      step("live", "locked", "Nothing awards until you switch it on."),
    ];
  }

  // Which of the three kinds this is, or null for a rule none of them
  // describe. Everything below reads off it rather than off the row,
  // because a flat rule in stamps and a flat rule in rands are the same
  // row type and two different promotions.
  const shape = shapeOfRule(rule);

  // The card step is four different answers, not one. No rule yet means
  // nothing to decide against; a threshold with no reward is the failure
  // that fills a card and hands over nothing; no threshold at all is a
  // finished decision rather than an omission, unless this is a stamp
  // card, where it is the whole promotion.
  //
  // That last branch is why `optional` is computed rather than passed as
  // true. Calling the card optional on a stamp card was the console
  // telling a coffee shop that the number of coffees was a detail it
  // could skip, and `firstUnfinishedStep` then walked straight past it.
  const needsCard = shapeNeedsCard(shape);
  const card: PromotionStep = !rule
    ? step("card", "locked", "Decide what a scan awards first. A card counts stamps, so it needs the stamps.", true)
    : rule.completesAt == null
      ? needsCard
        ? step(
            "card",
            "todo",
            "A stamp card has to say how many stamps fill it. Buy ten and get the next one free: put 10 here.",
          )
        : step(
            "card",
            "skipped",
            "This promotion adds up and never completes, which is a perfectly ordinary promotion. Add a card here if you want one.",
            true,
          )
      : reward == null
        ? step(
            "card",
            "attention",
            `A card completes at ${rule.completesAt} and nothing says what it earns, so a shopper would collect forever and be given nothing. Name the reward before switching it on.`,
            !needsCard,
          )
        : step("card", "done", `Completes at ${rule.completesAt}, earning ${reward.rewardName}.`, !needsCard);

  // A budget is what stands between a store that cannot sign its slips and
  // an unbounded payout, so a promotion already live without one is the
  // state worth drawing attention to rather than the state worth leaving
  // blank. Not live and no budget is still only "to do".
  const cost: PromotionStep = !rule
    ? step("cost", "locked", "A ceiling needs something to be a ceiling on. Set what it awards first.")
    : rule.maxTotalAmount != null
      ? step("cost", "done", "A total is set, so this promotion stops paying out when it reaches it.")
      : live
        ? step(
            "cost",
            "attention",
            "This is live with no total budget. If any store cannot sign its slips, nothing bounds what it can issue.",
          )
        : step("cost", "todo", "Set a total so the promotion stops paying out at a number you chose.");

  return [
    // "done" rather than "todo": the promotion has a name, so there is
    // nothing outstanding and the sequence should not open here. The step
    // is still editable, which is what stops it reading as a dead end.
    step("name", "done", `Called ${campaign.name}. Change it here if it needs changing; nothing else is affected.`),
    // A rule that is none of the three kinds is not "done". It is the
    // share-in-stamps combination, which multiplies the award by what was
    // spent, and a rail that called it done would be arguing with the
    // error the panel prints underneath it.
    rule
      ? shape
        // Not the kind's own blurb: the chooser three lines below prints
        // that, and the same sentence twice on one short panel reads as a
        // mistake rather than as emphasis.
        ? step("award", "done", "A shopper earns something for every scan that checks out.")
        // Short on purpose. The panel prints the arithmetic underneath,
        // and two paragraphs making the same point reads as a stutter
        // rather than as emphasis.
        : step("award", "attention", "This is set up in a way the console no longer offers.")
      : step("award", "todo", "Decide what a scan is worth. Until this is set the promotion cannot go live."),
    card,
    cost,
    rule
      ? live
        ? step("live", "done", "Live. Scans are earning right now.")
        : step("live", "todo", "Everything above is saved. Switching on starts the earning.")
      : step("live", "locked", "A promotion with nothing to award cannot be switched on."),
  ];
}

/**
 * The step the page should open on: the first that is not finished.
 *
 * "Finished" counts `skipped` and `done` alike, because a card somebody
 * decided against is not a step waiting for them. `attention` is not
 * finished, which is the point: a promotion carrying one of the two costly
 * states opens on it rather than on whatever comes next.
 *
 * Null when every step is settled, which is a live, bounded promotion. The
 * caller shows the summary instead of a form.
 */
export function firstUnfinishedStep(steps: PromotionStep[]): StepId | null {
  return steps.find((s) => s.state === "todo" || s.state === "attention")?.id ?? null;
}

/** Whether a step can be opened at all. */
export function stepReachable(steps: PromotionStep[], id: StepId): boolean {
  return steps.find((s) => s.id === id)?.state !== "locked";
}
