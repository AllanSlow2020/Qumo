import QRCode from "qrcode";

/**
 * The QR a brand puts on a poster, a table-talker or a shelf tag.
 *
 * The console has always told brands to "put this behind the QR code on
 * posters" and then handed them the address as text, which left the single
 * most consequential piece of artwork in the programme to a stranger and a
 * free online generator. Getting it wrong is not a small mistake: a poster
 * is printed in bulk, goes up in stores, and a QR pointing at the wrong
 * host is a reprint and a dead campaign.
 *
 * ── This one is not a secret, and that changes what guards it ────────────
 *
 * Everything in lib/packs is the opposite: a pack code is worth an award,
 * so a batch is guarded by role and a leaked file is money. A poster code
 * is deliberately worthless. It is one static address that anybody walking
 * past can scan, it awards nothing, and it is designed to be reproduced as
 * widely as possible. See app/(shopper)/join - that route never accrues,
 * and that is what makes printing this safe.
 *
 * So it needs a signed-in staff member and no role check. Guarding it would
 * be theatre that made the product harder to use without making anything
 * safer.
 *
 * ── Why SVG, and why a download ─────────────────────────────────────────
 *
 * A poster does not get printed from a browser. It goes to a designer, into
 * artwork, at a size nobody has decided yet - A3 in a store window, a
 * 40mm shelf tag, a table-talker. A raster image screenshotted off a screen
 * is useless at every one of those sizes, and a QR that has been scaled up
 * from a small PNG is a QR that fails in the one place it matters.
 *
 * Vector has no size, so this hands over an SVG and the question does not
 * arise.
 */

/**
 * Error correction Q, higher than the M used on pack labels.
 *
 * The two live different lives. A pack code is scanned once, usually
 * indoors, off a flat label somebody is holding. A poster is scanned from
 * across a room, at an angle, in a shop window with sun on it, and it is
 * frequently printed over a photograph or with a logo dropped in the middle
 * by a designer who was not asked. Q survives about a quarter of the symbol
 * being unreadable, which is what buys back all of that.
 *
 * It costs modules, and modules cost nothing here: a poster has room. That
 * trade is the reverse of the one lib/stores/payload.ts makes for a till
 * slip, where space is the scarce thing.
 */
const POSTER_ERROR_CORRECTION = "Q" as const;

/** Where a poster sends somebody: the brand's join page, which never awards. */
export function joinUrl(origin: string): string {
  return `${origin}/join`;
}

/**
 * The poster QR as an SVG string, ready to be dropped into artwork.
 *
 * No margin. The quiet zone a QR needs is real, but it belongs to whoever
 * is laying the poster out, and baking in four modules of white here would
 * fight every designer who puts this on a coloured background.
 */
export async function posterQrSvg(origin: string): Promise<string> {
  return QRCode.toString(joinUrl(origin), {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: POSTER_ERROR_CORRECTION,
  });
}
