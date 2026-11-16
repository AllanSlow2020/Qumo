import { chromium } from "playwright";
import { prisma } from "@/lib/db/client";
import { createStaffSession } from "@/lib/staff/session";
import { STAFF_SESSION_COOKIE } from "@/lib/staff/session-cookie";
import { decryptSecret } from "@/lib/security/crypto";
import { totpCode } from "@/lib/staff/totp";

/**
 * Does the console's navigation come back the moment somebody enrols,
 * without a full page load?
 *
 * It did not, and the way it failed is the reason this is a committed
 * check rather than a note. The second-factor gate hides the nav while a
 * factor is outstanding, which is right - every link would bounce back to
 * the enrolment screen. Enrolling then changes what the layout would
 * decide, but the layout is a server component that nothing re-asks, so
 * the first person to enrol on production landed on an Overview with no
 * way to leave it. Everything worked; it just looked broken, which is
 * worse on the one screen whose job is to be reassuring.
 *
 * `router.refresh()` in the security form is the fix. The second
 * assertion is the one that matters as much: that refresh must not take
 * the recovery codes with it, since they are client state and are shown
 * exactly once.
 *
 * Follows scripts/check-dialog-portal.mjs: a thing the test suite cannot
 * see, driven in a browser, exiting non-zero when it is wrong.
 */
const failures: string[] = [];
function check(ok: boolean, what: string) {
  console.log(`${ok ? "  ok  " : "  x   "}${what}`);
  if (!ok) failures.push(what);
}

async function main() {
  const owner = await prisma.user.findFirstOrThrow({
    where: { email: "owner@copper-kettle.example" },
    select: { id: true },
  });

  await prisma.staffRecoveryCode.deleteMany({ where: { userId: owner.id } });
  await prisma.user.update({
    where: { id: owner.id },
    data: { totpSecretEncrypted: null, totpConfirmedAt: null, totpLastStep: null },
  });

  const token = await createStaffSession(owner.id);
  const browser = await chromium.launch(
    process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
  );
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([
    { name: STAFF_SESSION_COOKIE, value: token, domain: "app.localhost", path: "/", httpOnly: true },
  ]);
  const page = await ctx.newPage();

  const navCount = () => page.locator(".cn-side a[href], nav a[href]").count();

  await page.goto("http://app.localhost:3000/security", { waitUntil: "networkidle" });
  const heldLinks = await navCount();
  check(heldLinks < 5, `nav is hidden while the factor is outstanding (${heldLinks} links)`);

  await page.getByRole("button", { name: /Turn on two-factor/i }).click();
  await page.locator(".cn-totp-qr svg").waitFor({ timeout: 15000 });

  const row = await prisma.user.findUniqueOrThrow({
    where: { id: owner.id },
    select: { totpSecretEncrypted: true },
  });
  const secret = decryptSecret(row.totpSecretEncrypted!);

  await page.locator('input[name="code"]').fill(totpCode(secret, new Date()));
  await page.getByRole("button", { name: /Confirm and finish/i }).click();

  // The recovery codes appear once the enrolment is confirmed.
  await page.getByText(/Save these somewhere safe now/i).waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);

  const enrolled = await prisma.user.findUniqueOrThrow({
    where: { id: owner.id },
    select: { totpConfirmedAt: true },
  });
  check(enrolled.totpConfirmedAt !== null, "the enrolment was recorded");

  const afterLinks = await navCount();
  check(afterLinks > heldLinks, `nav returns without a reload (${heldLinks} -> ${afterLinks} links)`);

  // The refresh that fixes the nav must not take the recovery codes with
  // it. They are client state, shown exactly once, and losing them would
  // be a far worse bug than the one being fixed.
  check(
    await page.getByText(/Save these somewhere safe now/i).isVisible(),
    "the recovery codes survive the refresh",
  );
  check((await page.locator(".cn-secret .cn-mono").count()) === 10, "all ten codes are still on screen");

  await page.reload({ waitUntil: "networkidle" });
  check((await navCount()) === afterLinks, "a reload agrees with what was already on screen");

  await ctx.close();
  await browser.close();

  await prisma.staffRecoveryCode.deleteMany({ where: { userId: owner.id } });
  await prisma.staffSession.deleteMany({ where: { userId: owner.id } });
  await prisma.user.update({
    where: { id: owner.id },
    data: { totpSecretEncrypted: null, totpConfirmedAt: null, totpLastStep: null },
  });
  await prisma.$disconnect();

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed`);
    process.exit(1);
  }
  console.log("\nall checks passed");
}

main();
