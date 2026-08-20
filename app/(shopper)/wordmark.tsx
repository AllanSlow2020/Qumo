import { PRODUCT_NAME } from "@/lib/product";
import { toggleTheme } from "../theme-actions";

/**
 * The wordmark, and the one place a shopper switches theme.
 *
 * Its own component because the shopper surface is where per-brand theming
 * will eventually land, and when it does this is what has to decide between
 * showing our mark and the brand's. Every screen already goes through it.
 *
 * The name comes from lib/product.ts — a working title, so no screen
 * hardcodes it.
 */
export function Wordmark({ caption }: { caption?: string }) {
  return (
    <header className="sc-head">
      <div>
        <div className="sc-mark">{PRODUCT_NAME}</div>
        {caption && <div className="sc-mark-sub">{caption}</div>}
      </div>
      {/* Shares the staff portal's cookie and server action rather than a
          second mechanism — one place decides what "dark" means. */}
      <form action={toggleTheme}>
        <button type="submit" className="sc-theme">
          Theme
        </button>
      </form>
    </header>
  );
}
