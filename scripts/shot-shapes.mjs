import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

/**
 * Step two, in each of the kinds it can be.
 *
 * Every branch is photographed on a promotion that is already that kind,
 * rather than by switching one promotion through all three. Switching
 * trips the engine's own guard (a brand may run one spend-based promotion
 * at a time), which is correct behaviour and makes a poor screenshot.
 */
const OUT = process.env.SHOT_DIR;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const shot = async (n, o = {}) => {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${n}.png`, ...o });
  console.log("shot", n);
};

// Twice if need be. The first submit after a code change races the dev
// server compiling the sign-in action: the POST is swallowed, the page
// stays on /login, and every step after this quietly runs signed out.
for (let attempt = 1; ; attempt += 1) {
  await page.goto("http://app.localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "owner@copper-kettle.example");
  await page.fill('input[name="password"]', "qumo-dev-password");
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30000 });
    break;
  } catch (err) {
    if (attempt >= 3) throw err;
    console.log("sign-in did not land, retrying");
  }
}
await page.waitForLoadState("networkidle");

const list = async () => {
  await page.goto("http://app.localhost:3000/promotions?ui=drawer", { waitUntil: "networkidle" });
  await page.locator(".cn-promo-grid").first().waitFor({ timeout: 20000 });
};

const open = async (name) => {
  await list();
  const card = page.locator(".cn-promo-grid .cn-panel").filter({ hasText: name }).first();
  await card.getByRole("button", { name: /^(Edit|Editing|Set what it awards|Set it up)$/ }).first().click();
  await page.waitForTimeout(900);
};

const gotoStep = async (title) => {
  await page.locator(".cn-flow-btn").filter({ hasText: title }).first().click();
  await page.waitForTimeout(800);
};

await list();
await shot("sh-01-list");

// A stamp card, which is now what the card says it is.
await open("Rounds card");
await gotoStep("What it awards");
await shot("sh-02-stamp-card");
await gotoStep("Stamp card");
await shot("sh-03-card-step-required");

// A share of spend: a percentage, a floor in rands, and the proof tier,
// which is the only kind the engine actually reads it for.
await open("5% back");
await gotoStep("What it awards");
await shot("sh-04-share-of-spend");

// A fixed award, in rands or points.
await open("Meal deal sleeve");
await gotoStep("What it awards");
await shot("sh-05-fixed-amount");

// The combination the console will not create any more.
await open("Legacy stamp share");
await gotoStep("What it awards");
await shot("sh-06-legacy-warning");

// And choosing a kind for it, with the select and its explanation in
// agreement: the thing the remount key used to break.
await page.selectOption('select[name="shape"]', { label: "A stamp card. Buy ten, get one free" });
await shot("sh-07-choosing");

await browser.close();
