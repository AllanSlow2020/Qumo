"use client";

import { useGuide } from "./guide-state";
import { SECTIONS } from "./sections";

/**
 * One section of the guide: its point, always, and its detail when asked for.
 *
 * The point is what the section would say if you only read one line, and it
 * is what stays on screen when the rest is folded. A reader can skim seven
 * sentences, stop at the one they did not know and open that. The title is
 * above it, small, because it names the subject and the point states the
 * conclusion; the other way round, the page reads as a list of topics.
 *
 * Native <details>, so the toggle is a real control that a keyboard and a
 * screen reader already understand, the content stays in the document, and
 * nothing is unmounted when it closes. The open state is the provider's; the
 * element reports back through onToggle, which is also how the browser opening
 * it (find in page, a link into it) reaches the state.
 */
function Chevron() {
  return (
    <svg className="cn-fold-chev" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function FoldSection({
  id,
  point,
  children,
}: {
  id: string;
  point: string;
  children: React.ReactNode;
}) {
  const guide = useGuide();
  const index = SECTIONS.findIndex((s) => s.id === id);
  const section = SECTIONS[index]!;
  const open = guide.isOpen(id);

  return (
    <section className="cn-panel cn-fold" id={id} data-open={open} data-current={guide.current === id} data-jumping={guide.jumping || undefined}>
      <details open={open} onToggle={(e) => guide.setOpen(id, e.currentTarget.open)}>
        <summary className="cn-fold-head">
          <span className="cn-fold-n" aria-hidden="true">
            {index + 1}
          </span>
          <span className="cn-fold-titles">
            <h2 className="cn-fold-k">{section.title}</h2>
            <span className="cn-fold-point">{point}</span>
          </span>
          <span className="cn-fold-act">
            <span className="cn-fold-mins">{section.mins} min</span>
            <span className="cn-fold-label">{open ? "Hide detail" : "Read more"}</span>
            <Chevron />
          </span>
        </summary>
        <div className="cn-panel-body cn-prose cn-fold-body">{children}</div>
      </details>
    </section>
  );
}
