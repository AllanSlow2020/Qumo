import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// Required rather than imported: `docx` is resolved through the CommonJS
// lookup on this machine, and a bare ESM import of it fails even though
// require() finds it.
const {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun,
  LevelFormat, PageBreak, PageNumber, Packer, Paragraph, ShadingType, Table,
  TableCell, TableRow, TextRun, WidthType,
} = createRequire(import.meta.url)("docx");

/**
 * The legal drafts, as A4 documents somebody can print, sign off on, or
 * open in Word and redline.
 *
 * ── Why this is a script and not six hand-made files ─────────────────────
 *
 * The markdown in docs/ is the source. It is what gets edited, reviewed in
 * a diff, and checked by the house-style tests. If the Word versions were
 * made by hand they would drift from it within a week, and the drift would
 * be invisible: nobody diffs a .docx.
 *
 * So these are generated, every time, from the same files. A change to the
 * draft is a change to the document by re-running this.
 *
 * ── What it deliberately does not do ─────────────────────────────────────
 *
 * It is not a general markdown converter. It handles exactly the subset
 * these documents use, and throws on anything else rather than silently
 * dropping it, because a clause that vanishes from a contract because the
 * converter did not recognise its syntax is the worst failure available
 * here.
 */

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, "..");
const OUT = process.env.DOCX_DIR ?? path.join(ROOT, "build", "legal");

/** House palette, in the light form a printed page needs. */
const INK = "1F2430";
const BODY = "3A4150";
const MUTED = "6A7080";
const ACCENT = "2563EB";
const RULE = "D5D9E0";
const FLAG_BG = "FFF3D6";
const SANS = "Arial";
const MONO = "Consolas";

/** A4 at 2cm margins. Everything in DXA, 1440 to the inch. */
const CONTENT_WIDTH = 11906 - 1134 * 2;

const DOCUMENTS = [
  { file: "legal-engagement.md", out: "01 Instructions to counsel", title: "Instructions to counsel" },
  { file: "brand-agreement-draft.md", out: "02 Brand agreement (draft)", title: "Brand agreement" },
  { file: "nda-and-assignment-draft.md", out: "03 Assignment and NDA (drafts)", title: "Assignment of IP, and mutual NDA" },
  { file: "legal-draft-for-review.md", out: "04 Shopper terms and privacy notice (draft)", title: "Shopper terms and privacy notice" },
  { file: "terms-brief.md", out: "05 Drafting brief, shopper documents", title: "Drafting brief: shopper documents" },
  { file: "popia.md", out: "06 The responsible-party question", title: "The responsible-party question" },
];

// ── Inline ────────────────────────────────────────────────────────────────

/**
 * One line of markdown into runs.
 *
 * Three things get their own treatment, and the flags are the reason this
 * exists at all: a reviewer has to be able to see at a glance which parts
 * are questions for them rather than drafted text.
 */
function runs(text, base = {}) {
  const out = [];
  const pattern = /(\[\[[^\]]+\]\])|(\*\*[^*]+\*\*)|(`[^`]+`)/g;
  let last = 0;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: SANS, ...base }));
    const token = m[0];
    if (token.startsWith("[[")) {
      out.push(new TextRun({
        text: token.slice(2, -2),
        font: SANS, bold: true, color: INK, shading: { type: ShadingType.CLEAR, fill: FLAG_BG },
        ...base,
      }));
    } else if (token.startsWith("**")) {
      out.push(new TextRun({ text: token.slice(2, -2), font: SANS, bold: true, ...base }));
    } else {
      out.push(new TextRun({ text: token.slice(1, -1), font: MONO, size: 18, color: BODY, ...base }));
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: SANS, ...base }));
  return out.length > 0 ? out : [new TextRun({ text: "", font: SANS })];
}

const para = (text, opts = {}) =>
  new Paragraph({ children: runs(text, opts.run ?? {}), spacing: { after: 160, line: 288 }, ...opts.para });

// ── Blocks ────────────────────────────────────────────────────────────────

function heading(text, level) {
  return new Paragraph({
    children: runs(text, { color: INK, bold: true, size: level === 1 ? 28 : 24 }),
    heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
    spacing: { before: level === 1 ? 420 : 320, after: 160 },
    ...(level === 1
      ? { border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 6 } } }
      : {}),
  });
}

function bullet(text) {
  return new Paragraph({
    children: runs(text),
    numbering: { reference: "qumo-bullets", level: 0 },
    spacing: { after: 100, line: 288 },
  });
}

/**
 * `instance` restarts the count, and leaving it out is a real bug rather
 * than a cosmetic one: every numbered list in the file shares one
 * reference, so clause 4's list carried on from clause 3 and opened at 8.
 * In a contract, a renumbered clause list is a different document.
 */
function ordered(text, instance) {
  return new Paragraph({
    children: runs(text),
    numbering: { reference: "qumo-numbers", level: 0, instance },
    spacing: { after: 100, line: 288 },
  });
}

function quote(text) {
  return new Paragraph({
    children: runs(text, { italics: true, color: BODY }),
    indent: { left: 420 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 12 } },
    spacing: { after: 160, line: 288 },
  });
}

function table(rows) {
  const cols = Math.max(...rows.map((r) => r.length));
  const width = Math.floor(CONTENT_WIDTH / cols);
  const widths = Array.from({ length: cols }, () => width);
  return new Table({
    columnWidths: widths,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    rows: rows.map((cells, r) =>
      new TableRow({
        tableHeader: r === 0,
        children: Array.from({ length: cols }, (_, c) =>
          new TableCell({
            width: { size: width, type: WidthType.DXA },
            shading: r === 0 ? { type: ShadingType.CLEAR, fill: "F2F4F7" } : undefined,
            margins: { top: 90, bottom: 90, left: 120, right: 120 },
            children: [new Paragraph({
              children: runs(cells[c] ?? "", r === 0 ? { bold: true, color: INK } : {}),
              spacing: { after: 0, line: 276 },
            })],
          })),
      })),
  });
}

/** A horizontal rule in the source means a new page here. */
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// ── The parser ────────────────────────────────────────────────────────────

function parse(markdown) {
  const lines = markdown.split("\n");
  const blocks = [];
  let i = 0;
  let title = null;
  let listInstance = 0;
  let inOrdered = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") { i += 1; continue; }

    if (!/^(- |\d+\.\s)/.test(trimmed)) inOrdered = false;

    if (trimmed === "---") { blocks.push(pageBreak()); i += 1; continue; }

    if (trimmed.startsWith("# ")) {
      // The first h1 is the document title and is drawn by the title block.
      // A later one starts a part, which these documents use for the two
      // instruments in one file.
      if (title === null) { title = trimmed.slice(2); i += 1; continue; }
      blocks.push(heading(trimmed.slice(2), 1));
      i += 1;
      continue;
    }
    if (trimmed.startsWith("### ")) { blocks.push(heading(trimmed.slice(4), 2)); i += 1; continue; }
    if (trimmed.startsWith("## ")) { blocks.push(heading(trimmed.slice(3), 1)); i += 1; continue; }

    if (blocks.length === 0 && /^\d{1,2} \w+ 20\d\d\s*[\u00b7|]/.test(trimmed)) { i += 1; continue; }

    if (trimmed.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) rows.push(cells);
        i += 1;
      }
      blocks.push(table(rows));
      blocks.push(new Paragraph({ children: [], spacing: { after: 160 } }));
      continue;
    }

    if (trimmed.startsWith("> ")) {
      const parts = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) { parts.push(lines[i].trim().slice(2)); i += 1; }
      blocks.push(quote(parts.join(" ")));
      continue;
    }

    if (trimmed.startsWith("```")) {
      i += 1;
      const parts = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) { parts.push(lines[i]); i += 1; }
      i += 1;
      for (const p of parts) {
        blocks.push(new Paragraph({
          children: [new TextRun({ text: p, font: MONO, size: 18, color: BODY })],
          shading: { type: ShadingType.CLEAR, fill: "F7F8FA" },
          spacing: { after: 0, line: 260 },
        }));
      }
      blocks.push(new Paragraph({ children: [], spacing: { after: 160 } }));
      continue;
    }

    const isOrdered = /^\d+\.\s/.test(trimmed);
    const makeItem = trimmed.startsWith("- ") ? bullet : isOrdered ? ordered : null;
    if (makeItem) {
      if (isOrdered && !inOrdered) listInstance += 1;
      // A wrapped list item continues on an indented line.
      let text = trimmed.replace(/^- /, "").replace(/^\d+\.\s/, "");
      i += 1;
      while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !lines[i].trim().startsWith("- ")) {
        text += " " + lines[i].trim();
        i += 1;
      }
      blocks.push(isOrdered ? ordered(text, listInstance) : bullet(text));
      inOrdered = isOrdered;
      continue;
    }

    // A paragraph runs to the next blank line.
    const parts = [trimmed];
    i += 1;
    while (i < lines.length && lines[i].trim() !== "" && !/^(#|\||>|-\s|\d+\.\s|```|---$)/.test(lines[i].trim())) {
      parts.push(lines[i].trim());
      i += 1;
    }
    blocks.push(para(parts.join(" ")));
  }

  return { title, blocks };
}

// ── Chrome ────────────────────────────────────────────────────────────────

const mark = readFileSync(path.join(ROOT, "deck", "art", "qumo-ink.png"));

function titleBlock(title, subtitle) {
  return [
    new Paragraph({
      children: [new TextRun({ text: title, font: SANS, bold: true, size: 40, color: INK })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: subtitle, font: SANS, size: 22, color: MUTED })],
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 10 } },
    }),
    new Paragraph({
      children: [new TextRun({
        text: "DRAFT FOR LEGAL REVIEW. NOT LEGAL ADVICE. NOT FOR EXECUTION.",
        font: SANS, bold: true, size: 16, color: ACCENT,
      })],
      spacing: { before: 200, after: 360 },
    }),
  ];
}

function chrome(title) {
  return {
    headers: {
      // The mark is letterhead on page one only. In the body it sat in the
      // first line box, which is shorter than the image, so it overflowed
      // upward and was clipped by the top margin.
      first: new Header({
        children: [new Paragraph({
          children: [new ImageRun({ data: mark, type: "png", transformation: { width: 108, height: 35 } })],
          // atLeast, and that is the whole fix. The document default sets a
          // line height of 288 twentieths, which a renderer may treat as
          // exact: the mark is 35px, about 26pt, so it overflowed its line
          // box upward and was clipped against the page edge.
          spacing: { after: 240, line: 680, lineRule: "atLeast" },
        })],
      }),
      default: new Header({
        children: [new Paragraph({
          children: [new TextRun({ text: title, font: SANS, size: 15, color: MUTED })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 120 },
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          children: [
            new TextRun({ text: "QUMO-APP (PTY) LTD  ·  2026/858757/07  ·  South Africa", font: SANS, size: 14, color: MUTED }),
            new TextRun({ text: "\t", font: SANS }),
            new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], font: SANS, size: 14, color: MUTED }),
          ],
          tabStops: [{ type: "right", position: CONTENT_WIDTH }],
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 8 } },
        })],
      }),
    },
  };
}

const NUMBERING = {
  config: [
    {
      reference: "qumo-bullets",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 420, hanging: 220 } } },
      }],
    },
    {
      reference: "qumo-numbers",
      levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 420, hanging: 220 } } },
      }],
    },
  ],
};

// ── Build ─────────────────────────────────────────────────────────────────

mkdirSync(OUT, { recursive: true });

const stamp = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

for (const spec of DOCUMENTS) {
  const source = readFileSync(path.join(ROOT, "docs", spec.file), "utf8");
  const { blocks } = parse(source);

  const doc = new Document({
    creator: "QUMO-APP (PTY) LTD",
    title: spec.title,
    description: `Draft for legal review. Generated from docs/${spec.file}.`,
    numbering: NUMBERING,
    styles: {
      default: {
        document: { run: { font: SANS, size: 21, color: BODY }, paragraph: { spacing: { line: 288 } } },
      },
    },
    sections: [{
      properties: {
        titlePage: true,
        page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } },
      },
      ...chrome(spec.title),
      children: [
        ...titleBlock(spec.title, `QUMO-APP (PTY) LTD  ·  ${stamp}`),
        ...blocks,
      ],
    }],
  });

  const file = path.join(OUT, `${spec.out}.docx`);
  writeFileSync(file, await Packer.toBuffer(doc));
  console.log("wrote", path.basename(file), `(${blocks.length} blocks)`);
}
