# The three plans

One definition, used in two places that have to agree: the decks, which
carry the figures, and the site, which does not.

Last updated 28 October 2026.

---

## The rule

**The site shows the plans. The deck shows the money.**

Four reasons the figures stay off the site for now:

1. **The pitch opens with "no budget in this meeting."** The free pilot on
   one product line is the wedge, and the thing that converts a brand is
   their own numbers on the performance screen. A price list on the site
   pulls budget forward to before the demo, which is where it is weakest.
2. **We cannot invoice.** No payment provider is wired at all and the call
   to action is "request access". A price beside a button that cannot take
   money reads as unfinished rather than transparent.
3. **The figures are untested.** Zero customers. Publishing R7,500 anchors
   it before anybody has paid it, and adding a number later is far easier
   than raising one that has been published.
4. **But silence is the competitor's posture.** `docs/vaultbook-review.md`
   ranks visible pricing third among the openings against them. Naming the
   plans and the axis they are priced on takes most of that ground without
   committing to a figure.

Put the numbers on the site after three pilots, when they are real. By
then it is a one-line change.

## The plans

Names, order and bullets are identical in the decks and on the site. Only
the footer differs: the deck prints a monthly figure, the site prints who
the plan is for.

| | Launch | Programme | Platform |
|---|---|---|---|
| **Shape** | One campaign, one door | Always-on, two doors | National, every door |
| **Doors** | Scan | Scan and text | Scan, text and tap |
| **Volume** | Up to 10,000 scans a month | Up to 100,000 scans a month | 500,000+ scans a month |
| **And** | Console, analytics, pack codes | Campaigns and stores unlimited | Photographed slips accepted |
| **And** | One brand, one campaign | Till slips and store attribution | Several brands on one account |
| **Deck footer** | R7,500 a month, indicative | R25,000 a month, indicative | R60,000 a month, indicative |
| **Site footer** | A first product line | A programme that stays on | A national range |

The volume ceilings do not appear on the site. They are a negotiating
position, not a published limit, and nothing in the product enforces them.

## What is true, and what is not

Worth being exact, because these bullets are about to be published rather
than said in a room where they can be qualified.

**True today.** The scan door. The text door, built and waiting on a
Twilio approval. Till slips with store attribution and the three proof
tiers. Photographed slips, built and switched off behind
`QUMO_SLIP_READER`. Branded pages on the brand's own subdomain. The
console, the performance screen and pack codes. Several brands on one
account, which is how the tenancy works.

**True with a caveat.** Tap. An NFC tag carrying a scan address works
today with no code change, but **every code earns once, ever**, so one tag
is one award. A tag mounted permanently on a counter awards once and is
then dead. Awarding NFC means one tag per item, like an on-pack code, and
a permanent placement carries the poster link, which joins without
awarding. The decks now say "one tag per item, like a pack code" where
they used to say "for premium packs or the counter".

**Removed, because nothing is behind it.** "CRM integration and API" was a
Tier 03 bullet in both decks. There is no brand-facing API; the only route
of that shape is `/api/consumer/export`, which is a shopper downloading
their own record under POPIA. It is now a roadmap note under the price
rather than a feature in the list.

**Removed, because it is not true.** "Multi-brand and multi-market." The
multi-brand half is true and is now its own bullet. The multi-market half
is not: English only, South Africa only.

**Never on either.** Redemption. `REDEMPTION_AVAILABLE` is false and the
site already says so in its own words under "Where Qumo stands today".

---

## Brief for Lovable

Everything below is written to be handed over as it stands.

### What to add

A new section on the single page, named **Plans**, between the existing
"The shopper's side" section and "Where Qumo stands today". It keeps the
honesty beat about redemption immediately before the request, which is
what makes the page credible, and it puts the commercial shape where a
reader is working out whether to raise their hand.

In `src/routes/index.tsx`, add the section with `id="plans"`. In
`src/components/qumo/chrome.tsx`, add a fourth entry to `links`, after
"Proof of purchase":

```
{ href: "#plans", label: "Plans" },
```

### The copy, exactly

Eyebrow: `Plans`

Heading: `Three ways to run it.`

Lead paragraph:

> The first promotion is free, on one product line. After that Qumo is a
> monthly subscription rather than a project fee, because a programme does
> not end the way a campaign does. Which plan you are on depends on how
> many scans you do and how many doors you open.

Three cards, in this order, in the existing card style:

**Card 1.** Eyebrow `Plan 01`. Title `Launch`. Subtitle `One campaign, one
door`. Bullets:

- Scan door
- Console, analytics and pack codes
- One brand, one campaign

Under a divider, label `Best for`, value `A first product line`.

**Card 2.** Eyebrow `Plan 02`. Title `Programme`. Subtitle `Always-on, two
doors`. Bullets:

- Scan and text doors
- Campaigns and stores unlimited
- Till slips and store attribution

Under a divider, label `Best for`, value `A programme that stays on`.

**Card 3.** Eyebrow `Plan 03`. Title `Platform`. Subtitle `National, every
door`. Bullets:

- Scan, text and tap
- Photographed slips accepted
- Several brands on one account

Under a divider, label `Best for`, value `A national range`.

Closing line under the three cards:

> Priced monthly on scan volume. Tell us the range you have in mind and
> the volume you expect, and we will come back with a figure.

### Rules

- **No figures.** No rand amounts, no "from R", no currency symbol, no
  scan ceilings, no percentages. If a price seems to be missing, it is
  missing on purpose.
- **Use the bullets exactly as written.** Do not expand them, do not add a
  fourth, do not invent a feature that sounds like it belongs. Every line
  above was checked against the running product.
- **No highlighted or recommended plan**, no "most popular" badge, no
  comparison tick matrix. Three equal cards.
- **No new call to action.** The only button is the existing
  `RequestAccess`, which the section at the bottom of the page already
  carries. Do not add a form, a calculator, a toggle, or a contact field.
- **Reuse what is there.** The existing `Section` and card styling
  (`card card-lift card-edge`), the existing type scale, the existing
  `reveal` animation, the existing hairline dividers. No new colours, no
  new fonts, no icons, no new dependencies.
- **One column on a phone**, three across from the large breakpoint, the
  same as the rest of the page.
- **No em dashes anywhere.**
- **Do not touch** `src/lib/site.ts`, `public/sitemap.xml`,
  `public/robots.txt`, the page title, the meta description or the Open
  Graph tags.
- **Do not say** that redemption is open, that Qumo is POPIA compliant,
  that age is verified, or that WhatsApp is available. Do not name a brand
  as a customer. There are none.
