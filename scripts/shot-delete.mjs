import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const OUT = process.env.SHOT_DIR;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await ctx.addCookies([{ name: "cios_theme", value: "dark", domain: "app.localhost", path: "/" }]);
const page = await ctx.newPage();
await page.goto("http://app.localhost:3000/login", { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', "owner@copper-kettle.example");
await page.fill('input[name="password"]', "qumo-dev-password");
await page.click('button[type="submit"]');
await page.waitForLoadState("networkidle");
await page.goto("http://app.localhost:3000/promotions", { waitUntil: "networkidle" });
console.log("landed on:", page.url());
if (page.url().includes("/login")) {
  const err = await page.locator(".sc-err, .cn-err, [role=alert]").allTextContents();
  console.log("login error text:", JSON.stringify(err));
  await page.screenshot({ path: `${OUT}/del-00-login-failed.png` });
  throw new Error("not signed in");
}
await page.locator(".cn-promo-grid").first().waitFor({ timeout: 15000 });

const list = page.locator(".cn-promo-grid");
await list.scrollIntoViewIfNeeded();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/del-01-row.png` });
console.log("shot row");

// A draft: deletable.
const draft = page.locator(".cn-promo-grid .cn-panel").filter({ hasText: "Scrap me" }).first();
await draft.getByRole("button", { name: "Delete" }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/del-02-draft-dialog.png` });
console.log("shot draft dialog");
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

// A live one: the dialogue has to explain rather than fail at the server.
const live = page.locator(".cn-promo-grid .cn-panel").filter({ hasText: "5% back" }).first();
await live.getByRole("button", { name: "Delete" }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/del-03-live-dialog.png` });
const confirmDisabled = await page.getByRole("button", { name: "Delete promotion" }).isDisabled();
console.log("live confirm disabled:", confirmDisabled);

await ctx.close();
await browser.close();
