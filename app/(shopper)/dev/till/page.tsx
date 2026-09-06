import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db/client";
import { requireBrand } from "@/lib/brand/current";
import { decryptSecret } from "@/lib/security/crypto";
import { buildReceiptUrl } from "@/lib/stores/payload";
import { formatPackCode } from "@/lib/packs/code";
import { devOnly } from "@/lib/dev/guard";

/**
 * A till, for testing.
 *
 * The one thing standing between "I can look at Qumo" and "I can use Qumo"
 * is a slip. A real one comes off a point of sale that knows the store's
 * signing secret; there is no point of sale here, so this is one — pick a
 * store, name a basket, and it prints a slip you can scan with a phone or
 * click on a laptop.
 *
 * Everything it produces goes through exactly the same code a real till
 * would use (buildReceiptUrl, signed with the store's own secret), so a
 * slip from here is indistinguishable from a slip from a real till. That is
 * the point: testing against a special case proves nothing about the real
 * one.
 *
 * Dev only, and hard about it — see lib/dev/guard.ts.
 */

const BASKETS = [4_500, 8_900, 17_000, 24_000, 46_000];

async function qr(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
}

export default async function DevTillPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; cents?: string; txn?: string }>;
}) {
  if (!devOnly()) notFound();

  const brand = await requireBrand();
  const { store: storeCode, cents: rawCents, txn } = await searchParams;

  const stores = await prisma.store.findMany({
    where: { brandId: brand.id, isActive: true },
    select: { id: true, name: true, code: true, signingSecretEncrypted: true },
    orderBy: { name: "asc" },
  });

  const chosen = stores.find((s) => s.code === storeCode) ?? stores[0];
  const cents = Number(rawCents) > 0 ? Math.min(Number(rawCents), 500_000) : 17_000;

  // Taken from the URL, never minted here: see the note in actions.ts. A
  // slip is stable while you are looking at it, and a new one is a button.
  const externalTxnId = txn ?? null;

  const origin = `http://${brand.slug}.${process.env.NEXT_PUBLIC_QUMO_ROOT_DOMAIN ?? "localhost"}:3000`;

  const slipUrl = chosen && externalTxnId
    ? buildReceiptUrl(
        origin,
        { storeCode: chosen.code, externalTxnId, amountCents: cents, purchasedAt: new Date() },
        chosen.signingSecretEncrypted ? decryptSecret(chosen.signingSecretEncrypted) : null,
      )
    : null;

  const codes = await prisma.packCode.findMany({
    where: { brandId: brand.id, status: "UNSCANNED" },
    select: { code: true },
    take: 3,
  });

  // Rendered before the JSX: an await inside a map callback is not a thing,
  // and generating them here keeps the markup readable.
  const codeCards = await Promise.all(
    codes.map(async (c) => ({ code: c.code, svg: await qr(`${origin}/s/${c.code}`) })),
  );

  const slipSvg = slipUrl ? await qr(slipUrl) : null;

  return (
    <div className="sc-shell">
      <div className="sc-head">
        <div>
          <div className="sc-mark">Till simulator</div>
          <div className="sc-mark-sub">{brand.name} · development only</div>
        </div>
      </div>

      <p className="sc-body">
        This stands in for a point of sale. It signs a slip with the store&rsquo;s own secret, through the same code a
        real till would use, so what comes out is a real slip &mdash; scan it with a phone or open it on this machine.
      </p>

      <section className="sc-card">
        <h2 className="sc-h2">Which store</h2>
        <div className="sc-devgrid">
          {stores.map((s) => (
            <a
              key={s.id}
              className={`sc-btn ${s.code === chosen?.code ? "" : "sc-btn-ghost"}`}
              href={`/dev/till?store=${encodeURIComponent(s.code)}&cents=${cents}`}
            >
              {s.name}
              {!s.signingSecretEncrypted && " (unsigned)"}
            </a>
          ))}
        </div>
      </section>

      <section className="sc-card">
        <h2 className="sc-h2">Basket</h2>
        <div className="sc-devgrid">
          {BASKETS.map((c) => (
            <a
              key={c}
              className={`sc-btn ${c === cents ? "" : "sc-btn-ghost"}`}
              href={`/dev/till?store=${encodeURIComponent(chosen?.code ?? "")}&cents=${c}`}
            >
              R{(c / 100).toFixed(2)}
            </a>
          ))}
        </div>
      </section>

      <section className="sc-card">
        <h2 className="sc-h2">{slipUrl ? "Your slip" : "Print a slip"}</h2>
        <a
          className={slipUrl ? "sc-btn sc-btn-ghost" : "sc-btn"}
          href={`/dev/till/print?store=${encodeURIComponent(chosen?.code ?? "")}&cents=${cents}`}
        >
          {slipUrl ? "Print another" : "Print a slip"}
        </a>
        <p className="sc-label">
          Each slip is worth one award, ever. Printing another does not cancel the one above &mdash; it just gives you
          a second one.
        </p>
      </section>

      {slipUrl && chosen && (
        <section className="sc-card">
          <h2 className="sc-h2">Scan it</h2>
          <p className="sc-label">
            {chosen.name} · R{(cents / 100).toFixed(2)} ·{" "}
            {chosen.signingSecretEncrypted ? "signed" : "UNSIGNED — this store cannot prove the sale"}
          </p>
          {/* Our own SVG, built from a URL this component made: nothing in
              it comes from a request. */}
          <div className="sc-qr" dangerouslySetInnerHTML={{ __html: slipSvg ?? "" }} />
          <a className="sc-btn" href={slipUrl}>
            Open it on this machine
          </a>
          <p className="sc-devurl">{slipUrl}</p>
        </section>
      )}

      {codes.length > 0 && (
        <section className="sc-card">
          <h2 className="sc-h2">Pack codes</h2>
          <p className="sc-body">Unscanned codes from a printed batch. One award each, ever.</p>
          {codeCards.map((c) => (
            <div key={c.code} className="sc-devcode">
              <div className="sc-qr sc-qr-sm" dangerouslySetInnerHTML={{ __html: c.svg }} />
              <div>
                <p className="sc-code-sm">{formatPackCode(c.code)}</p>
                <a className="sc-btn sc-btn-ghost" href={`/s/${c.code}`}>
                  Scan it
                </a>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
