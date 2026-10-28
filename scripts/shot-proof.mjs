import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const OUT = process.env.SHOT_DIR;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto("http://app.localhost:3000/login", { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', "owner@copper-kettle.example");
await page.fill('input[name="password"]', "qumo-dev-password");
await page.click('button[type="submit"]');
await page.waitForLoadState("networkidle");
await page.goto("http://app.localhost:3000/promotions", { waitUntil: "networkidle" });
await page.locator(".cn-flow-rail").first().waitFor({ timeout: 15000 });

const card = page.locator(".cn-promo-grid .cn-panel").filter({ hasText: "5% back" }).first();
await card.getByRole("button", { name: /^(Edit|Set what it awards)$/ }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Step \d\s*What it awards/i }).first().click();
await page.waitForTimeout(400);

const select = page.locator('select[name="minProofTier"]');
await select.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/proof-01-unsigned.png` });
console.log("shot unsigned");

await select.selectOption("SIGNED");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/proof-02-signed.png` });
console.log("shot signed");

// The photograph option must be visibly unavailable while no reader is set.
const photoDisabled = await page.locator('select[name="minProofTier"] option[value="PHOTO"]').isDisabled();
const photoLabel = await page.locator('select[name="minProofTier"] option[value="PHOTO"]').textContent();
console.log("PHOTO option disabled:", photoDisabled, "| label:", JSON.stringify(photoLabel?.trim()));

await ctx.close();
await browser.close();
