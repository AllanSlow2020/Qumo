import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

/**
 * Screenshots of the promotions setup flow, for review before merging.
 *
 * One login for the whole run. Signing in per context tripped the staff
 * login rate limit on the second attempt and quietly produced a folder of
 * screenshots of the login page, which looked plausible until the file
 * sizes were compared. Theme and viewport are changed in place instead.
 */
const OUT = process.env.SHOT_DIR;
const BASE = "http://app.localhost:3000";
mkdirSync(OUT, { recursive: true });

/*
 * The project pins a newer @playwright/test than the browser some
 * environments have bundled, and `playwright install` would fetch a second
 * copy of Chromium to sit beside a working one. PW_CHROME points at the
 * one that is already there; without it, Playwright resolves its own.
 */
const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
);

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const shot = async (name, opts = {}) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  console.log("shot", name);
};

const setTheme = async (theme) => {
  await ctx.addCookies([{ name: "cios_theme", value: theme, domain: "app.localhost", path: "/" }]);
  await page.reload({ waitUntil: "networkidle" });
};

const step = async (title) => {
  await page.getByRole("button", { name: new RegExp(`Step \\d\\s*${title}`, "i") }).first().click();
  await page.waitForTimeout(300);
};

const openPromo = async (name) => {
  const card = page.locator(".cn-promo-grid .cn-panel").filter({ hasText: name }).first();
  await card.getByRole("button", { name: /^(Edit|Set what it awards)$/ }).click();
  await page.waitForTimeout(500);
};

const backToStart = async () => {
  await page.getByRole("button", { name: "Start another" }).click();
  await page.waitForTimeout(400);
};

// Sign in, once.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', "owner@copper-kettle.example");
await page.fill('input[name="password"]', "qumo-dev-password");
await page.click('button[type="submit"]');
await page.waitForLoadState("networkidle");
await page.goto(`${BASE}/promotions`, { waitUntil: "networkidle" });

// Fail loudly rather than screenshotting a login form for ten minutes.
await page.locator(".cn-flow-rail").first().waitFor({ timeout: 15000 });

await shot("01-page-full", { fullPage: true });
await shot("02-step1-new");

await openPromo("Rounds card");
await shot("03-opens-on-the-flagged-step");
await step("What it awards");
await shot("04-what-it-awards");
await step("Stamp card");
await shot("05-stamp-card-done");
await step("Switch it on");
await shot("06-switch-it-on");

await step("Name it");
await shot("07-name-step-now-editable");

await backToStart();
// Step one before anything exists: Next is there, disabled, and says what
// unlocks it.
await shot("08-new-next-is-explained");

await openPromo("Scrap me");
await shot("09-draft-with-locked-steps");
await backToStart();

await setTheme("dark");
await shot("10-dark-step1");
await openPromo("Rounds card");
await shot("11-dark-flagged-step");
await shot("12-dark-page-full", { fullPage: true });
await backToStart();

await setTheme("light");
await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "networkidle" });
await shot("13-phone-step1");
await openPromo("Rounds card");
await shot("14-phone-flagged-step");
await shot("15-phone-full", { fullPage: true });

await ctx.close();
await browser.close();
console.log("done");
