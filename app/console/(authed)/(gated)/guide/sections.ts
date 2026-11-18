/**
 * The sections of the How it works page, in the order they are read.
 *
 * One list, used by the page and by the reading rail, because a contents
 * beside hand-written sections is two things that drift and the one that
 * drifts is the one nobody is looking at.
 *
 * Plain data with nothing imported, so the rail (a client component) and the
 * test can read it without pulling in the server.
 *
 * ── The read times ───────────────────────────────────────────────────────
 *
 * Estimates, in whole minutes, worked out as the words in the section at
 * about 200 a minute plus a minute for each thing in it that can be tried.
 * They are here to say how big a section is before opening it, so a reader
 * can choose, and they are labelled "about" wherever they appear. When a
 * section grows, this is the number to look at.
 */
export type GuideSection = {
  id: string;
  title: string;
  mins: number;
};

export const SECTIONS: readonly GuideSection[] = [
  { id: "what", title: "What Qumo actually does", mins: 1 },
  { id: "codes", title: "The three kinds of code", mins: 3 },
  { id: "awards", title: "What a promotion can award", mins: 1 },
  { id: "cards", title: "Stamp cards", mins: 3 },
  { id: "cost", title: "What it can cost you", mins: 3 },
  { id: "shopper", title: "What your customer sees", mins: 2 },
  { id: "ending", title: "Pausing and ending", mins: 1 },
];

export const SECTION_IDS = SECTIONS.map((s) => s.id);

export const TOTAL_MINS = SECTIONS.reduce((sum, s) => sum + s.mins, 0);

/** Open when the page loads: the first, so there is something to read. */
export const DEFAULT_OPEN: readonly string[] = ["what"];
