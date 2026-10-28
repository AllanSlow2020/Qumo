# Brief: the Qumo marketing site

For building qumo-app.com in Lovable. The site is a separate codebase from the
product, so this is the document that keeps the two in agreement: what the
site may truthfully claim, what it must look like, where it lives in DNS,
and what its call to action can actually do.

Hand it to Lovable as the project brief. It is self-contained.

---

## 1. The thing to settle before any design

**There is no self-service signup, so "sign up" cannot be the call to
action yet.**

A brand is created at `app.qumo-app.com/provision`. That route is gated by a
setup key held in the environment and handed out by hand, and it is
deliberately not linked from anywhere in the console. The comment on it is
explicit: somebody who needs it has been told the address along with the
key, and a link in the nav would be an invitation to everybody who does
not.

So a prospect who clicks "Get started" today has nowhere to land. Three
ways to close that, in order of how much they cost:

1. **Request access.** The site's CTA opens an email or a booking link.
   Nothing is collected by the site, nothing is built on the Qumo side, and
   Allan provisions the brand by hand and sends the key. This is the right
   answer for a pilot, where the number of brands is small and every one
   of them is a conversation anyway. **Recommended.**
2. **The site collects a lead** and stores it in Lovable's own backend.
   Fastest to build inside Lovable and the most expensive in every other
   way. See section 2: it puts personal information in a second system
   that the POPIA work does not cover.
3. **Build real self-service provisioning** in the product, and link the
   site straight at it. This is product work, and it carries a decision
   nobody has taken: whether anyone at all should be able to create a brand
   without being spoken to first. Worth doing when there is a reason to,
   not in order to have a button.

Pick 1 unless Allan says otherwise. Design the CTA so that swapping it for
3 later is a link change, not a redesign: one primary button, one place.

## 2. Do not collect personal information on this site

The product is in the middle of a POPIA review. `docs/popia.md` and
`docs/legal-draft-for-review.md` describe exactly which personal
information exists, where it is held, and who answers for it. That
description is about to go to a lawyer.

A lead form on a Lovable site, storing a name, an email and a company into
a database Lovable provisions, creates a second store of personal
information in a second country under a second provider, and none of it is
in those documents. It would make a review that is nearly ready stale
before it is read.

So: **no form that stores anything.** A `mailto:` link or a third-party
booking link is fine, because neither creates a store Qumo is responsible
for. If a form is genuinely wanted later, it posts to an endpoint in the
Qumo app and the data lands in the system the POPIA work already describes.

This is not a preference about tooling. It is the one place where the
website choice touches work already in flight.

## 3. Where the site lives

The product uses a subdomain per brand, so DNS has to be set up in a
particular order:

| Host | Serves |
|---|---|
| `qumo-app.com` (apex) | **this site** |
| `www.qumo-app.com` | **this site** |
| `app.qumo-app.com` | the brand console (existing) |
| `<brand>.qumo-app.com` | each brand's shopper programme (existing) |

Two things make this work. `www` and `app` are both already in the
product's reserved subdomain list, so no brand can ever claim either.
And the zone has to stay with Vercel, because a wildcard record for
`*.qumo-app.com` is only available to the provider holding the zone. The apex
and `www` are then ordinary records inside that zone pointing at Lovable.
Explicit records beat the wildcard, so `www` resolving to Lovable does not
conflict with brands resolving to Vercel.

The apex currently renders a "this link needs a brand" dead end, so there
is nothing to remove.

## 4. Design: match the product, do not invent a second look

The first thing a brand does is click from this site into the console. If
the two look like different companies, the site has cost more than it
earned. Use these values rather than anything generated.

**Typography.** Instrument Sans for everything, Martian Mono for numbers,
codes and anything tabular. Both are on Google Fonts, so load them from
there. Do not substitute Inter.

**Corner radius.** 8px on cards and panels. 18px on pills, badges and
anything fully rounded. 5px on an element nested inside an 8px container,
because a nested radius must be tighter than its parent, never rounder.

**Colour, light.** Background `#f5f5f5`, surface `#ffffff`, primary text
`#0a0a0a`, secondary `#525252`, tertiary `#737373`, hairline `#e5e5e5`.

**Colour, dark.** Background `#0c0d10`, surface `#121418`, raised
`#1a1d22`, primary text `#f7f8f8`, secondary `#c4cad3`, tertiary
`#9aa1ab`, hairline `#22262d`.

**Accent.** `#2563eb` in both themes, white text on it. The accent holds
its value across themes; only the ground under it changes.

**Elevation.** Cards are layered shadows, not a single soft blur. In dark
mode a card gets a one-pixel inset highlight on its top edge and a dark
inset along the bottom, which is what makes it read as a raised object
rather than a bordered div. If that is awkward to reproduce, prefer a
flatter card over a wrong one.

**Motion.** Subtle. Cards rise a few pixels on entry, numbers count up
from zero once on first paint, cards lift slightly on hover. Everything
must be disabled under `prefers-reduced-motion`, and the reduced-motion
rules have to come last in the stylesheet or equal-specificity rules after
them will win.

Support both themes. The product does.

## 5. What the site may truthfully say

Claims that are true of the running product today:

- A shopper buys something, scans a code that proves the purchase, and the
  brand's promotion decides what it is worth. Qumo counts it and keeps the
  record.
- Codes can be a till slip, an on-pack code, or a sticker.
- Each slip and each code earns once, ever. A slip more than 30 days old is
  refused. A till slip whose total has been edited is refused.
- A promotion can cap what one person earns in a day and what the promotion
  gives out in total, and the caps apply at the moment of the scan.
- Earning shapes available: a flat amount per scan, a percentage of a
  basket, and a stamp card that completes into a reward.
- Every brand's data is separated from every other brand's structurally,
  not by convention. A brand sees only its own members' activity.
- A brand never sees a shopper's mobile number, and has no screen that
  shows an individual shopper at all. It sees its own totals.
- Shoppers can download everything held about them, leave a programme, or
  delete their account, themselves, without asking anyone.
- The console has a guide explaining how to set a programme up.
- Brands pay Qumo. Shoppers pay nothing.

## 6. What the site must not say

- **Not that redemption is live.** It is not. Value is earned and recorded;
  spending it is not open yet. Do not show a redemption flow, a "spend your
  points" screen, or a mockup implying one.
- **Not that Qumo is POPIA compliant.** The review has not happened. Say
  what the product does, not that a regulator would approve of it.
- **Not that age is verified.** A shopper types a date and nothing checks
  it. The honest claim is that the programme asks, records having asked,
  and refuses when told no.
- **No invented numbers.** No customer counts, no uplift percentages, no
  logos of brands that are not customers, no testimonials. There is one
  demo brand and no live brands.
- **No pricing** until Allan sets it.
- Do not describe WhatsApp as available. It is planned and not built.

## 7. Shape of the page

A single page is enough to start. Suggested order, each section earning its
place:

1. What it is, in one sentence a brand owner understands without context.
2. How it works, in three steps: shopper buys, shopper scans, brand sees it.
3. The three earning shapes, shown rather than listed.
4. What a brand gets: the console, the codes, the separation guarantee.
5. What it costs to start, or "request access" if pricing is unset.
6. One call to action, repeated at top and bottom, going to the same place.

Add a privacy page for the site itself if anything is ever collected. While
nothing is collected, it is not needed, and saying so is better than a
notice describing processing that does not happen.

## 8. House style

South African English. Plain language. Short sentences. Write for a brand
owner, not a marketer: concrete about mechanism, quiet about benefit. No em
dashes anywhere. No exclamation marks. Avoid "revolutionise", "seamless",
"empower", "unlock" and "supercharge".

The product's own copy is the register to match. It describes what things
do and refuses to claim what they do not, and that is the reason it is
worth trusting.

---

## What to send back

The site, plus a list of anything in section 5 that was hard to say
truthfully, and anything a visitor would obviously want to know that this
brief does not answer. The second list is the more useful of the two.
