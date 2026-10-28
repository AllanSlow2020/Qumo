import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const OUT = process.env.SHOT_DIR;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const signIn = async () => {
  await page.goto("http://app.localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "owner@copper-kettle.example");
  await page.fill('input[name="password"]', "qumo-dev-password");
  await page.click('button[type="submit"]');
  // Wait for the sign-in to actually land, not for the network to go
  // quiet. On the first hit after a dev restart the server action is still
  // compiling, networkidle resolves on the login page itself, and every
  // step after this quietly runs signed out.
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 60000 });
  await page.waitForLoadState("networkidle");
};
const shot = async (n, o = {}) => { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${n}.png`, ...o }); console.log("shot", n); };

await signIn();

// Drawer mode, closed: the list owns the page.
await page.goto("http://app.localhost:3000/promotions?ui=drawer", { waitUntil: "networkidle" });
await page.locator(".cn-promo-grid").first().waitFor({ timeout: 20000 });
await shot("dr-01-list-only");

// Open an existing promotion.
const card = page.locator(".cn-promo-grid .cn-panel").filter({ hasText: "Rounds card" }).first();
await card.getByRole("button", { name: /^(Edit|Set what it awards)$/ }).click();
await page.waitForTimeout(800);
await shot("dr-02-open-edit");

// Escape must close it, since that is half the reason for using <dialog>.
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
const stillOpen = await page.locator(".cn-drawer[open]").count();
console.log("open after Escape:", stillOpen);

// New promotion from the toolbar.
await page.getByRole("button", { name: "New promotion" }).click();
await page.waitForTimeout(800);
await shot("dr-03-new");
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

// Dark.
await ctx.addCookies([{ name: "cios_theme", value: "dark", domain: "app.localhost", path: "/" }]);
await page.reload({ waitUntil: "networkidle" });
await page.locator(".cn-promo-grid").first().waitFor();
await page.locator(".cn-promo-grid .cn-panel").filter({ hasText: "Rounds card" }).first()
  .getByRole("button", { name: /^(Edit|Set what it awards)$/ }).click();
await page.waitForTimeout(800);
await shot("dr-04-dark");
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

// Phone: the drawer takes the full width.
await ctx.addCookies([{ name: "cios_theme", value: "light", domain: "app.localhost", path: "/" }]);
await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "networkidle" });
await page.locator(".cn-promo-grid").first().waitFor();
await page.locator(".cn-promo-grid .cn-panel").filter({ hasText: "Rounds card" }).first()
  .getByRole("button", { name: /^(Edit|Set what it awards)$/ }).click();
await page.waitForTimeout(800);
await shot("dr-05-phone");

// And the shipped layout is untouched without the parameter.
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto("http://app.localhost:3000/promotions", { waitUntil: "networkidle" });
await page.locator(".cn-flow-rail").first().waitFor({ timeout: 20000 });
console.log("stacked still has an inline rail:", await page.locator(".cn-flow-rail").count());
console.log("stacked has no drawer:", await page.locator(".cn-drawer").count());

await ctx.close();
await browser.close();
