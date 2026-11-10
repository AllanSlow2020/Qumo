import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { prisma } from "@/lib/db/client";
import { hashPassword } from "@/lib/staff/password";
import { createStaffSession } from "@/lib/staff/session";
import { STAFF_SESSION_COOKIE } from "@/lib/staff/session-cookie";

/**
 * The team screen, showing the control that clears a colleague's second
 * factor.
 *
 * The session is minted directly rather than driven through the login
 * form. Signing in as an enrolled owner means producing a TOTP code, and
 * the enrolment code cannot be reused for the sign-in - the replay guard
 * refuses it - so the browser has to sit through a 30-second step boundary
 * for a screenshot that is not about logging in. Both halves of that flow
 * are covered by tests and by scripts/shot-mfa-on.ts.
 */
async function main() {
  const OUT = process.env.SHOT_DIR!;
  mkdirSync(OUT, { recursive: true });

  const owner = await prisma.user.findFirstOrThrow({
    where: { email: "owner@copper-kettle.example" },
    select: { id: true, brandId: true },
  });

  // The owner must hold a factor or the gate sends them to /security and
  // the team page never renders. A placeholder secret is enough here
  // because nothing signs in with it.
  await prisma.user.update({
    where: { id: owner.id },
    data: { totpSecretEncrypted: "ciphertext", totpConfirmedAt: new Date(), totpLastStep: 1 },
  });

  // The seed has one staff member, and this control only ever appears on
  // somebody else's row, so there has to be a somebody else.
  const colleague = await prisma.user.create({
    data: {
      brandId: owner.brandId,
      email: `shot-colleague-${Date.now()}@example.invalid`,
      name: "Sipho Dlamini",
      role: "ADMIN",
      passwordHash: await hashPassword("a-long-enough-staff-password"),
      totpSecretEncrypted: "ciphertext",
      totpConfirmedAt: new Date(),
      totpLastStep: 1,
    },
    select: { id: true, email: true },
  });

  const token = await createStaffSession(owner.id);

  const browser = await chromium.launch(
    process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
  );
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, deviceScaleFactor: 2 });
  await ctx.addCookies([
    { name: STAFF_SESSION_COOKIE, value: token, domain: "app.localhost", path: "/", httpOnly: true },
  ]);
  const page = await ctx.newPage();

  await page.goto("http://app.localhost:3000/people", { waitUntil: "networkidle" });
  console.log("landed on:", new URL(page.url()).pathname);

  await page.screenshot({ path: `${OUT}/reset-01-team.png`, fullPage: true });

  const offered = await page.getByRole("button", { name: /Reset two-factor/i }).count();
  console.log("reset controls on the page:", offered, "(expected 1: the colleague's row, not the owner's own)");

  await ctx.close();
  await browser.close();

  await prisma.staffSession.deleteMany({ where: { userId: colleague.id } });
  await prisma.staffRecoveryCode.deleteMany({ where: { userId: colleague.id } });
  await prisma.user.delete({ where: { id: colleague.id } });
  await prisma.staffSession.deleteMany({ where: { userId: owner.id } });
  await prisma.user.update({
    where: { id: owner.id },
    data: { totpSecretEncrypted: null, totpConfirmedAt: null, totpLastStep: null },
  });
  console.log("put the seed back as it was");

  await prisma.$disconnect();
}

main();
