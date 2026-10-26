/**
 * Photographs the running product for the deck.
 *
 * The deck's whole claim is that every screen in it is a live render rather
 * than a mockup, so the screenshots are regenerated from a running build
 * instead of being committed. A committed PNG goes stale silently and takes
 * the claim with it; this script going stale fails loudly.
 *
 * Needs a seeded database and a server on :3000 with a TLS front on :443.
 * See README.md in this directory for the exact sequence.
 *
 *   node deck/capture.mjs <brand-slug> <batch-id> <provision-secret> [unscanned-code]
 *
 * Pass an unscanned pack code and the award screen is captured too, which
 * is the one screen that shows the moment the mechanic pays.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SHOTS = path.join(ROOT, "shots");
const ART = path.join(ROOT, "art");
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(ART, { recursive: true });

const [SLUG = "copper-kettle", BATCH, SECRET, CODE] = process.argv.slice(2);
const CONSOLE = "https://app.qumo-app.com";
const SHOP = `https://${SLUG}.qumo-app.com`;
const STAFF = { email: `owner@${SLUG}.example`, password: "qumo-dev-password" };

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: [
    "--host-resolver-rules=MAP *.qumo-app.com 127.0.0.1,MAP qumo-app.com 127.0.0.1",
    "--ignore-certificate-errors",
    "--no-proxy-server",
    "--no-sandbox",
  ],
});

const DESK = { viewport: { width: 1360, height: 850 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true };
const PHONE = { viewport: { width: 390, height: 780 }, deviceScaleFactor: 3, ignoreHTTPSErrors: true };

/** The Qumo mark, rendered from the SVG the app itself serves. */
async function renderMark() {
  const svg = fs.readFileSync(path.join(ROOT, "..", "public", "qumo.svg"), "utf8");
  for (const [name, colour] of [["qumo-white", "#FFFFFF"], ["qumo-ink", "#0A0A0B"], ["qumo-blue", "#2563EB"]]) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 460 }, deviceScaleFactor: 3 });
    await page.setContent(
      `<body style="margin:0;background:transparent;color:${colour};display:flex;align-items:center;` +
        `justify-content:center;height:460px"><div style="width:1360px">` +
        svg.replace("<svg ", '<svg style="width:100%;height:auto;display:block" ') +
        `</div></body>`,
    );
    await page.screenshot({ path: path.join(ART, `${name}.png`), omitBackground: true });
    await page.close();
    console.log("art", name);
  }
}

async function signedIn(opts) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  await p.goto(`${CONSOLE}/login`);
  await p.fill('input[name="email"]', STAFF.email);
  await p.fill('input[name="password"]', STAFF.password);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  return { ctx, p };
}

const shot = async (page, name) => {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  console.log("shot", name);
};

await renderMark();

// Signed-out console: the two screens that show a brand is invited, not self-signed.
{
  const ctx = await browser.newContext(DESK);
  const p = await ctx.newPage();
  await p.goto(`${CONSOLE}/login`);
  await shot(p, "console-login");
  await p.goto(`${CONSOLE}/provision`);
  if (SECRET) await p.fill('input[name="secret"], input[type="password"]', SECRET).catch(() => {});
  await shot(p, "console-provision");
  await ctx.close();
}

// The console, light.
{
  const { ctx, p } = await signedIn(DESK);
  for (const [route, name] of [
    ["/", "console-overview"],
    ["/performance?days=30", "console-performance"],
    ["/promotions", "console-promotions"],
    ["/codes", "console-codes"],
    ["/stores", "console-stores"],
  ]) {
    await p.goto(`${CONSOLE}${route}`);
    await shot(p, name);
  }
  if (BATCH) {
    await p.goto(`${CONSOLE}/codes/${BATCH}/sheet`);
    await shot(p, "console-labels");
  }
  // Scrolled to the panel each slide is actually about.
  await p.goto(`${CONSOLE}/settings`);
  await p.waitForLoadState("networkidle");
  await p.locator("text=How it looks").scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(400);
  await shot(p, "console-settings");
  await ctx.close();
}

// The console, dark. Both themes are first class and the deck says so.
{
  const { ctx, p } = await signedIn(DESK);
  await p.goto(`${CONSOLE}/`);
  await p.waitForLoadState("networkidle");
  await p.getByRole("button", { name: /^Dark$/ }).click().catch(() => {});
  await p.waitForTimeout(1200);
  await shot(p, "console-overview-dark");
  await p.goto(`${CONSOLE}/performance?days=30`);
  await shot(p, "console-performance-dark");
  await ctx.close();
}

// The shopper, on a phone.
{
  const ctx = await browser.newContext(PHONE);
  const p = await ctx.newPage();
  await p.goto(`${SHOP}/join`);
  await shot(p, "shopper-join");
  await p.goto(`${SHOP}/wallet/login`);
  await shot(p, "shopper-login");

  await p.fill('input[name="phone"], input[type="tel"]', "0821000037");
  await p.locator('input[type="checkbox"]').first().check();
  await p.getByRole("button", { name: /send me a code/i }).click();
  await p.waitForTimeout(1300);
  await shot(p, "shopper-otp");
  await p.fill('input[name="code"], input[inputmode="numeric"]', "424242");
  await p.getByRole("button", { name: /sign in|continue|verify/i }).first().click();
  await p.waitForURL((u) => !u.pathname.startsWith("/wallet/login"), { timeout: 20000 });

  // The award, if a code was supplied. Burns it, so the caller passes one
  // minted for this purpose rather than one out of a live run.
  if (CODE) {
    await p.goto(`${SHOP}/s/${CODE}`);
    await shot(p, "shopper-scan");
  }

  await p.goto(`${SHOP}/wallet`);
  await shot(p, "shopper-wallet");
  await p.getByRole("button", { name: /theme/i }).first().click().catch(() => {});
  await p.waitForTimeout(1200);
  await shot(p, "shopper-wallet-dark");
  await ctx.close();
}

console.log(`\n${fs.readdirSync(SHOTS).length} screens in ${SHOTS}`);
await browser.close();
