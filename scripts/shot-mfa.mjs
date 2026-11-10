import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = process.env.SHOT_DIR;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto("http://app.localhost:3000/login", { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', "owner@copper-kettle.example");
await page.fill('input[name="password"]', "qumo-dev-password");
// Scoped to the login form: the first submit button on a console page is
// the theme toggle.
await page.locator('form.cn-form button[type="submit"]').click();

// The gate should land us on /security without being asked for it.
await page.waitForFunction(() => !location.pathname.startsWith("/login"), { timeout: 20000 });
await page.waitForLoadState("networkidle");
console.log("after login, landed on:", new URL(page.url()).pathname);

await page.screenshot({ path: `${OUT}/mfa-01-gate.png`, fullPage: true });
console.log("shot the gate");

// And the gate must hold against a direct attempt at a console screen.
await page.goto("http://app.localhost:3000/promotions", { waitUntil: "networkidle" });
console.log("asked for /promotions, ended on:", new URL(page.url()).pathname);

await ctx.close();
await browser.close();
