"use client";

import { useActionState, useState } from "react";
import { LogoField } from "@/app/console/logo-field";
import { saveColours } from "./actions";
import { IDLE, type SetupState } from "./state";

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * WCAG relative luminance, then the ratio between two colours.
 *
 * Same maths as the full appearance screen, and here for the same reason: a
 * brand picking white text on their yellow costs their own customers, and
 * this is the one moment we have their attention on the question. It warns
 * rather than blocks. The palette belongs to them.
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

const swatch: React.CSSProperties = {
  width: 44,
  height: 42,
  padding: 2,
  border: "1px solid var(--cn-line)",
  borderRadius: 8,
  background: "var(--cn-surface)",
};

export function ColoursForm({
  brandName,
  slug,
  uploadedLogo,
  initial,
}: {
  brandName: string;
  slug: string;
  uploadedLogo: string | null;
  initial: { accentColor: string; accentInkColor: string; accentColorDark: string; accentInkColorDark: string; logoUrl: string };
}) {
  const [state, action, pending] = useActionState<SetupState, FormData>(saveColours, IDLE);

  const [accent, setAccent] = useState(initial.accentColor);
  const [ink, setInk] = useState(initial.accentInkColor || "#ffffff");
  const [accentDark, setAccentDark] = useState(initial.accentColorDark);
  const [inkDark, setInkDark] = useState(initial.accentInkColorDark);
  const [upload, setUpload] = useState<string | null>(uploadedLogo);

  // An uploaded logo wins over an address, which is the order
  // lib/brand/theme.ts resolves them in - so removing the upload falls back
  // to the address rather than to nothing, and the preview cannot promise
  // something the shopper page will not do.
  const logo = upload ?? (initial.logoUrl.startsWith("https://") ? initial.logoUrl : null);

  const accentOk = HEX.test(accent);
  const inkOk = HEX.test(ink);
  const ratio = accentOk && inkOk ? contrastRatio(accent, ink) : null;

  // What dark mode will actually use. Leaving the dark pair empty means the
  // light pair is used in both, so the preview has to show that rather than
  // a black rectangle.
  const darkOk = HEX.test(accentDark);
  const shownDark = darkOk ? accentDark : accentOk ? accent : null;
  const shownDarkInk = darkOk ? (HEX.test(inkDark) ? inkDark : "#ffffff") : inkOk ? ink : "#ffffff";

  return (
    <form action={action} className="cn-setup">
      <div className="cn-setup-cols">
        <div className="cn-setup-fields">
          <div className="cn-field">
            <label htmlFor="accentColor">Your button colour</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="color"
                aria-label="Pick your button colour"
                value={accentOk ? accent : "#000000"}
                onChange={(e) => setAccent(e.target.value)}
                style={swatch}
              />
              <input
                id="accentColor"
                name="accentColor"
                className="cn-input cn-mono"
                placeholder="#C8102E"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                required
              />
            </div>
            {/* Said plainly, because "colours" reasonably sounds like the
                whole page. It is not, and that is deliberate. */}
            <p className="cn-label">
              This colours the button that says what happens next, and the progress on a stamp card. Type, background
              and rules stay as they are, so your programme can&apos;t end up unreadable.
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
                style={swatch}
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
                Contrast is {ratio.toFixed(1)}:1. Below 4.5:1 this is hard to read on a phone in daylight, which is
                exactly where it gets read.
              </p>
            )}
          </div>

          <LogoField
            existing={uploadedLogo}
            onPreview={setUpload}
            help="Optional, and you can add it later. Without one your name is set in type, which is a perfectly good answer."
          />

          {/* Carried through rather than asked for. This screen asks one
              question about the logo and the answer is a file; a brand
              provisioned with an address on file should not lose it because
              the field that held it is not on this step. The appearance
              screen is where both are editable. */}
          <input type="hidden" name="logoUrl" value={initial.logoUrl} />

          <details className="cn-setup-more">
            <summary>Different colours for dark mode</summary>
            <p className="cn-label">
              Optional. Leave these empty and your colour above is used in both, which is right for most. Set them when
              a colour chosen against white loses its punch on a dark screen.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                type="color"
                aria-label="Pick the dark mode button colour"
                value={darkOk ? accentDark : accentOk ? accent : "#000000"}
                onChange={(e) => setAccentDark(e.target.value)}
                style={swatch}
              />
              <input
                name="accentColorDark"
                className="cn-input cn-mono"
                placeholder="Same as above"
                value={accentDark}
                onChange={(e) => setAccentDark(e.target.value)}
              />
              <input
                name="accentInkColorDark"
                className="cn-input cn-mono"
                placeholder="#FFFFFF"
                value={inkDark}
                onChange={(e) => setInkDark(e.target.value)}
              />
            </div>
          </details>

          {state.ok === false && <p className="cn-error">{state.error}</p>}

          <button type="submit" className="cn-btn" disabled={pending || !accentOk}>
            {pending ? "Saving" : "Save and open my console"}
          </button>
        </div>

        {/* The preview is the argument. A hex field means nothing until you
            see it on the thing a customer holds. */}
        <div className="cn-setup-preview">
          <p className="cn-label">What your customers will see</p>
          <div className="cn-prev-pair">
            <div className="cn-prev-phone">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="cn-prev-logo" />
              ) : (
                <span className="cn-prev-mark">{brandName}</span>
              )}
              <p className="cn-prev-h1">{brandName} rewards</p>
              <p className="cn-prev-body">Enter your mobile number and we&apos;ll text you a code.</p>
              <span
                className="cn-prev-btn"
                style={accentOk ? { background: accent, color: inkOk ? ink : "#ffffff" } : undefined}
              >
                Send me a code
              </span>
              <p className="cn-prev-foot">{brandName} rewards, run on Qumo.</p>
            </div>

            <div className="cn-prev-phone cn-prev-dark">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="cn-prev-logo" />
              ) : (
                <span className="cn-prev-mark">{brandName}</span>
              )}
              <p className="cn-prev-h1">{brandName} rewards</p>
              <p className="cn-prev-body">Enter your mobile number and we&apos;ll text you a code.</p>
              <span
                className="cn-prev-btn"
                style={shownDark ? { background: shownDark, color: shownDarkInk } : undefined}
              >
                Send me a code
              </span>
              <p className="cn-prev-foot">{brandName} rewards, run on Qumo.</p>
            </div>
          </div>
          <p className="cn-label">
            Live at <span className="cn-mono">{slug}.qumo.co.za</span> the moment you save.
          </p>
        </div>
      </div>
    </form>
  );
}
