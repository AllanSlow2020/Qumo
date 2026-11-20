"use client";

import { useState } from "react";

/**
 * The customer's four screens on a phone, wearing whichever brand is picked.
 *
 * The sentences on the phone are the shopper surface's own (tests hold them
 * together), and the figures are finished strings from customer-view.tsx,
 * made by the functions the real wallet calls. This component only lays them
 * out and lets the reader move between them.
 *
 * ── What the phone shows that is the brand's, and what is not ────────────
 *
 * The name, the tagline, the heading typeface and the accent. The accent is
 * on the button and the stamps and nowhere else, because that is the rule on
 * the real surface: money is always ink. A brand that picks a red does not get
 * red amounts.
 *
 * The phone is always drawn as the shopper's light theme, whatever the console
 * is set to. It is a picture of another surface, so it carries its own
 * colours (--ph-* in console.css) rather than borrowing the console's.
 *
 * ── Selection ────────────────────────────────────────────────────────────
 *
 * Native radios for the brand and for the step. "One of these" is what they
 * are, and the browser gives arrow-key movement and a single tab stop for
 * free. The screen is keyed by step and brand, so a change plays the arrival
 * animation once and a re-render does not.
 */

export type TourBrand = {
  id: string;
  name: string;
  tagline: string;
  accent: string;
  accentInk: string;
  font: string;
  fontLabel: string;
  kind: "card" | "balance";
  campaignName: string;
  worth: { figure: string; suffix: string | null };
  worthText: string;
  balance: { figure: string; suffix: string | null };
  balanceText: string;
  card: { filled: number; total: number; line: string } | null;
  reward: { name: string; code: string } | null;
};

const STEPS = [
  {
    title: "They scan",
    text: "If they have never been seen before, the page asks for a mobile number first. The code they scanned waits for them while they do it, and the page says what it is worth.",
  },
  {
    title: "A code by text, no password",
    text: "A six-digit code arrives by SMS and expires in ten minutes. There is no app to install and nothing to remember.",
  },
  {
    title: "What the code was worth",
    text: "The page says what the code earned and what their balance is now, and that a code works once. Your name at the top, your colour on the button.",
  },
  {
    title: "Their rewards live at your address",
    text: "A stamp card shows as marks filling up rather than a number. Qumo appears once, in small type at the bottom, saying who runs it.",
  },
] as const;

function Figure({ value, big }: { value: { figure: string; suffix: string | null }; big?: boolean }) {
  return (
    <p className={big ? "ph-figure" : "ph-figure ph-figure-sm"}>
      {value.figure}
      {value.suffix && <span className="ph-unit"> {value.suffix}</span>}
    </p>
  );
}

function Head({ brand }: { brand: TourBrand }) {
  return (
    <header className="ph-head">
      <div className="ph-mark">{brand.name}</div>
      <div className="ph-mark-sub">{brand.tagline}</div>
    </header>
  );
}

function Screen({ step, brand, consent }: { step: number; brand: TourBrand; consent: string }) {
  if (step === 0) {
    return (
      <>
        <Head brand={brand} />
        <section className="ph-tile">
          <p className="ph-label">Waiting for you</p>
          <Figure value={brand.worth} big />
          <p className="ph-body">
            from the {brand.campaignName} code you scanned. Sign in below and it lands in your balance.
          </p>
        </section>
        <p className="ph-h1">{brand.name} rewards</p>
        <p className="ph-body">Enter your mobile number and we&apos;ll text you a code. No password to remember.</p>
        <div className="ph-field">
          <span className="ph-label">Mobile number</span>
          <span className="ph-input">082 123 4567</span>
        </div>
        <p className="ph-check">
          <span className="ph-box" aria-hidden="true" />
          <span className="ph-consent">{consent}</span>
        </p>
        <span className="ph-btn">Send me a code</span>
      </>
    );
  }

  if (step === 1) {
    return (
      <>
        <Head brand={brand} />
        <p className="ph-h1">{brand.name} rewards</p>
        <p className="ph-body">
          We sent a 6-digit code to <strong>082 123 4567</strong>. It expires in 10 minutes.
        </p>
        <div className="ph-field">
          <span className="ph-label">Your code</span>
          <span className="ph-input ph-input-mono">482913</span>
        </div>
        <span className="ph-btn">Sign in</span>
        <span className="ph-btn ph-btn-quiet">Use a different number</span>
      </>
    );
  }

  if (step === 2) {
    return (
      <>
        <Head brand={brand} />
        <section className="ph-tile">
          <p className="ph-label">This {brand.campaignName} code is worth</p>
          <Figure value={brand.worth} big />
          <p className="ph-ldr">
            <span>Your {brand.name} balance</span>
            <span>{brand.balanceText}</span>
          </p>
          <p className="ph-label">Each code works once, so scanning this one again won&apos;t add more.</p>
        </section>
        {brand.reward && (
          <section className="ph-tile ph-tile-pos">
            <p className="ph-label">Card complete, you&apos;ve earned</p>
            <p className="ph-h2">{brand.reward.name}</p>
            <p className="ph-code">{brand.reward.code}</p>
            <p className="ph-label">Show this code to claim it. It&apos;s saved in your rewards too.</p>
          </section>
        )}
        <span className="ph-btn">See my rewards</span>
      </>
    );
  }

  return (
    <>
      <Head brand={brand} />
      {brand.card ? (
        <section className="ph-tile">
          <div className="ph-card-head">
            <p className="ph-h2">{brand.campaignName}</p>
            <span className="ph-count">
              {brand.card.filled}/{brand.card.total}
            </span>
          </div>
          <div
            className="ph-stamps"
            role="img"
            aria-label={`${brand.card.filled} of ${brand.card.total} collected`}
            style={{ gridTemplateColumns: `repeat(${brand.card.total <= 6 ? brand.card.total : Math.ceil(brand.card.total / 2)}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: brand.card.total }, (_, i) => (
              <span key={i} className={i < brand.card!.filled ? "ph-stamp ph-stamp-on" : "ph-stamp"} aria-hidden="true" />
            ))}
          </div>
          <p className="ph-body">{brand.card.line}</p>
        </section>
      ) : (
        <section className="ph-tile">
          <Figure value={brand.balance} big />
          <p className="ph-label">Wallet</p>
        </section>
      )}
      <p className="ph-h2">Rewards</p>
      {brand.reward ? (
        <section className="ph-tile ph-tile-pos">
          <p className="ph-label">Yours to use</p>
          <p className="ph-h2">{brand.reward.name}</p>
          <p className="ph-code">{brand.reward.code}</p>
        </section>
      ) : (
        <p className="ph-body">Nothing waiting right now. Finish a card and the code turns up here.</p>
      )}
    </>
  );
}

export function PhoneTour({
  brands,
  consent,
  productName,
}: {
  brands: TourBrand[];
  consent: string;
  productName: string;
}) {
  const [brandId, setBrandId] = useState(brands[0]!.id);
  const [step, setStep] = useState(0);
  const brand = brands.find((b) => b.id === brandId) ?? brands[0]!;
  const last = step === STEPS.length - 1;

  return (
    <figure className="cn-fig cn-tour">
      <div className="cn-tour-grid">
        <div className="cn-tour-picker">
          <p className="cn-fig-name">Pick a brand</p>
          <div className="cn-calc-choices" role="radiogroup" aria-label="Brand">
            {brands.map((b) => (
              <label key={b.id} className="cn-choice">
                <input type="radio" name="tour-brand" value={b.id} checked={b.id === brandId} onChange={() => setBrandId(b.id)} />
                <span>
                  <i className="cn-swatch" style={{ background: b.accent }} aria-hidden="true" />
                  {b.name}
                </span>
              </label>
            ))}
          </div>
          <p className="cn-calc-hint">
            Heading typeface: {brand.fontLabel}. The colour sits on the button and the stamps. Money stays ink, whatever
            colour you choose.
          </p>
        </div>

        <div className="cn-tour-phone">
          <div
            className="ph"
            role="group"
            aria-label="Illustration of a customer's phone"
            style={
              {
                "--ph-accent": brand.accent,
                "--ph-accent-ink": brand.accentInk,
                "--ph-display": brand.font,
              } as React.CSSProperties
            }
          >
            <div className="ph-screen">
              <div key={`${brand.id}-${step}`} className="ph-body-wrap" aria-live="polite">
                <Screen step={step} brand={brand} consent={consent} />
              </div>
              <footer className="ph-foot">
                {brand.name} rewards, run on {productName}. How we handle your details · Terms
              </footer>
            </div>
          </div>
        </div>

        <div className="cn-tour-steps">
          <div className="cn-tour-steplist" role="radiogroup" aria-label="Step">
            {STEPS.map((s, i) => (
              <label key={s.title} className="cn-tour-step" data-on={i === step}>
                <input type="radio" name="tour-step" value={i} checked={i === step} onChange={() => setStep(i)} />
                <span className="cn-tour-n" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="cn-tour-copy">
                  <span className="cn-tour-title">{s.title}</span>
                  <span className="cn-tour-text">{s.text}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="cn-ladder-actions">
            <button type="button" className="cn-btn" onClick={() => setStep(last ? 0 : step + 1)}>
              {last ? "Start again" : "Next step"}
            </button>
          </div>
        </div>
      </div>

      <figcaption className="cn-fig-cap">
        Illustration. Made-up data. The sentences are the ones on your customer&apos;s screens, and the figures are
        worked out by the same code. Your own name, colour and typeface are set under Programme.
      </figcaption>
    </figure>
  );
}
