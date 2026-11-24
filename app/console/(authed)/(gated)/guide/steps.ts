import { setupSteps } from "@/lib/console/setup-state";

/**
 * The six steps, once.
 *
 * They are the Overview's getting-started checklist, and the title and the
 * sentence that says what to do are read from it (lib/console/setup-state.ts)
 * rather than typed again, so the two cannot drift: the console has one
 * picture of setting up and this page is its longer form. What lives here is
 * what the checklist does not have: the line under the title, which screens a
 * step uses and the buttons into them. The figures and the reasons are on the
 * page itself, because they are components and not data.
 *
 * ── The old section addresses ────────────────────────────────────────────
 *
 * Other screens link into this page by an address (`/guide#cost`, from the
 * Stores screen, and so on) and those links predate the steps. They are
 * kept, and each now names the element on the page that carries it. Opening
 * a link opens the step, or the fold, that holds that element and scrolls to
 * it. `ANCHORS` is the list, and tests/guide-structure.test.ts holds the page
 * and the links in the rest of the console to it.
 */

export type StepAction = { label: string; href: string; quiet?: boolean };

export interface Step {
  n: number;
  title: string;
  /** One line, shown whether or not the step is open. */
  sub: string;
  /** What to do, said the way the card said it before the steps. */
  text: string;
  /** The screens it uses, by the name in the menu. */
  screens: string[];
  actions: StepAction[];
}

type Own = Omit<Step, "title" | "text">;

const OWN: readonly Own[] = [
  {
    n: 1,
    sub: "Name it. It starts switched off.",
    screens: ["Promotions"],
    actions: [{ label: "Open Promotions", href: "/promotions" }],
  },
  {
    n: 2,
    sub: "What a scan is worth to your customer.",
    screens: ["Promotions"],
    actions: [{ label: "Open Promotions", href: "/promotions" }],
  },
  {
    n: 3,
    sub: "The most it may ever issue.",
    screens: ["Promotions"],
    actions: [{ label: "Open Promotions", href: "/promotions" }],
  },
  {
    n: 4,
    sub: "Pack codes, or stores whose slips carry a code.",
    screens: ["Pack codes", "Stores"],
    actions: [
      { label: "Open Pack codes", href: "/codes" },
      { label: "Open Stores", href: "/stores", quiet: true },
    ],
  },
  {
    n: 5,
    sub: "Until you do, a code earns nothing.",
    screens: ["Promotions"],
    actions: [{ label: "Open Promotions", href: "/promotions" }],
  },
  {
    n: 6,
    sub: "The only step that proves the other five.",
    screens: ["Pack codes", "Overview"],
    actions: [{ label: "See your codes", href: "/codes" }],
  },
];

/** The checklist's words for a brand that has done nothing yet; only the words are used. */
const NOTHING_YET = {
  campaigns: 0,
  campaignsWithRule: 0,
  campaignsWithBudget: 0,
  activeCampaigns: 0,
  packBatches: 0,
  signingStores: 0,
  everAwarded: false,
};

const WORDS = setupSteps(NOTHING_YET);

export const STEPS: readonly Step[] = OWN.map((own, i) => ({ ...own, title: WORDS[i]!.title, text: WORDS[i]!.detail }));

/**
 * The addresses other screens use, and what each one is. The page puts each
 * of these on one element.
 */
export const ANCHORS = ["what", "examples", "awards", "cards", "cost", "codes", "shopper", "ending"] as const;

export type Anchor = (typeof ANCHORS)[number];
