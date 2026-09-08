import { currentBrand } from "@/lib/brand/current";
import { PRODUCT_NAME } from "@/lib/product";
import { toggleTheme } from "../theme-actions";

/**
 * The top of every shopper screen, and the whole point of Phase D.
 *
 * It used to say "Qumo". It now says Chicken Licken, because that is who
 * the shopper thinks they are dealing with - they scanned a code at a
 * Chicken Licken till, on a Chicken Licken poster, for a Chicken Licken
 * promotion, and a page that leads with an infrastructure vendor's name is
 * asking them to trust a company they have never heard of with their phone
 * number. Qumo moves to the footer.
 *
 * It fetches the brand itself rather than taking it as a prop. currentBrand()
 * is request-cached, so six components asking cost one query, and the
 * alternative - threading a brand through every page - is six chances to
 * forget.
 */
export async function BrandHeader({ caption }: { caption?: string }) {
  const brand = await currentBrand();
  // Null on exactly two screens, both of them ours rather than a brand's:
  // the no-brand page, and the privacy notice read from a brandless host.
  // Both are Qumo speaking in its own voice, so it signs its own name.
  const name = brand?.name ?? PRODUCT_NAME;
  const sub = caption ?? brand?.tagline ?? undefined;

  return (
    <header className="sc-head">
      <div>
        {brand?.logoUrl ? (
          // A plain img, not next/image. The source is a brand's own CDN,
          // which means an arbitrary remote host, and next/image would need
          // every one of them declared in next.config.ts before a brand
          // could go live - a deploy in the middle of onboarding. The
          // trade-off is no automatic optimisation; the logo is one small
          // asset and the brand controls it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt={name} className="sc-brandmark" />
        ) : (
          <div className="sc-mark">{name}</div>
        )}
        {sub && <div className="sc-mark-sub">{sub}</div>}
      </div>
      <form action={toggleTheme}>
        <button type="submit" className="sc-theme">
          Theme
        </button>
      </form>
    </header>
  );
}
