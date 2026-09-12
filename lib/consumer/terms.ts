import { HONOUR_WINDOW_DAYS } from "@/lib/subscriptions/state";
import { OPERATOR_NAME, PRODUCT_NAME } from "@/lib/product";

/**
 * The terms a shopper is on, rendered at /legal/terms.
 *
 * Written to the same rule as the privacy notice next door: every clause
 * describes something the code actually does, and where the code does not
 * do a thing yet, this says so rather than promising it. A term that is
 * aspirational is a term the shopper will one day quote back at us.
 *
 * The two documents are deliberately separate. The privacy notice answers
 * "what do you hold about me", which POPIA governs and which a shopper
 * agrees to at the tick box. This answers "what is this balance and what
 * can I do with it", which is contract rather than data protection. Merging
 * them would produce one document nobody finishes reading.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  NOT YET REVIEWED BY A LAWYER. Same standing as the consent copy: written
 *  in good faith, claiming nothing the system does not do, and needing a
 *  review against the CPA and POPIA before the first real shopper. The
 *  operator vs responsible party question in docs/qumo-architecture.md
 *  changes clause 2, and settling it is the point at which this wants
 *  looking at properly.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Versioned like the consent copy, and for the same reason: a shopper who
 * disputes something is entitled to be judged against the words they were
 * shown. Bump on any change of substance.
 */
export const TERMS_VERSION = "terms-v1";

export const TERMS_POINTS: { heading: string; body: string }[] = [
  {
    heading: "What this is",
    body: `A rewards programme run by a brand you buy from. ${PRODUCT_NAME} is the software it runs on. The brand decides what the programme pays, which promotions run, and when they end; ${PRODUCT_NAME} counts it and keeps the record.`,
  },
  {
    heading: "Who you are dealing with",
    body: `Two parties, and it is worth knowing which is which. The brand sold you the thing and runs the promotion. ${OPERATOR_NAME} runs the programme it is counted in and keeps the record. So anything about a price, a product or a store is the brand's; anything about a balance, a scan that did not work, or a record that looks wrong is ours, and the brand can raise it with us on your behalf.`,
  },
  {
    heading: "What a balance is",
    body: "Points, stamps and wallet value are a record of what you have earned with one brand. They are not money and not a deposit. They cannot be exchanged for cash, transferred to anyone else, or used with a different brand, and not because of a rule we could waive: but because value earned with one brand is held against that brand and nowhere else.",
  },
  {
    heading: "How you earn",
    body: `Scan a code that proves a purchase (a till slip, a pack, a sticker) and the brand's promotion decides what it is worth. Each slip and each code earns once, ever. A slip more than 30 days old is too old to scan. A promotion may cap what one person can earn in a day and what it will hand out in total, and those caps are applied at the moment of the scan.`,
  },
  {
    heading: "When a scan does not earn",
    body: "A code we cannot verify earns nothing. That covers a slip whose signature does not check out, a code already used, a total that has been edited, and a scan for a promotion that is not running. Nothing is deducted from you when this happens. The scan simply does not count, and the screen says why.",
  },
  {
    heading: "Using what you have earned",
    body: "Redemption is not open yet. What you earn is recorded and held for you; the brand decides how you eventually use it and will tell you when that opens. Your balance does not expire while the programme is running. An individual reward, such as a coupon for a completed card, can carry its own expiry date, and where it does, that date is shown on the reward itself.",
  },
  {
    heading: "If the brand ends the programme",
    body: `Earning stops the day the brand ends it. Anything you have already earned stays yours to use for ${HONOUR_WINDOW_DAYS} days after that, and then the programme closes. Nothing is deleted. If the brand starts again, your balance is where you left it.`,
  },
  {
    heading: "Leaving",
    body: "You can leave a brand's programme whenever you like, from your own details page, without asking anyone. Leaving stops you earning immediately. You can also ask for a copy of everything held about you, or ask for it to be deleted. The privacy notice covers how.",
  },
  {
    heading: "Getting it wrong on purpose",
    body: "Forging a slip, copying a code, or scanning purchases that are not yours is not a loophole in the programme, it is the thing the programme is built to detect. Where we find it, the brand can refuse the value and end that membership. Honest mistakes are not this, and we would rather hear about one than find it.",
  },
  {
    heading: "Changes",
    body: `A brand can change or end its own promotions at any time, and value you have already earned is not taken away when it does. If we change these terms in substance, the version below changes with them and you will be shown the new ones the next time you sign in.`,
  },
  {
    heading: "Where you stand",
    body: `These terms are governed by South African law, and nothing in them takes away a right you have under the Consumer Protection Act or the Protection of Personal Information Act. If a clause here turns out to be unenforceable, the rest still stands.`,
  },
];
