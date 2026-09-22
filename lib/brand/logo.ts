/**
 * An uploaded brand logo: what we accept, how we know, and how it is served.
 *
 * ── Why the file's own bytes decide its type ─────────────────────────────
 *
 * A browser sends a Content-Type with an upload and it is a claim, not a
 * fact - it comes from the file extension on the uploading machine. Trusting
 * it means a brand can upload anything and have us serve it back under a
 * type of their choosing, from their own subdomain, where their shoppers'
 * session cookies live. So the type is read from the first few bytes of the
 * file, and a file whose bytes do not match anything on the list is refused
 * whatever it claims to be.
 *
 * ── Why SVG is refused ───────────────────────────────────────────────────
 *
 * SVG is a document, not a picture: it can carry <script>, event handlers
 * and external references. Serving one from copper-kettle.qumo.co.za means
 * running whatever it contains on the origin that holds that brand's
 * shopper sessions - a stored cross-site scripting hole with a file picker
 * in front of it. It could be sandboxed with headers, or served from a
 * separate origin, and neither is worth doing before anybody has asked: a
 * PNG at twice the size it will be displayed at is indistinguishable on a
 * phone, and that is where this is looked at.
 *
 * The console says this in words when somebody tries, because "unsupported
 * file type" on a logo somebody has in SVG and nothing else is a dead end.
 */

/** What the console accepts, keyed by the magic bytes that prove it. */
const SIGNATURES: { mime: string; label: string; match: (b: Uint8Array) => boolean }[] = [
  {
    mime: "image/png",
    label: "PNG",
    match: (b) =>
      b.length > 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    mime: "image/jpeg",
    label: "JPEG",
    // Every JPEG starts SOI, and the third byte begins the first marker.
    match: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/webp",
    label: "WebP",
    // "RIFF" .... "WEBP" - the size sits between the two, so both are checked.
    match: (b) =>
      b.length > 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

/** Looks like an SVG, so it can be refused with a reason rather than a shrug. */
function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.slice(0, 256))
    .trimStart()
    .toLowerCase();
  return head.startsWith("<svg") || head.startsWith("<?xml");
}

/**
 * Half a megabyte.
 *
 * Generous for a logo that renders at 40px tall and mean enough that a
 * brand uploading a print asset by mistake is told so rather than filling a
 * database row with it. The check happens after the bytes are read, which is
 * fine at this size and is the only way to be sure - a Content-Length is
 * another claim.
 */
export const MAX_LOGO_BYTES = 512 * 1024;

export const ACCEPTED_LOGO_TYPES = SIGNATURES.map((s) => s.label).join(", ");

export type LogoCheck =
  /** A copy, backed by its own ArrayBuffer, which is what Prisma's Bytes takes. */
  | { ok: true; bytes: Uint8Array<ArrayBuffer>; mime: string }
  | { ok: false; error: string };

/** Everything that has to be true before bytes go anywhere near the database. */
export function checkLogo(bytes: Uint8Array): LogoCheck {
  if (bytes.length === 0) {
    return { ok: false, error: "That file is empty." };
  }
  if (bytes.length > MAX_LOGO_BYTES) {
    const mb = (bytes.length / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      error: `That file is ${mb}MB. Logos have to be under 512KB - it is shown about 40px tall, so a small one loses nothing.`,
    };
  }

  const found = SIGNATURES.find((s) => s.match(bytes));
  if (found) {
    return { ok: true, bytes: new Uint8Array(bytes), mime: found.mime };
  }

  if (looksLikeSvg(bytes)) {
    return {
      ok: false,
      error:
        "We can't take SVG. An SVG can contain code, and this one would be served from your own address where your customers are signed in. Export it as a PNG at about twice the size it is shown and it will look identical.",
    };
  }

  return {
    ok: false,
    error: `That does not look like an image we can use. ${ACCEPTED_LOGO_TYPES} only.`,
  };
}
