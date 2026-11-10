# Qumo: product context for a brand guide

Everything a designer needs to build a brand guide for Qumo, and from it
the two things that hang off one: a marketing site and a document system.
Written to be handed over whole; it assumes no access to the codebase and
no prior conversation.

Last updated 2 November 2026, against the running product.

---

## 0. What this is for, and the one rule

The output is a brand guide, and from it two applications:

1. **The acquisition site** at `qumo.co.za`, already built in Lovable and
   live. Section 8 describes what is on it. This is now refinement rather
   than a blank page.
2. **A document system**: letterhead, agreements, briefs. Section 11 says
   what exists, what is needed, and the one constraint that matters about
   how the output will be used.

Section 7 holds the visual assets that already exist and should be built
on rather than replaced. Section 10 holds what may and may not be claimed.

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
- Three promotion shapes, and these are the exact words the console uses,
  so marketing material should not invent others: **a stamp card** (buy
  ten, get one free), **a share of what they spend** (needs a till slip,
  because only a slip says what was spent), and **the same amount every
  scan**.
- Each slip and each code earns **once, ever**. A slip more than 30 days
  old is refused.
- A promotion can cap what one person earns in a day and what it gives out
  in total, applied at the moment of the scan.
- Nothing awards anything until the brand switches it on.

### What a balance is denominated in, which is a position rather than an option

**Rands, by default and by recommendation.** The ledger holds cents, the
share-of-spend rule computes cents, and both live demo promotions pay
rands. A shopper understands R12.50 without being taught anything.

Points remain available and are deliberately not presented as an equal
choice. Two reasons, and the second matters more. A shopper has to learn a
conversion rate before they can tell what a scan was worth. And points are
the loyalty industry's standard device for quietly devaluing what somebody
earned, by changing the rate later, which sits badly against a product
whose whole posture is an immutable ledger and a balance that is the sum
of its rows.

Stamps are a different thing again and are untouched by this. A stamp card
is a counter toward a named reward, not a currency.

**For marketing material:** lead with rands. Do not present points as a
co-equal option, and do not invent a Qumo currency with a name. If a
comparison is ever needed, the line is that real money needs no
explaining.

One open question sits under this and belongs to the lawyer, not to
design: whether denominating in rands changes the Consumer Protection Act
analysis at all. Section 35 appears to make loyalty credits a medium of
exchange whatever the unit is called, in which case the choice is purely a
product one. It is question 2.1 in `docs/legal-engagement.md`.

### What a shopper gets

A wallet, reached by phone number and a one-time code. No app to install,
no password. It shows their balance with each brand, their rewards, and
their history. They can download everything held about them, leave any
brand's programme, or delete their account, themselves, without asking
anybody.

### What is deliberately not built yet

**Redemption is not open.** Value is earned and recorded; spending it is
not live. No marketing material may imply otherwise.

More precisely, and this got sharper recently: a completed stamp card does
issue a real reward code to the shopper, and **nothing in the product can
mark that code as used.** So the loop ends at the shopper's phone. Honouring
a reward is something a brand does at its own counter, outside Qumo. Any
design that depicts a reward being redeemed is depicting something that
does not exist.

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

Two domains, each with one job. **This is settled**, so nothing in the
design needs to hedge about it.

| Address | What it serves | Status |
|---|---|---|
| `qumo.co.za` | **The acquisition site.** Built in Lovable, live, and described below. `www` resolves to it. | Live |
| `app.qumo-app.com` | The brand console, where a brand sets promotions up | Live |
| `<brand>.qumo-app.com` | Each brand's own shopper programme | Live |
| `qumo-app.com` (apex) | Redirects to the site | |

The site is **acquisition only**. A brand arrives, reads, asks for access,
and is handed over to the console. They do not come back: day-to-day work
happens in the console, and a shopper never sees the site at all.

Nothing is shared between the two. No session, no sign-in, no account
state, no SSO. **The handover is a link.** That makes the site far simpler
than a product marketing site usually is: a brochure with one action, on
its own domain, with no integration to build and nothing to keep in sync
except the claims in section 10.

### What is on the site today

Eight sections, in this order, all written in the voice in section 6:

1. **Hero.** "A loyalty programme your brand runs itself." One action,
   "request access", and under it "Brands pay Qumo. Shoppers pay nothing."
2. **How it works**, in three steps.
3. **Three ways to earn**, with the five guard rules along a rule beneath:
   each code earns once ever, slips over 30 days refused, edited totals
   refused on a signed slip, caps apply at the moment of the scan, nothing
   earns until you switch it on.
4. **What a brand gets**, as a bento of seven cards including "You never
   see a shopper's number" and "Your data is kept apart".
5. **Proof of purchase**, as a table of two tiers with what each
   guarantees and what it costs.
6. **The shopper's side**, explaining that the programme wears the brand's
   identity and Qumo appears once in a footer.
7. **Plans.** Three named plans with no prices. See section 9.
8. **Where Qumo stands today.** "Early, and clear about it", with a status
   list showing earning, counting and console working and redemption not
   open.
9. **Request access.**

The honesty section sits immediately before the ask, deliberately. That
ordering is the most load-bearing thing about the page and a redesign
should keep it: the page earns the request by having just admitted what is
missing.

### DNS, which is simpler than it would have been

Because the site has its own domain, it carries none of the product's
constraints. `qumo.co.za` points at whatever hosts the site using ordinary
records. The wildcard that serves `<brand>.qumo-app.com` belongs to the
other domain and is not touched, so standing the site up cannot affect
anything that is already running.

### What the handover cannot do yet

**There is no self-service signup.** A brand is created on a route gated by
a setup key that is handed over by hand, and that route is deliberately
unlinked from everywhere. So a "Sign up" button cannot yet drop somebody
into a working account.

Until that changes, the site's single action is **request access**: an
email or a booking link, after which the brand is provisioned manually and
sent the console address. That is the right shape for a pilot anyway,
where every brand is a conversation.

Design the call to action so swapping it for a real signup later is a link
change rather than a redesign: one primary button, one place, repeated at
top and bottom.

## 9. Plans, and the rule about prices

Three plans exist and are named. They appear by name on the site and in
the sales deck, and they carry **figures in the deck only**.

| | Launch | Programme | Platform |
|---|---|---|---|
| Shape | One campaign, one door | Always-on, two doors | National, every door |
| Doors | Scan | Scan and text | Scan, text and tap |
| And | Console, analytics, pack codes | Campaigns and stores unlimited | Photographed slips, when switched on |
| And | One brand, one campaign | Till slips and store attribution | Several brands on one account |
| Site shows | A first product line | A programme that stays on | A national range |

**Why no figures on the site.** The pitch opens by removing budget from
the first meeting: the first promotion is free on one product line, and
what converts a brand is their own numbers afterwards. A price list pulls
budget forward to before the demo, where it is weakest. There is also no
payment provider wired, so a price beside a button that cannot take money
reads as unfinished. And the figures are untested, with no customer having
paid any of them.

The site instead names the plans, says it is a monthly subscription rather
than a project fee, and closes with "Priced monthly on scan volume. Tell
us the range you have in mind and the volume you expect, and we will come
back with a figure."

Figures go on the site after three pilots, when they are real.

---

## 10. What may and may not be claimed

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
  screens or mockups, and nothing showing a reward being accepted at a
  till: a reward code is issued and the product cannot record it as used.
- **Not that Qumo is POPIA compliant.** A legal review has not happened.
  Describe what the product does, not that a regulator approves.
- **Not that age is verified.** A shopper types a date and nothing checks
  it. The honest claim is that the programme asks, records asking, and
  refuses when told no.
- **No invented numbers.** No customer counts, no uplift percentages, no
  client logos, no testimonials. There is one demo brand and no live
  brands.
- **No figures on the site.** The plans are named; the rands live in the
  deck. See section 9.
- **Not that WhatsApp is available.** Planned, not built.
- **Not photo capture of slips.** Built, switched off, no reader chosen.

---

## 11. The document system

New scope, and the part with the least existing material.

### The company, for letterhead

| | |
|---|---|
| Legal name | QUMO-APP (PTY) LTD |
| Registration | 2026/858757/07 |
| Jurisdiction | South Africa |
| Footer line in use today | `QUMO-APP (PTY) LTD  ·  2026/858757/07  ·  South Africa` |

### What exists

**A sales deck house style**, in use for one deck of 33 slides: a
twelve-slide pitch and a three-part appendix behind it. Dark ground
`#0c0d10`, white ink, the same `#2563eb` accent, Arial for text and
Consolas for anything tabular or code-like. Thin hairline rules,
small monospaced kickers in caps with letter-spacing, three-card layouts
with a divider above a footer figure. Every slide carries a footer rule
with "Qumo · indicative, for discussion" and a page number.

**A set of A4 documents**, generated from markdown: six of them, covering
instructions to counsel, a brand agreement, an IP assignment and NDA, the
shopper terms and privacy notice, a drafting brief and a position paper.
They currently use the Qumo mark as page-one letterhead, Arial, a rule
under the title, a `DRAFT FOR LEGAL REVIEW` line in accent blue, and the
company footer above. Tables have a grey header row. Shaded inline spans
mark the passages that are questions for the reviewer rather than drafted
text.

**The mark**, as a wordmark, rendered at 4200 by 1380 with transparency in
three colourways: ink, blue and white.

### What is needed

A document system the brand can grow into: letterhead, a type scale that
works at A4 rather than on a screen, table and list treatments, a
convention for marking draft status, and a treatment for the reviewer
flags. Cover page or no cover page is an open question; today there is a
title block at the head of page one and no separate cover.

### The one constraint that matters

**These documents are generated, not typed.** The markdown in `docs/` is
the source, and a script turns all six into Word files in one run. That is
deliberate: the markdown is what gets edited, reviewed in a diff and
checked by the house-style tests, and hand-made copies drift from it
within a week in a way nobody notices, because nobody diffs a `.docx`.

So the useful output here is **a design, not a set of finished files.**
Specification, measurements, colours, type sizes, spacing, a rendered
example of each element. That gets implemented in the generator once and
then every document follows it, including documents that do not exist yet.
A beautiful one-off Word file is worth less than the spec behind it,
because the next version of that document will be generated and will not
match it.

---

## 12. What the brand guide still has to decide

Open, and genuinely open:

1. **What Qumo looks like away from a screen.** Everything that exists is
   UI. There is no wordmark treatment, no print behaviour, no photography
   direction, no illustration style.
2. **Whether the blue stays.** `#2563eb` is a capable interface accent and
   was chosen as one. Whether it is the brand colour is a different
   question nobody has answered.
3. **How the two identities are described together.** "Our product wears
   our client's identity" is a real positioning asset and currently exists
   only as an implementation detail.
4. **How much the site should show of the console.** The product's own
   screens are the most convincing thing about it and the hardest to keep
   current. A screenshot ages; an illustration does not but proves less.
5. **Whether the deck's dark ground and the documents' light one are one
   system or two.** They share an accent and a typeface and nothing else.
   That may be right, since a projected slide and a printed page are
   different problems, but nobody has decided it on purpose.
6. **A trade mark search is in progress** on the name Qumo. It is worth
   knowing before deep investment in a wordmark treatment: if it comes
   back with a conflict in software, advertising or SaaS classes, the name
   question reopens and anything built on it has to move.
