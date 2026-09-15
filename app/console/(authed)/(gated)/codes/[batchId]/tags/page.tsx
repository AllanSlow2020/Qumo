import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Role } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/client";
import { brandOrigin } from "@/lib/brand/host";
import { unscannedCodes } from "@/lib/packs/export";
import { formatPackCode } from "@/lib/packs/code";
import { smallestTagFor, TAG_CAPACITY, tagBytes } from "@/lib/packs/nfc";
import { MANAGE_PACK_BATCH_ROLES } from "@/lib/packs/batch";
import { requireStaff } from "@/lib/staff/current";
import { CopyRow } from "./copy-row";

export const metadata: Metadata = { title: "NFC tags" };

/**
 * Writing this run's codes to NFC tags.
 *
 * ── Why this is a screen and not a feature ───────────────────────────────
 *
 * There is no NFC code in this product and there should not be. A tag holds
 * a URL; a pack code already is one; the phone that taps a tag opens the
 * same page as the phone that scans the QR. Everything that makes a scan
 * worth something - single use, the burn inside a serializable transaction,
 * the brand check on the host - already happens at /s/<code> and does not
 * care how the address arrived.
 *
 * What was genuinely missing is the thing this page does: getting one URL
 * onto one tag without downloading a spreadsheet of fifty thousand rows and
 * finding a line in it on a phone.
 *
 * ── Guarded like the CSV and the label sheet ─────────────────────────────
 *
 * Unscanned codes are unredeemed value. This hands out a few of them in the
 * most copyable form yet, so it takes the same role as the routes that hand
 * out all of them.
 */

/**
 * Enough to write a sample, not enough to be a second export route.
 *
 * Somebody testing has a handful of tags. Somebody with a real print run has
 * the CSV. A number large enough to matter here would make this a way around
 * the guard rather than a convenience inside it.
 */
const TAGS_SHOWN = 12;

export default async function TagsPage({ params }: { params: Promise<{ batchId: string }> }) {
  const staff = await requireStaff();
  if (!MANAGE_PACK_BATCH_ROLES.includes(staff.role as Role)) {
    // notFound rather than a refusal, same as the sheet: a reader who cannot
    // have the codes has no business learning this batch id exists.
    notFound();
  }

  const { batchId } = await params;

  const brand = await prisma.brand.findUnique({
    where: { id: staff.brandId },
    select: { slug: true },
  });
  if (!brand) notFound();

  const requestHeaders = await headers();
  const origin = brandOrigin(brand.slug, requestHeaders.get("x-forwarded-proto"));

  const run = await unscannedCodes(staff.brandId, batchId, TAGS_SHOWN);
  if (!run) notFound();

  const joinUrl = `${origin}/join`;
  // Measured on a real URL from this run rather than on an example, because
  // the number that matters is this brand's, and a slug is what makes it
  // vary.
  const sample = run.codes[0] ? `${origin}/s/${run.codes[0]}` : joinUrl;
  const bytes = tagBytes(sample);
  const smallest = smallestTagFor(sample);
  const cheapest = TAG_CAPACITY[0];

  return (
    <>
      <h1 className="cn-h1">NFC tags</h1>
      <p className="cn-body">
        {run.label}. A tag holds a web address, and a pack code already is one, so a tap opens exactly the page a
        scan opens. There is nothing to install on the phone and nothing extra to set up here.
      </p>

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">One tag that never runs out</h2>
        </div>
        <div className="cn-panel-body">
          <p className="cn-body">
            Write this to a tag on a table talker, a counter or a poster. It explains the programme and signs
            people up, and any number of people can tap it, because it awards nothing. That is the point of it:
            a tag that gave value to everyone who walked past would give value to everyone who walked past.
          </p>
          <CopyRow url={joinUrl} caption="Join, and nothing else" />
        </div>
      </section>

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">Tags that are worth something</h2>
        </div>
        <div className="cn-panel-body">
          <p className="cn-body">
            One code per tag, each one good once. These are the first {run.codes.length} of{" "}
            {run.unscanned.toLocaleString("en-ZA")} in this run that nobody has used yet. Writing the same code to
            two tags does not make two awards, it makes one tag that works and one that says it has already been
            used.
          </p>
          {run.codes.length === 0 ? (
            <p className="cn-empty">Every code in this run has been scanned.</p>
          ) : (
            <div className="cn-tag-list">
              {run.codes.map((code) => (
                <CopyRow key={code} url={`${origin}/s/${code}`} caption={formatPackCode(code)} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="cn-panel">
        <div className="cn-panel-head">
          <h2 className="cn-h2">What to buy, and what to do with it</h2>
        </div>
        <div className="cn-panel-body">
          <p className="cn-body">
            Your addresses are {bytes} bytes on a tag, so they fit on{" "}
            {smallest ? <strong>{smallest.name}</strong> : "nothing on the usual list"}
            {smallest && smallest.name === cheapest.name
              ? `, which is the cheapest tag sold and holds ${cheapest.bytes}.`
              : "."}{" "}
            Buy on price. Anything sold as an NTAG is fine.
          </p>
          <p className="cn-body">
            Write them with any tag writer on a phone. Choose the <strong>URL</strong> or{" "}
            <strong>link</strong> record type and paste the address. Do not choose &ldquo;text&rdquo;, which
            writes the address as words and gives the phone nothing to open.
          </p>
          <p className="cn-body">
            Before a tag goes out on a pack, lock it. An unlocked tag can be rewritten by anyone holding a phone
            against it, and a tag rewritten to point somewhere else is a tag that sends your customers there. Tag
            writers call it locking, write protecting or making read only. It cannot be undone, which is the
            whole idea.
          </p>
          <p className="cn-label">
            On Android, tapping works whenever the screen is on and unlocked. On an iPhone XS or newer it works
            the same way with the screen on; older iPhones need the reader opened from the control centre first.
            Neither needs an app installed.
          </p>
        </div>
      </section>

      <div className="cn-actions">
        <Link className="cn-btn cn-btn-quiet" href="/codes">
          Back to pack codes
        </Link>
      </div>
    </>
  );
}
