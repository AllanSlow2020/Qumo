import { chromium } from "playwright";
import { prisma } from "@/lib/db/client";
import { createStaffSession } from "@/lib/staff/session";
import { STAFF_SESSION_COOKIE } from "@/lib/staff/session-cookie";

/**
 * Guards the one bug a unit test in this repo cannot see.
 *
 * showModal() puts an element in the top layer. Moving its DOM node takes
 * it straight back out: the dialogue stays open but stops being modal,
 * loses its backdrop, and falls from position:fixed into normal flow,
 * landing beside whatever contains it instead of centred on screen.
 *
 * The promotions list sorts live promotions above paused ones above
 * drafts, so changing a status reorders it, and the cards are keyed, so
 * React moves the existing nodes. Any dialogue rendered inside a card goes
 * with it. Both dialogues therefore render on the body through a portal.
 *
 * There is no DOM test harness in this project, so this is a script rather
 * than a test. Run it against a dev server after touching either dialogue:
 *
 *   set -a && . ./.env && set +a
 *   PW_CHROME=<chrome> pnpm exec tsx scripts/check-dialog-portal.ts
 *
 * ── Why this stopped being a .mjs that just logs in ──────────────────────
 *
 * Because it stopped working, silently, the day OWNER started requiring a
 * second factor. It signed in with a password, asked for /promotions, and
 * the gate sent it to /security, where .cn-promo-grid never appears. The
 * failure read as a 20 second timeout on a selector, which looks like a
 * product bug and is not one.
 *
 * That is the worst way for a check to die: it does not say "I can no
 * longer run", it says "the thing you were checking is broken". So it now
 * does what the newer scripts do - mints a session directly and lends the
 * seeded owner a second factor for the duration, putting both back
 * afterwards. No login form, no TOTP, nothing for a future gate to catch.
 */
const BASE = process.env.QUMO_CONSOLE ?? "http://app.localhost:3000";
const EMAIL = process.env.QUMO_EMAIL ?? "owner@copper-kettle.example";

const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${what}`);
  if (!ok) failures.push(what);
};

async function main() {
  const owner = await prisma.user.findFirstOrThrow({
    where: { email: EMAIL },
    select: { id: true, totpSecretEncrypted: true, totpConfirmedAt: true },
  });

  // Remember what was there, so an account that genuinely holds a factor
  // is left holding it.
  const had = { secret: owner.totpSecretEncrypted, confirmed: owner.totpConfirmedAt };

  if (!owner.totpConfirmedAt) {
    await prisma.user.update({
      where: { id: owner.id },
      // A placeholder secret is enough: nothing here signs in with it.
      data: { totpSecretEncrypted: "ciphertext", totpConfirmedAt: new Date() },
    });
  }

  const token = await createStaffSession(owner.id);

  const browser = await chromium.launch(
    process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
  );
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addCookies([
    { name: STAFF_SESSION_COOKIE, value: token, domain: "app.localhost", path: "/", httpOnly: true },
  ]);
  const page = await ctx.newPage();

  await page.goto(`${BASE}/promotions`, { waitUntil: "networkidle" });

  // Say so plainly rather than timing out on a selector, so the next
  // person to break this reads the cause instead of guessing it.
  const landed = new URL(page.url()).pathname;
  if (landed !== "/promotions") {
    console.error(`\nExpected /promotions, landed on ${landed}. A gate is redirecting this session.`);
    await ctx.close();
    await browser.close();
    await prisma.$disconnect();
    process.exit(1);
  }

  await page.locator(".cn-promo-grid").first().waitFor({ timeout: 20000 });

  const measure = (selector: string) =>
    page.evaluate((sel: string) => {
      const d = document.querySelector(`${sel}[open]`);
      if (!d) return null;
      const b = d.getBoundingClientRect();
      return {
        modal: d.matches(":modal"),
        insideCard: !!d.closest(".cn-panel"),
        insideList: !!d.closest(".cn-promo-grid"),
        themed: !!d.closest(".cn"),
        // The check that was missing the first time round. A dialogue
        // portalled outside .cn loses every custom property, so
        // var(--cn-surface) resolves to nothing and the panel paints
        // transparent: the page shows through it and the text lands on the
        // list. Geometry alone does not notice.
        opaque: !/transparent|rgba\(0,\s*0,\s*0,\s*0\)/.test(getComputedStyle(d).backgroundColor),
        centred: Math.abs(b.x - (innerWidth - b.width) / 2) < 2,
      };
    }, selector);

  // Open the confirmation on the first card that offers one.
  const card = page.locator(".cn-promo-grid > .cn-panel").first();
  const name = (await card.locator(".cn-h2").first().textContent())?.trim();
  await card.getByRole("button", { name: "Delete" }).click();
  await page.waitForTimeout(400);

  let before = await measure("dialog.cn-dialog");
  check(before?.modal === true, "delete confirmation opens modal");
  check(before?.insideList === false, "delete confirmation is outside the reordering list");
  check(before?.themed === true, "delete confirmation inherits the console tokens");
  check(before?.opaque === true, "delete confirmation has a background");
  check(before?.insideCard === false, "delete confirmation is not inside a card");
  check(before?.centred === true, "delete confirmation is centred");

  // The move that used to break it: reordering the card that owns it.
  await page.evaluate((promotion: string) => {
    const owner = [...document.querySelectorAll(".cn-promo-grid > .cn-panel")].find((c) =>
      c.textContent?.includes(promotion),
    );
    owner?.parentElement?.appendChild(owner);
  }, name ?? "");
  await page.waitForTimeout(300);

  const after = await measure("dialog.cn-dialog");
  check(after?.modal === true, "stays modal after its card is reordered");
  check(after?.centred === true, "stays centred after its card is reordered");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // And the drawer, which is the same kind of element.
  await page.getByRole("button", { name: "New promotion" }).click();
  await page.waitForTimeout(600);
  const drawer = await measure("dialog.cn-drawer");
  check(
    (await page.locator(".cn-drawer").getByRole("button", { name: "Close" }).count()) === 1,
    "setup drawer can be closed without the keyboard",
  );
  check(drawer?.modal === true, "setup drawer opens modal");
  check(drawer?.themed === true, "setup drawer inherits the console tokens");
  check(drawer?.opaque === true, "setup drawer has a background");
  await ctx.close();
  await browser.close();

  // Put the seeded account back exactly as it was found.
  await prisma.staffSession.deleteMany({ where: { userId: owner.id } });
  await prisma.user.update({
    where: { id: owner.id },
    data: { totpSecretEncrypted: had.secret, totpConfirmedAt: had.confirmed },
  });
  await prisma.$disconnect();

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed`);
    process.exit(1);
  }
  console.log("\nall checks passed");
}

main();
