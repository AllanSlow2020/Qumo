/**
 * The three worked examples on the How it works page.
 *
 * Each is a small business and the one promotion it would run, with the same
 * facts in the same order: what the customer does, what you set, what bounds
 * it, what to choose carefully, and where it stands today. The reader picks
 * the one nearest their own and reads across.
 *
 * ── Why the numbers are computed ─────────────────────────────────────────
 *
 * Every figure here that the engine could disagree with is worked out by the
 * engine's own function rather than typed in: the rounding on the bottle
 * store's basket, how many scans the tea budget buys, how long ten stamps takes
 * a regular. An example that says "R9.22" beside a ledger that pays R9.23 is a
 * promise the product does not keep, and a typed number is how that happens
 * the first time somebody changes a rule.
 *
 * Invented brands, and made-up till slips: Copper Kettle, Amber Oak and Wild
 * Sage Tea belong to nobody, and the page says so.
 */

import { percentOfSpend } from "@/lib/ledger/percent";
import { calculateCost, formatCount, formatPercent, formatRand } from "./cost";
import { formatDuration, weeksToComplete } from "./card";

export type ExampleId = "coffee" | "bottle" | "tea";

export type ReceiptLine = { name: string; cents: number };

export type Example = {
  id: ExampleId;
  /** The tab. */
  label: string;
  brand: string;
  /** What the promotion pays, in the console's own words. */
  shape: string;
  /** Which of the three codes carries it. */
  code: "A till slip code" | "A pack code";
  /** What is printed, and by what. */
  printed: string;
  /** For a till slip: what is on it. Absent for a pack. */
  receipt?: { lines: ReceiptLine[]; totalCents: number; codeText: string };
  /** For a pack: what is on the label. */
  label_?: { product: string; detail: string; codeText: string };
  facts: { k: string; v: string }[];
  stands: string;
};

/** A till slip's amount, always two decimals, as a printed receipt has it. */
export function slipMoney(cents: number): string {
  return `R${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export const sum = (lines: ReceiptLine[]) => lines.reduce((n, l) => n + l.cents, 0);

const COFFEE_LINES: ReceiptLine[] = [
  { name: "Flat white", cents: 3_200 },
  { name: "Buttermilk rusk", cents: 1_400 },
];

const BOTTLE_LINES: ReceiptLine[] = [
  { name: "Barrel-aged gin", cents: 14_950 },
  { name: "Tonic water x2", cents: 3_500 },
];

export const COFFEE_STAMPS = 10;
export const BOTTLE_BASIS_POINTS = 500;
export const BOTTLE_TOTAL_CENTS = 5_000_000;
export const BOTTLE_DAILY_CENTS = 10_000;
export const TEA_FLAT_CENTS = 500;
export const TEA_TOTAL_CENTS = 2_000_000;
export const TEA_DAILY_CENTS = 1_000;

/**
 * `spendingOpen` is whether a rand balance can be spent at a counter yet
 * (lib/wallet/availability.ts). It is a parameter so the page says what is
 * true today and starts saying the other thing when the flag moves.
 */
export function buildExamples(spendingOpen: boolean): Example[] {
  const coffeeTotal = sum(COFFEE_LINES);
  const bottleTotal = sum(BOTTLE_LINES);

  const earned = percentOfSpend(bottleTotal, BOTTLE_BASIS_POINTS);
  // What the share comes to before the ledger drops the part of a cent.
  const exact = Number(((bottleTotal * BOTTLE_BASIS_POINTS) / 10_000 / 100).toFixed(4));

  const tea = calculateCost({
    shape: "FLAT",
    flatCents: TEA_FLAT_CENTS,
    basisPoints: 0,
    basketCents: 0,
    totalCents: TEA_TOTAL_CENTS,
    perPersonPerDayCents: TEA_DAILY_CENTS,
    scansPerDay: null,
  });

  const daily = formatDuration(weeksToComplete(COFFEE_STAMPS, "days"));
  const monthly = formatDuration(weeksToComplete(COFFEE_STAMPS, "monthly"));

  return [
    {
      id: "coffee",
      label: "Coffee shop, stamp card",
      brand: "Copper Kettle",
      shape: "A stamp toward a card",
      code: "A till slip code",
      printed: "A code on every till slip, printed by the till and signed with a secret only that till holds.",
      receipt: { lines: COFFEE_LINES, totalCents: coffeeTotal, codeText: "SLP-4F2A" },
      facts: [
        {
          k: "The customer",
          v: `Scans the code on the receipt. Their card gets one more mark, and at ${COFFEE_STAMPS} they are issued a free coffee.`,
        },
        {
          k: "You set",
          v: "How many stamps complete a card, what completing one earns, and the total the promotion may ever issue.",
        },
        { k: "What bounds it", v: "The total, and a daily cap per person." },
        {
          k: "Choose carefully",
          v: `The number of stamps. Ten is ${daily} for somebody who comes in most days and ${monthly} for somebody who comes monthly, and a card has to be shorter than the gap between visits or nobody finishes it.`,
        },
      ],
      stands: "Only one promotion can earn from a till slip at a time. The console refuses a second one.",
    },
    {
      id: "bottle",
      label: "Bottle store, share of spend",
      brand: "Amber Oak",
      shape: "A share of what they spend",
      code: "A till slip code",
      printed: "A code on every till slip, carrying the basket total and signed by the till.",
      receipt: { lines: BOTTLE_LINES, totalCents: bottleTotal, codeText: "SLP-9K1D" },
      facts: [
        {
          k: "The customer",
          v: `Scans the receipt and sees what the basket earned: ${formatPercent(BOTTLE_BASIS_POINTS)} of ${formatRand(bottleTotal)} is R${exact}, which the ledger pays as ${formatRand(earned)}, into a rand balance.`,
        },
        {
          k: "You set",
          v: `${formatCount(BOTTLE_BASIS_POINTS)} basis points, which is ${formatPercent(BOTTLE_BASIS_POINTS)}. Whole numbers all the way down, so two machines never pay two people differently for the same basket.`,
        },
        {
          k: "What bounds it",
          v: `A total of ${formatRand(BOTTLE_TOTAL_CENTS)} and a daily cap of ${formatRand(BOTTLE_DAILY_CENTS)} per person.`,
        },
        { k: "Choose carefully", v: "Which of your stores can sign their slips. Stores shows you which can." },
      ],
      stands: spendingOpen
        ? "Where a till cannot sign, the customer controls the basket value in the link. The ceilings bound what that costs but do not close it."
        : "Where a till cannot sign, the customer controls the basket value in the link. The ceilings bound what that costs but do not close it. Spending a rand balance at a counter is not built yet, so today a balance accumulates.",
    },
    {
      id: "tea",
      label: "Tea on the shelf, fixed amount",
      brand: "Wild Sage Tea",
      shape: "The same amount every scan",
      code: "A pack code",
      printed: "A unique code printed once per box, under the label. Reaching it means having the item.",
      label_: { product: "Evening blend", detail: "20 bags", codeText: "PCK-7Q2M" },
      facts: [
        {
          k: "The customer",
          v: "Scans the code under the label. The page says what it was worth and what their balance is now.",
        },
        {
          k: "You set",
          v: `${formatRand(TEA_FLAT_CENTS)} a scan, a total of ${formatRand(TEA_TOTAL_CENTS)}, which is ${formatCount(tea.scansToBudget ?? 0)} scans, and a daily cap of ${formatRand(TEA_DAILY_CENTS)} per person.`,
        },
        {
          k: "What bounds it",
          v: "Each code works once, ever. A second scan of the same code tells the customer what it was worth and adds nothing.",
        },
        {
          k: "Choose carefully",
          v: "Nothing to wire up. This is the route with no technical work, so if you are starting, start here.",
        },
      ],
      stands: "Nothing has to talk to your till. A pack code cannot award a share of spend, because it does not know what was spent.",
    },
  ];
}
