"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrandIdentity } from "@/lib/brand/manage";
import {
  DEFAULT_DISPLAY_FONT,
  DEFAULT_FIGURE_FONT,
  FONTS,
  findFont,
  fontStack,
} from "@/lib/brand/fonts";
import { saveIdentity } from "./actions";
import { IDLE, type IdentityState } from "./state";

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * WCAG relative luminance, and then the contrast ratio between two colours.
 *
 * Here because a brand picking white text on a yellow button produces a page
 * their own customers cannot read, and nobody notices until it is printed on
 * a poster. It warns rather than blocks: the palette belongs to the brand,
 * but they should be told before their shoppers find out.
 */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/**
 * One face chooser.
 *
 * A select rather than a grid of specimens, and the specimen is the option
 * itself: each one is drawn in the face it names, so the list *is* the
 * preview. Every face is already declared on the page (app/font-faces.ts),
 * so this costs nothing beyond the download of a face somebody looked at.
 *
 * The first option is Qumo's, and it says so. An empty first option would
 * read as "nothing chosen"; this is a choice with a default already made.
 */
function FontField({
  id,
  name,
  label,
  value,
  onChange,
  defaultFontId,
  help,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  defaultFontId: string;
  help: React.ReactNode;
}) {
  const chosen = findFont(value);
  const fallback = findFont(defaultFontId);

  return (
    <div className="cn-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name={name}
        className="cn-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontFamily: chosen ? fontStack(chosen) : fallback ? fontStack(fallback) : undefined }}
      >
        <option value="">Qumo&apos;s own ({fallback?.label})</option>
        {FONTS.map((font) => (
          <option key={font.id} value={font.id} style={{ fontFamily: fontStack(font) }}>
            {font.label}
          </option>
        ))}
      </select>
      {/* The constant line first, then the one that changes as you scroll
          the list - otherwise the field's own explanation appears to move. */}
      {help}
      {chosen && <p className="cn-label">{chosen.note}</p>}
    </div>
  );
}

export function IdentityForm({ brand }: { brand: BrandIdentity }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<IdentityState, FormData>(saveIdentity, IDLE);

  // Mirrored into React state purely so the preview can move as somebody
  // types. The form still posts the inputs themselves, so nothing here is
  // load-bearing for what gets saved.
  const [displayName, setDisplayName] = useState(brand.displayName ?? brand.name);
  const [tagline, setTagline] = useState(brand.tagline ?? "");
  const [accent, setAccent] = useState(brand.accentColor ?? "");
  const [ink, setInk] = useState(brand.accentInkColor ?? "");
  const [logoUrl, setLogoUrl] = useState(brand.logoUrl ?? "");
  const [displayFont, setDisplayFont] = useState(brand.displayFont ?? "");
  const [figureFont, setFigureFont] = useState(brand.figureFont ?? "");

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const accentOk = HEX.test(accent);
  const inkOk = HEX.test(ink);
  const ratio = accentOk && inkOk ? contrastRatio(accent, ink) : null;

  // What the preview renders in. Falls through to Qumo's own, exactly as
  // the shopper surface does when the column is null.
  const displayFace = findFont(displayFont) ?? findFont(DEFAULT_DISPLAY_FONT);
  const figureFace = findFont(figureFont) ?? findFont(DEFAULT_FIGURE_FONT);
  // The one thing worth saying out loud about a figures face, said only when
  // it applies rather than sitting under the field forever.
  const figuresAreProportional = figureFace !== null && !figureFace.mono;

  return (
    <div className="cn-edit">
      <form action={action} className="cn-form">
        <div className="cn-field">
          <label htmlFor="displayName">Name shoppers see</label>
          <input
            id="displayName"
            name="displayName"
            className="cn-input"
            maxLength={120}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <p className="cn-label">
            Leave it empty to use <strong>{brand.name}</strong>. Set it when your legal name isn&apos;t the one on
            your signage.
          </p>
        </div>

        <div className="cn-field">
          <label htmlFor="tagline">One line underneath</label>
          <input
            id="tagline"
            name="tagline"
            className="cn-input"
            maxLength={120}
            placeholder="Soul food rewards"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>

        <div className="cn-field">
          <label htmlFor="accentColor">Button colour</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="color"
              aria-label="Pick a button colour"
              value={accentOk ? accent : "#000000"}
              onChange={(e) => setAccent(e.target.value)}
              style={{ width: 44, height: 42, padding: 2, border: "1px solid var(--cn-line)", borderRadius: 8, background: "var(--cn-surface)" }}
            />
            <input
              id="accentColor"
              name="accentColor"
              className="cn-input cn-mono"
              placeholder="#C8102E"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
            />
          </div>
          {/* Said plainly, because a brand reasonably expects "colours" to
              mean the whole page. It doesn't, and that is deliberate. */}
          <p className="cn-label">
            This colours the button that says what happens next - and only that. Type, background and rules stay as
            they are, so a promotion can&apos;t end up unreadable.
          </p>
        </div>

        <div className="cn-field">
          <label htmlFor="accentInkColor">Text on the button</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="color"
              aria-label="Pick the text colour for the button"
              value={inkOk ? ink : "#ffffff"}
              onChange={(e) => setInk(e.target.value)}
              style={{ width: 44, height: 42, padding: 2, border: "1px solid var(--cn-line)", borderRadius: 8, background: "var(--cn-surface)" }}
            />
            <input
              id="accentInkColor"
              name="accentInkColor"
              className="cn-input cn-mono"
              placeholder="#FFFFFF"
              value={ink}
              onChange={(e) => setInk(e.target.value)}
            />
          </div>
          {ratio !== null && ratio < 4.5 && (
            <p className="cn-label cn-warn-note">
              Contrast is {ratio.toFixed(1)}:1. Below 4.5:1 this is hard to read on a phone in daylight - which is
              exactly where it gets read.
            </p>
          )}
        </div>

        <FontField
          id="displayFont"
          name="displayFont"
          label="Type"
          value={displayFont}
          onChange={setDisplayFont}
          defaultFontId={DEFAULT_DISPLAY_FONT}
          help={
            <p className="cn-label">
              Everything a shopper reads - your name, headings and body. Leave it on Qumo&apos;s and you get our
              house style rather than the browser&apos;s.
            </p>
          }
        />

        <FontField
          id="figureFont"
          name="figureFont"
          label="Figures"
          value={figureFont}
          onChange={setFigureFont}
          defaultFontId={DEFAULT_FIGURE_FONT}
          help={
            figuresAreProportional ? (
              /* Not a block, and not a scold. The face is theirs to choose;
                 this points at the one thing a picker cannot show them, and
                 tells them where to look rather than asserting a problem -
                 amounts are already set to ask for fixed-width digits, and
                 most faces have them, so the preview is the real answer. */
              <p className="cn-label cn-warn-note">
                {figureFace?.label} isn&apos;t a monospace. Amounts ask for fixed-width digits and most faces have
                them - look at the two in the preview: if their decimal points line up, yours do too.
              </p>
            ) : (
              <p className="cn-label">
                Balances, amounts and coupon codes. A monospace, so a column of them holds still whatever the
                numbers do.
              </p>
            )
          }
        />

        <div className="cn-field">
          <label htmlFor="logoUrl">Logo address</label>
          <input
            id="logoUrl"
            name="logoUrl"
            className="cn-input"
            placeholder="https://…"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
          <p className="cn-label">
            Must start with <code>https://</code>. Leave it empty and your name is used as the wordmark.
          </p>
        </div>

        <div className="cn-field">
          <label htmlFor="supportEmail">Support email</label>
          <input
            id="supportEmail"
            name="supportEmail"
            className="cn-input"
            type="email"
            defaultValue={brand.supportEmail ?? ""}
          />
          <p className="cn-label">
            Shoppers with a problem are sent to you, not to us - you run the programme, so you own the complaint.
          </p>
        </div>

        <div className="cn-field">
          <label htmlFor="supportUrl">Support page (optional)</label>
          <input id="supportUrl" name="supportUrl" className="cn-input" placeholder="https://…" defaultValue={brand.supportUrl ?? ""} />
        </div>

        {state.ok === false && (
          <p className="cn-err" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="cn-btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "Saving…" : state.ok ? "Saved - save again" : "Save appearance"}
        </button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h3 className="cn-h2">What a shopper sees</h3>
        {/* A real render of the shopper header and primary button, not a
            picture of one - same fallbacks, same two tokens. It moves as the
            fields move, which is the whole reason the panel is here. */}
        <div className="cn-preview" style={{ fontFamily: displayFace ? fontStack(displayFace) : undefined }}>
          <div className="cn-preview-head">
            {logoUrl.startsWith("https://") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="cn-preview-logo" />
            ) : (
              <span className="cn-preview-mark">{displayName || brand.name}</span>
            )}
            {tagline && <span className="cn-preview-sub">{tagline}</span>}
          </div>
          <p className="cn-preview-h1">Get 5% of every purchase back</p>

          {/* The balance and two activity rows, in the figures face. The
              amounts are deliberately different widths - 8.50 against
              142.00 - because that is when a proportional face shows what
              it does to a column. */}
          <div style={{ fontFamily: figureFace ? fontStack(figureFace) : undefined }}>
            <p className="cn-preview-figure">R142.00</p>
          </div>
          <div className="cn-preview-rows" style={{ fontFamily: figureFace ? fontStack(figureFace) : undefined }}>
            <div className="cn-preview-row">
              <span>Sea Point</span>
              <span>+R8.50</span>
            </div>
            <div className="cn-preview-row">
              <span>Claremont</span>
              <span>+R11.00</span>
            </div>
          </div>

          <button
            type="button"
            className="cn-preview-btn"
            style={accentOk ? { background: accent, color: inkOk ? ink : "#ffffff" } : undefined}
            onClick={(e) => e.preventDefault()}
          >
            Join {displayName || brand.name} rewards
          </button>
          <p className="cn-preview-foot">
            {displayName || brand.name} rewards, run on Qumo.
          </p>
        </div>
        <p className="cn-label">
          Saved changes are live on your site immediately - there is nothing to publish.
        </p>
      </div>
    </div>
  );
}
