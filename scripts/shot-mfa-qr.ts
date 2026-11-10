import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { prisma } from "@/lib/db/client";
import { createStaffSession } from "@/lib/staff/session";
import { STAFF_SESSION_COOKIE } from "@/lib/staff/session-cookie";

/**
 * The enrolment screen, with the QR on it.
 *
 * The session is minted directly: the gate holds an unenrolled owner at
 * /security, which is exactly the screen being photographed, so there is
 * nothing to log in past.
 */
async function main() {
  const OUT = process.env.SHOT_DIR!;
  mkdirSync(OUT, { recursive: true });

  const owner = await prisma.user.findFirstOrThrow({
    where: { email: "owner@copper-kettle.example" },
    select: { id: true },
  });

  // Start from no factor, so the screen offers enrolment rather than the
  // recovery-codes view.
  await prisma.staffRecoveryCode.deleteMany({ where: { userId: owner.id } });
  await prisma.user.update({
    where: { id: owner.id },
    data: { totpSecretEncrypted: null, totpConfirmedAt: null, totpLastStep: null },
  });

  const token = await createStaffSession(owner.id);

  const browser = await chromium.launch(
    process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
  );
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
  await ctx.addCookies([
    { name: STAFF_SESSION_COOKIE, value: token, domain: "app.localhost", path: "/", httpOnly: true },
  ]);
  const page = await ctx.newPage();

  await page.goto("http://app.localhost:3000/security", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Turn on two-factor/i }).click();

  const qr = page.locator(".cn-totp-qr svg");
  await qr.waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);

  await page.screenshot({ path: `${OUT}/qr-01-light.png`, fullPage: true });
  console.log("shot light");

  // Dark too, because the QR sits on its own white plate precisely so the
  // theme cannot invert it into something a scanner refuses.
  await page.goto("http://app.localhost:3000/security", { waitUntil: "networkidle" });
  await page.locator("form").filter({ has: page.getByRole("button", { name: "Dark" }) }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Turn on two-factor/i }).click();
  await page.locator(".cn-totp-qr svg").waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/qr-02-dark.png`, fullPage: true });
  console.log("shot dark");

  const box = await page.locator(".cn-totp-qr").boundingBox();
  console.log("qr rendered at:", box && `${Math.round(box.width)}x${Math.round(box.height)}`);

  await ctx.close();
  await browser.close();

  await prisma.staffRecoveryCode.deleteMany({ where: { userId: owner.id } });
  await prisma.staffSession.deleteMany({ where: { userId: owner.id } });
  await prisma.user.update({
    where: { id: owner.id },
    data: { totpSecretEncrypted: null, totpConfirmedAt: null, totpLastStep: null },
  });
  console.log("seed put back");
  await prisma.$disconnect();
}

main();
