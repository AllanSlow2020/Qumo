import {
  CONSENT_CHECKBOX_LABEL,
  CONSENT_POINTS,
  SMS_CONSENT_VERSION,
  SMS_JOIN_TERMS,
  SMS_TERMS_BODY,
  WEB_CONSENT_VERSION,
} from "@/lib/consumer/consent";
import { TERMS_POINTS, TERMS_VERSION } from "@/lib/consumer/terms";
import { OPERATOR_NAME, PRODUCT_NAME } from "@/lib/product";

/**
 * Renders every word a shopper is shown before they agree to anything, as
 * one document somebody outside the codebase can read end to end.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * The copy lives in TypeScript because it has to: the notice interpolates
 * the product name, the terms interpolate the honour window, and both are
 * versioned by constants the sign-in path compares against. That is the
 * right home for it and it is a bad thing to hand a lawyer. Reviewing
 * prose by reading around backtick templates, import statements and sixty
 * lines of comment about why a version was bumped is a way to miss the
 * sentence that matters.
 *
 * So the words are rendered out. The copy is still edited in one place -
 * the constants - and this file is a view of them, regenerated rather than
 * maintained. tests/legal-copy.test.ts fails when docs/consent-copy.md
 * stops matching, which is what stops the two drifting apart the moment
 * the first review comes back and somebody edits the easier file.
 *
 * ── Why the commentary is in here and not in the markdown ────────────────
 *
 * Everything the generated document says, including the guidance at the
 * top, comes out of this function. If the preamble lived in the .md as
 * hand-written text the drift test could not cover it, and a stale
 * instruction to a reviewer is worse than none: they would review the
 * wrong thing carefully.
 */

/**
 * Where a piece of copy is shown, and under which recorded version.
 *
 * A reviewer needs the version beside the words rather than in a table
 * somewhere else, because the two facts are only useful together: what a
 * person read, and what we would be able to prove they read.
 */
type Block = {
  title: string;
  shown: string;
  version: string | null;
  /** True for anything delivered as SMS, where length costs money. */
  metered?: boolean;
  points?: { heading: string; body: string }[];
  text?: string;
};

/**
 * Segments a GSM-7 message would occupy.
 *
 * 160 characters alone, 153 each once a message is split, because a
 * concatenated message spends seven bytes per part on the header that
 * tells the handset how to reassemble it. Approximate by design: a single
 * character outside GSM-7 (an emoji, a curly quote pasted in from a Word
 * document) switches the whole message to UCS-2 and halves these numbers.
 * The point is to show a reviewer that a longer sentence has a price, not
 * to bill anyone from it.
 */
const segments = (text: string): number => (text.length <= 160 ? 1 : Math.ceil(text.length / 153));

const sms = (text: string): string => {
  const parts = segments(text);
  return `${text.length} characters, ${parts} SMS segment${parts === 1 ? "" : "s"}`;
};

const blocks = (): Block[] => [
  {
    title: "The tick box",
    shown: "Beside the checkbox on the registration screen, linking to both documents below.",
    version: WEB_CONSENT_VERSION,
    text: CONSENT_CHECKBOX_LABEL,
  },
  {
    title: "Privacy notice",
    shown: "At /legal/privacy, linked from the tick box.",
    version: WEB_CONSENT_VERSION,
    points: CONSENT_POINTS,
  },
  {
    title: "Terms",
    shown: "At /legal/terms, linked from the tick box.",
    version: TERMS_VERSION,
    points: TERMS_POINTS,
  },
  {
    title: "SMS join message",
    shown:
      "Sent to an unrecognised number before any account exists for it. The reply YES is the whole of the agreement on this channel, so this is all the person will have read when they agree.",
    version: SMS_CONSENT_VERSION,
    metered: true,
    text: SMS_JOIN_TERMS,
  },
  {
    title: "SMS full notice",
    shown:
      "Sent when somebody replies TERMS. Built from the privacy notice above rather than written again, so the two cannot drift into saying different things.",
    version: SMS_CONSENT_VERSION,
    metered: true,
    text: SMS_TERMS_BODY,
  },
];

const PREAMBLE = `# What a ${PRODUCT_NAME} shopper agrees to

Every word a shopper is shown before they agree to anything, in the five
places they can be shown it. This is the document to mark up.

**Generated from the code, not written here.** The copy lives in
\`lib/consumer/consent.ts\` and \`lib/consumer/terms.ts\`; this file is
regenerated from them with \`pnpm legal:copy\`. Editing it directly is
lost work, and a test fails when the two disagree. Mark it up, hand it
back, and the changes are applied to the constants.

**Not written by a lawyer, and that is the point of sending it.** It was
written to describe what the system actually does and to claim nothing it
does not, which is a different standard from being legally sufficient. No
part of it has been reviewed.

## How a version works here

Each block below is recorded under a version. A shopper's row keeps the
version they agreed under and is never rewritten, so the question "what did
this person actually read" has an answer for every person on the platform.
Change any of these words in substance and the version is bumped, and every
existing shopper re-affirms on their next sign-in.

Today that costs nothing, because there are no real shoppers: the only
numbers in any database are ours. After a pilot, a correction to these
words is a re-consent screen in front of people who already signed up.
That asymmetry is the reason this is being reviewed now rather than when
the product feels finished.

## The three things worth a reviewer's attention first

1. **"Who answers for what", in the privacy notice.** It says ${OPERATOR_NAME}
   answers for the shopper's account and each brand answers for its own
   programme. That is a split responsibility reading, and it was chosen to
   match what the code does rather than to take a legal position: the
   shopper's number, age confirmation and consent are held once for the
   whole platform and no brand can see them, while each brand's programme
   records are visible only to that brand. See \`docs/popia.md\` for the
   argument and for what follows from it. If the right answer is that the
   brand is the responsible party for all of it, this is the sentence that
   changes, and the contract changes with it.
2. **"Your choices", in the privacy notice.** It promises a download, a way
   to leave any brand, and deletion, all without asking anyone, and it says
   deletion leaves an anonymous record of a reward having been earned
   because that record is the brand's financial one. All three are built
   and work today. The question is whether describing it as deletion, when
   a row survives with nothing identifying on it, is the right word under
   section 24(1)(b).
3. **The SMS join message.** Two sentences and a reply of YES is the entire
   consent on that channel, for people who cannot open a web page. It is
   the weakest consent record here by some distance, and it is the one most
   likely to be relied on in a township market.

---
`;

const renderBlock = (block: Block, index: number): string => {
  const head = [`## ${index}. ${block.title}`, "", block.shown, ""];
  if (block.version) head.push(`*Recorded as \`${block.version}\`.*`, "");
  if (block.metered && block.text) head.push(`*${sms(block.text)}.*`, "");

  if (block.text) return head.concat(blockQuote(block.text), [""]).join("\n");

  const body = (block.points ?? []).flatMap((point) => [`### ${point.heading}`, "", point.body, ""]);
  return head.concat(body).join("\n");
};

/**
 * Quoted rather than fenced. A fence would render the SMS copy in a
 * monospace box, which invites a reviewer to read it as configuration
 * instead of as a sentence somebody receives on a phone.
 */
const blockQuote = (text: string): string[] =>
  text.split("\n").map((line) => (line.length > 0 ? `> ${line}` : ">"));

export const renderLegalCopy = (): string => {
  const sections = blocks().map((block, i) => renderBlock(block, i + 1));
  return `${PREAMBLE}\n${sections.join("\n")}`.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
};
