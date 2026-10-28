# Qumo: product context for a brand guide

Everything a designer needs to build a brand guide for Qumo, and from it a
marketing site. Written to be handed over whole; it assumes no access to
the codebase and no prior conversation.

Last updated 28 October 2026, against the running product.

---

## 0. What this is for, and the one rule

The output is a brand guide, and then a marketing site built in Lovable at
`qumo-app.com`. Section 7 holds the visual assets that already exist and
should be built on rather than replaced. Section 9 holds what the site may
and may not claim.

**The rule, which matters more than any colour in here:** this product's
copy describes what the system actually does and refuses to claim what it
does not. That discipline is the most distinctive thing Qumo has, more
than its palette, and a marketing site that drops it will not read like
the same company as the product it links to. Section 6 is the section to
take seriously.

---

## 1. What Qumo is

A South African purchase-loyalty platform. A brand runs a rewards
programme on it; a shopper buys something, scans a code that proves the
purchase, and the brand's promotion decides what that scan earns. Qumo
counts it and keeps the record.

It is a **product a brand operates itself**, not an agency service and not
a campaign. There is a console the brand logs into, and the programme runs
until they stop it.

### How earning actually works

- A shopper scans a code: a till slip, a code printed under a pack, or a
  sticker.
- Three promotion shapes: a **flat amount per scan**, a **share of the
  basket** (needs a till slip, because only a slip says what was spent),
  and a **stamp card** that completes into a reward.
- Each slip and each code earns **once, ever**. A slip more than 30 days
  old is refused.
- A promotion can cap what one person earns in a day and what it gives out
  in total, applied at the moment of the scan.
- Nothing awards anything until the brand switches it on.

### What a shopper gets

A wallet, reached by phone number and a one-time code. No app to install,
no password. It shows their balance with each brand, their rewards, and
their history. They can download everything held about them, leave any
brand's programme, or delete their account, themselves, without asking
anybody.

### What is deliberately not built yet

**Redemption is not open.** Value is earned and recorded; spending it is
not live. No marketing material may imply otherwise.

---

## 2. Who it is for

| | |
|---|---|
| **The buyer** | The brand. They pay Qumo. |
| **The user** | Two of them, and they are different people. Brand staff use the console. Shoppers use the wallet. |
| **The shopper pays** | Nothing. Ever. |

The marketing site speaks to the **brand owner**, not the shopper. A
shopper never visits it; they arrive at their brand's own subdomain from a
poster or a pack.

Brand owners here are not enterprise marketing departments. Think an
independent coffee group, a bottle store chain, an FMCG brand running
on-pack promotions through independent stockists. Concrete beats
aspirational with this audience.

---

## 3. The market, and what Qumo is not

The one visible South African competitor is **Vaultbook**, a Johannesburg
promotions agency running competitions, giveaways, games and quizzes for
consumer brands: brief in, campaign out, draw held, winners verified. They
list Coca-Cola, Sprite, Nestlé and others.

They are **not in the same category**, and the brand guide should not
position against them as though they were. They run time-boxed
competitions as a service. Qumo is an ongoing loyalty product. Their own
material names 48 days as an optimal campaign length, which is an
admission: the campaign ends and the relationship ends with it.

Qumo is explicitly **not** doing competitions, prize draws, winner
verification, prize sourcing, games or quizzes. Those are a different
business with their own regulatory surface.

---

## 4. What is actually different

Four things that are true of the running product and that a competitor
selling campaigns structurally cannot say.

1. **One shopper, one account, across every brand.** Not a campaign entry.
   A wallet with history that survives any single promotion ending.
2. **A brand sees no individual shopper at all.** No screen in the console
   shows one. A brand sees its own totals. It never sees a shopper's
   mobile number.
3. **The shopper is in control without asking.** Download, leave, delete,
   all self-service.
4. **The ledger is immutable.** A balance is always the sum of its rows,
   so there is no stored total anybody can disagree with.

Point 2 is the strongest and the least obvious. A competitor whose product
*is* collecting entrant data for a brand cannot make that claim at all.

---

## 5. Proof of purchase, which is the technical heart

Worth understanding because it is what the product is really selling.

Three graded tiers, and a brand picks the weakest it will accept:

| Tier | What it guarantees | What it costs |
|---|---|---|
| Signed slip | The total is signed by the till, so it cannot be edited between the till and the scan | Every store needs a signing secret printed on its slips |
| Qumo code on the slip | Each slip earns once and only once, and only if recent, enforced by the database | A shopper who edits their own receipt will be believed |
| Photograph of any slip | Nothing has to change at the till, so any store can take part | No signature, and once-only holds only as well as the read does |

The third tier is built but **switched off**: no slip reader has been
chosen. Do not market photo capture.

---

## 6. Voice

The most distinctive asset. Real examples, all shipped:

> "This promotion completes a card at 10 and nothing says what it earns,
> so shoppers would collect forever and be given nothing. Set the reward
> before switching it on."

> "No total budget. If any of your stores can't sign their slips, nothing
> bounds what this promotion can issue - a shopper who has seen one of
> their own receipts can invent more."

> "Your customers see this exactly as you type it, in the middle of a
> sentence: '2 more stamps and a free coffee is yours.'"

> "It never awards anything, which is what makes it safe to print
> somewhere anybody can scan it."

What those have in common:

- **Concrete about mechanism, quiet about benefit.** It explains how the
  thing works and lets the reader conclude it is good.
- **Names the cost of a choice**, not only the upside.
- **Second person, present tense, short sentences.**
- **Refuses to overclaim.** Where something is not built, it says so.
- **Plain language is a legal requirement here**, not a preference: the
  Consumer Protection Act requires it.

### Rules

- South African English.
- **No em dashes anywhere.** This is absolute across the product.
- No exclamation marks.
- Banned: revolutionise, seamless, empower, unlock, supercharge,
  game-changing, effortless.
- Write for a brand owner reading on a phone, not for a marketer.

---

## 7. What exists visually

Qumo has **two surfaces with deliberately different identities**, and the
brand guide has to account for both.

### The console: Qumo's own identity

What a brand's staff use. This is where Qumo looks like Qumo.

**Type.** Instrument Sans throughout, Martian Mono for numbers, codes and
anything tabular. Both on Google Fonts.

**Light.** bg `#f5f5f5`, surface `#ffffff`, raised `#fafafa`, ink
`#0a0a0a`, ink-2 `#525252`, ink-3 `#737373`, hairline `#e5e5e5`, strong
hairline `#d4d4d4`.

**Dark.** bg `#0c0d10`, surface `#121418`, raised `#1a1d22`, ink
`#f7f8f8`, ink-2 `#c4cad3`, ink-3 `#9aa1ab`, hairline `#22262d`.

**Accent.** `#2563eb` in both themes, white text on it. The accent holds
its value across themes; only the ground under it changes.

**Status.** positive `#16a34a` / `#4ade80`, warning `#a16207` / `#fbbf24`,
negative `#e7000b` / `#fb7185`. Destructive fill `#c80710` in both, which
is deliberately *not* the negative token: that one is a pale rose in dark
and takes white text to 2.3:1.

**Chart hues**, five, same meanings at the lightness each ground needs:
teal `#0d9488`/`#2dd4bf`, violet `#7c3aed`/`#a78bfa`, amber
`#d97706`/`#fbbf24`, green `#16a34a`/`#4ade80`, rose `#e11d48`/`#fb7185`.

**Radius.** 8px cards and panels, 18px pills and badges, 5px for anything
nested inside an 8px container, 6px small. A nested radius is always
tighter than its parent, never rounder.

**Elevation.** Layered shadows, not a single soft blur. In dark a card
gets a one-pixel inset highlight on its top edge and a dark inset along
the bottom: that pair is what makes it read as a raised object rather than
a bordered div.

**Motion.** Subtle. Cards rise a few pixels on entry, staggered. Numbers
count up from zero once on first paint. Cards lift 2px on hover. All of it
disabled under `prefers-reduced-motion`.

**Mark.** A blue Q. Used as the favicon and beside the word "console" in
the sidebar.

### The shopper wallet: the brand's identity, not Qumo's

This is the part most likely to be got wrong. On the consumer surface
**Qumo deliberately disappears.** Each brand's programme is themed with
that brand's own accent colour and chosen typeface. The surface is
sharper and plainer than the console: corner radius is **2px**, the
palette is near-monochrome, and the only colour is the brand's.

Qumo appears once, in a footer line: "<Brand> rewards, run on Qumo."

**The brand guide must say this explicitly.** Qumo's visual identity is
for the console, the marketing site and the sales material. It is not for
the surface a shopper sees, which belongs to the client.

---

## 8. Naming and addresses

**Product name:** Qumo. **Operating company:** Qumo.

The production root domain is **`qumo-app.com`**.

| Address | What it serves | Status |
|---|---|---|
| `app.qumo-app.com` | The brand console | Live |
| `<brand>.qumo-app.com` | Each brand's shopper programme | Live |
| `qumo-app.com` and `www.qumo-app.com` | **The marketing site** | To build |

`www`, `app`, `admin`, `api`, `console`, `dashboard`, `static`, `assets`,
`mail`, `status`, `docs`, `help` and `support` are all reserved in the
product, so no brand can ever claim one. The apex currently renders a
"this link needs a brand" dead end, so the marketing site displaces
nothing.

**DNS constraint.** Brand subdomains need a wildcard record, and only the
provider holding the zone can serve one. The zone therefore stays with
Vercel, and the apex and `www` become ordinary records inside it pointing
at wherever the site is hosted. Explicit records beat the wildcard, so
`www` resolving elsewhere does not disturb brands.

---

## 9. What the site may and may not claim

**True of the running product today:**

- A shopper buys, scans a code that proves it, and the brand's promotion
  decides what it is worth.
- Codes can be a till slip, an on-pack code, or a sticker.
- Each slip and each code earns once, ever. Slips over 30 days are
  refused. A till slip whose total has been edited is refused.
- Promotions can cap per-person-per-day earning and total payout.
- Three earning shapes: flat per scan, share of basket, stamp card.
- Every brand's data is separated structurally, not by convention.
- A brand never sees a shopper's mobile number and has no screen showing
  an individual shopper.
- Shoppers download, leave, or delete, themselves.
- The console has a built-in guide explaining how to set a programme up.
- Brands pay. Shoppers pay nothing.

**Must not be claimed:**

- **Not that redemption is live.** It is not. No "spend your points"
  screens or mockups.
- **Not that Qumo is POPIA compliant.** A legal review has not happened.
  Describe what the product does, not that a regulator approves.
- **Not that age is verified.** A shopper types a date and nothing checks
  it. The honest claim is that the programme asks, records asking, and
  refuses when told no.
- **No invented numbers.** No customer counts, no uplift percentages, no
  client logos, no testimonials. There is one demo brand and no live
  brands.
- **No pricing** until it is set.
- **Not that WhatsApp is available.** Planned, not built.
- **Not photo capture of slips.** Built, switched off, no reader chosen.

---

## 10. What the brand guide still has to decide

Open, and genuinely open:

1. **Whether `qumo-app.com` is the brand's public face.** It works, it is
   owned, and the product lives on it. It is also a hyphenated domain with
   "app" in it, which reads more like infrastructure than a brand. A
   `.co.za` carries real local trust in this market. Splitting the
   marketing site onto a different domain from the product is a brand
   decision with a cost on both sides.
2. **What Qumo looks like away from a screen.** Everything that exists is
   UI. There is no wordmark treatment, no print behaviour, no photography
   direction, no illustration style.
3. **Whether the blue stays.** `#2563eb` is a capable interface accent and
   was chosen as one. Whether it is the brand colour is a different
   question nobody has answered.
4. **How the two identities are described together.** "Our product wears
   our client's identity" is a real positioning asset and currently exists
   only as an implementation detail.
5. **What the call to action is.** There is no self-service signup: a
   brand is provisioned by hand with a setup key. The site's primary
   action has to be "request access" or similar until that changes.
