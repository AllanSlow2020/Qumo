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
 *   node deck/capture.mjs --art-only     # just the marks in deck/art, no app needed
 *
 * Pass an unscanned pack code and the award screen is captured too, which
 * is the one screen that shows the moment the mechanic pays. The provision
 * secret may come from PROVISION_SECRET instead, so it need not be typed
 * on a command line.
 *
 * ── Two-factor sign-in ───────────────────────────────────────────────────
 *
 * An owner may not use the console on a password alone (lib/staff/mfa-policy.ts),
 * and the demo owner is an owner. So the first run enrols the demo account
 * through the real security screen, exactly as a person would, and keeps the
 * authenticator secret in deck/.capture-totp (git-ignored) so later runs can
 * sign in. Delete that file and re-seed if the two ever disagree. This is the
 * demo account on a local database: nothing here weakens the rule, it
 * satisfies it.
 */
import { chromium } from "playwright";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SHOTS = path.join(ROOT, "shots");
const ART = path.join(ROOT, "art");
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(ART, { recursive: true });

const [SLUG = "copper-kettle", BATCH, SECRET_ARG, CODE] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SECRET = SECRET_ARG && SECRET_ARG !== "-" ? SECRET_ARG : process.env.PROVISION_SECRET;
const TOTP_FILE = path.join(ROOT, ".capture-totp");
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

/**
 * The Q's own paths: the two whose outlines begin left of x=300 in the SVG's
 * 696-wide viewBox. Everything else is "umo". brand-context.md, section 7:
 * the mark is a blue Q.
 */
const isQ = (d) => parseFloat(d.slice(1)) < 300;

/** The two-colour mark for a dark ground: a blue Q, and "umo" in white. */
function twoColour(svg, q, rest) {
  return svg.replace(/<path d="([^"]+)"/g, (_, d) => `<path fill="${isQ(d) ? q : rest}" d="${d}"`);
}

/** The Qumo mark, rendered from the SVG the app itself serves. */
async function renderMark() {
  const plain = fs.readFileSync(path.join(ROOT, "..", "public", "qumo.svg"), "utf8");
  for (const [name, colour, svg] of [
    ["qumo-white", "#FFFFFF", plain],
    ["qumo-ink", "#0A0A0B", plain],
    ["qumo-blue", "#2563EB", plain],
    ["qumo-blue-white", "#FFFFFF", twoColour(plain, "#2563EB", "#FFFFFF")],
  ]) {
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

/** RFC 6238, the same arithmetic as lib/staff/totp.ts: SHA-1, six digits, 30 seconds. */
function totp(secretBase32, at = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secretBase32.replace(/[\s=]/g, "").toUpperCase()) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const mac = createHmac("sha1", key).update(counter).digest();
  const o = mac[mac.length - 1] & 0xf;
  const n = ((mac[o] & 0x7f) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/** A code from a window not yet used, since a code works once (lib/staff/mfa.ts). */
let lastStep = -1;
async function freshCode(secret) {
  while (Math.floor(Date.now() / 30000) <= lastStep) await new Promise((r) => setTimeout(r, 1000));
  lastStep = Math.floor(Date.now() / 30000);
  return totp(secret);
}

/** Signs the demo owner in once, enrolling the second factor on the first run. */
async function signIn() {
  const ctx = await browser.newContext(DESK);
  const p = await ctx.newPage();
  await p.goto(`${CONSOLE}/login`);
  await p.fill('input[name="email"]', STAFF.email);
  await p.fill('input[name="password"]', STAFF.password);
  await p.locator('form:has(input[name="password"]) button[type="submit"]').click();
  const code = p.locator('input[name="code"]');
  await Promise.race([
    code.waitFor({ timeout: 20000 }),
    p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }),
  ]);
  if (await code.isVisible().catch(() => false)) {
    if (!fs.existsSync(TOTP_FILE)) {
      throw new Error(`The demo owner already has a second factor and ${TOTP_FILE} is gone. Re-seed, or restore it.`);
    }
    await code.fill(await freshCode(fs.readFileSync(TOTP_FILE, "utf8").trim()));
    await p.locator('form:has(input[name="code"]) button[type="submit"]').click();
    await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  }
  // The gate redirects on the next page load, not on the login response itself.
  await p.goto(`${CONSOLE}/`);
  await p.waitForLoadState("networkidle");
  if (new URL(p.url()).pathname.startsWith("/security")) {
    await p.getByRole("button", { name: /turn on two-factor/i }).click();
    const secretText = (await p.locator(".cn-secret-value").first().textContent()).trim();
    fs.writeFileSync(TOTP_FILE, secretText.replace(/\s/g, "") + "\n", { mode: 0o600 });
    await p.fill('input[name="code"]', await freshCode(secretText));
    await p.getByRole("button", { name: /confirm and finish/i }).click();
    await p.waitForTimeout(1500);
    console.log("enrolled the demo owner's second factor; secret kept in", TOTP_FILE);
    await p.goto(`${CONSOLE}/`);
    await p.waitForLoadState("networkidle");
  }
  if (new URL(p.url()).pathname.startsWith("/security")) {
    throw new Error("Still at the two-factor screen after enrolling. Nothing captured from the console.");
  }
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

/** A console context from a saved sign-in, in the theme asked for. */
async function console_(state, theme) {
  const ctx = await browser.newContext({ ...DESK, storageState: state });
  await ctx.addCookies([{ name: "cios_theme", value: theme, domain: "app.qumo-app.com", path: "/" }]);
  return { ctx, p: await ctx.newPage() };
}

const shot = async (page, name) => {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  console.log("shot", name);
};

await renderMark();
if (process.argv.includes("--art-only")) {
  await browser.close();
  process.exit(0);
}

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

const STATE = await signIn();

// The console, light.
{
  const { ctx, p } = await console_(STATE, "light");
  for (const [route, name] of [
    ["/", "console-overview"],
    ["/performance?days=30", "console-performance"],
    ["/promotions", "console-promotions"],
    ["/codes", "console-codes"],
    ["/stores", "console-stores"],
    ["/redeem", "console-redeem"],
    ["/billing", "console-plan"],
    ["/guide", "console-guide"],
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
  // The guide's two interactive pieces, each scrolled into view.
  for (const [anchor, name] of [["cards", "console-guide-stamps"], ["cost", "console-guide-cost"]]) {
    await p.goto(`${CONSOLE}/guide#${anchor}`);
    await p.waitForLoadState("networkidle");
    await p.locator(`#${anchor}`).scrollIntoViewIfNeeded().catch(() => {});
    await p.waitForTimeout(600);
    await shot(p, name);
  }
  await ctx.close();
}

// The console, dark. Both themes are first class and the deck says so.
{
  const { ctx, p } = await console_(STATE, "dark");
  await p.goto(`${CONSOLE}/`);
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
  await ctx.addCookies([{ name: "cios_theme", value: "dark", domain: `${SLUG}.qumo-app.com`, path: "/" }]);
  await p.goto(`${SHOP}/wallet`);
  await shot(p, "shopper-wallet-dark");
  await ctx.close();
}

console.log(`\n${fs.readdirSync(SHOTS).length} screens in ${SHOTS}`);
await browser.close();
