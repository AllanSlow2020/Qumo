import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderLegalCopy } from "../lib/legal/document";

/**
 * Writes docs/consent-copy.md from the copy constants.
 *
 * Run it after changing any shopper-facing wording. The test will tell you
 * to if you forget, which is the arrangement that keeps the document
 * honest rather than merely present.
 */
const out = join(process.cwd(), "docs", "consent-copy.md");
writeFileSync(out, renderLegalCopy(), "utf8");
console.log(`wrote ${out}`);
