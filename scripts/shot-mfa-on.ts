import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { prisma } from "@/lib/db/client";
import { beginEnrolment, confirmEnrolment } from "@/lib/staff/mfa";
import { totpCode } from "@/lib/staff/totp";
import { decryptSecret } from "@/lib/security/crypto";

async function main() {
  const OUT = process.env.SHOT_DIR!;
  mkdirSync(OUT, { recursive: true });

  const user = await prisma.user.findFirstOrThrow({
    where: { email: "owner@copper-kettle.example" },
    select: { id: true, brandId: true, email: true, name: true, role: true },
  });
  const actor = { user: { id: user.id, brandId: user.brandId, role: user.role, name: user.name, email: user.email } };

  // Idempotent: a previous run leaves the account enrolled, and
  // beginEnrolment refuses that. Clearing first makes this re-runnable.
  await prisma.staffRecoveryCode.deleteMany({ where: { userId: user.id } });
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecretEncrypted: null, totpConfirmedAt: null, totpLastStep: null },
  });

  // A real enrolment, through the same functions the screen calls, so the
  // screenshot is of a state the app can actually be in.
  await beginEnrolment(actor, "Qumo");
  const row = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { totpSecretEncrypted: true },
  });
  const secret = decryptSecret(row.totpSecretEncrypted!);
  await confirmEnrolment(actor, totpCode(secret, new Date()));
  console.log("enrolled for real");

  const browser = await chromium.launch(
    process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
  );
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  await page.goto("http://app.localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "owner@copper-kettle.example");
  await page.fill('input[name="password"]', "qumo-dev-password");
  await page.locator('form.cn-form button[type="submit"]').click();

  // Now a second factor is asked for, which is the proof the enrolment took.
  const codeField = page.locator('input[name="code"]');
  await codeField.waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${OUT}/mfa-03-signin.png`, fullPage: true });
  console.log("shot the sign-in prompt");

  /*
   * Wait for the next 30-second step before signing in.
   *
   * confirmEnrolment records the step it consumed, so the code that
   * enrolled cannot also sign in. That is the replay guard doing its job,
   * and it refused this script the first time it was run.
   */
  await new Promise((r) => setTimeout(r, 31_000));
  await codeField.fill(totpCode(secret, new Date()));
  await page.locator('form.cn-form button[type="submit"]').click();
  await page.waitForFunction(() => !location.pathname.startsWith("/login"), { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  console.log("after the code, landed on:", new URL(page.url()).pathname);

  await page.goto("http://app.localhost:3000/security", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/mfa-04-on.png`, fullPage: true });
  const hasTurnOff = await page.getByRole("button", { name: /Turn off two-factor/i }).count();
  console.log("turn-off button offered to an owner:", hasTurnOff > 0);

  await ctx.close();
  await browser.close();

  /*
   * Put the seeded account back. Leaving it enrolled would lock local
   * development out of the console entirely: sign-in would ask for a code
   * from a secret that only this script ever held.
   */
  await prisma.staffRecoveryCode.deleteMany({ where: { userId: user.id } });
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecretEncrypted: null, totpConfirmedAt: null, totpLastStep: null },
  });
  console.log("seeded owner put back to unenrolled");

  await prisma.$disconnect();
}

main();
