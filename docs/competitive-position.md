# Vaultbook, and what it tells us to build

Context and a roadmap, from the competitor review in October 2026. The
review itself is the input; this is what it means for a product that
already exists.

**They are not in our category, and that matters before anything else.**
Vaultbook is a promotions agency that runs time-boxed competitions as a
service: brief in, campaign out, draw held, winners verified, file
archived. Qumo is an ongoing purchase-loyalty product a brand operates
itself. A brand could buy both and not feel they had bought the same thing
twice.

Where the two genuinely overlap is four things, and those are the only
places their sheet should move ours: proof that a purchase happened, a
phone number as the identity, South African compliance, and what the brand
can see afterwards. Everything else on their site is either a different
business or something we have decided not to be.

---

## 1. The one that matters: how a purchase is proved

This is the real finding, and it is not a feature gap. It is an adoption
gap.

**What they require of a retailer: nothing.** The shopper photographs
whatever slip the till already printed. Any store, any till, no
conversation with anybody's POS vendor.

**What we require: the till must print a Qumo QR.** `/r` reads the store
code, transaction id, amount and purchase time out of a signed URL. A
store that cannot print that link cannot take part at all, however much
the brand wants them to.

That is a harder sell than it looks. A brand with 400 independent
stockists cannot get 400 POS vendors to change a receipt template, and our
answer to them today is that those stores are out.

### What we have that they do not

`lib/stores/receipt.ts` already names three separate defences and is
explicit that only two of them are always available:

1. **The signature** stops a shopper editing `c=8500` to `c=85000` before
   scanning. Needs a store signing secret.
2. **The unique constraint on (store, transaction id)** stops one slip
   being scanned twice, or photographed and shared. Always available, and
   it is a database constraint rather than an `if`, because two phones
   scanning one photo at the same instant would sail past an `if`.
3. **The freshness window** stops a hoard of old slips being scanned the
   day a promotion launches. Always available.

So the architecture already has a notion of a weaker tier and already
ships it: an unsigned store works, loses only the amount-editing defence,
and the console says so.

### Therefore: photo capture is a third tier, not a replacement

Run the same three defences against an OCR'd photograph and the answer
falls out:

| Defence | Signed QR | Unsigned QR | Photographed slip |
|---|---|---|---|
| Amount cannot be edited | Yes | No | No |
| Each slip earns once | Yes | Yes | Only if the read gets store and slip number right |
| Nothing stale | Yes | Yes | Only if the read gets the date right |

A photograph is roughly the unsigned tier with a new failure mode on top:
the read itself can be wrong, and a wrong read either robs an honest
shopper or pays a dishonest one. Vaultbook publishes no accuracy figure,
no retailer coverage and no appeal path, which is observation 6 in the
review and is not an accident.

**So the shape is: accept photographs, price them as the weakest tier, and
say so.** The ceilings we already have are what make a weak tier
survivable, and that is the same argument the codebase already makes for
unsigned stores. A per-promotion setting for which tiers it accepts is the
natural place to put it, beside the store signing status the console
already shows.

The prize is worth the work: it is the difference between "your stockists
need a POS change" and "your stockists need nothing". That single sentence
is most of the sales objection.

### What we would have to be honest about, and they are not

- A stated accuracy figure, measured, not claimed.
- Which chains' slip layouts are supported, and what happens outside them.
- What a shopper sees when a read fails, and how they get it looked at.

Publishing those turns their quietest page into our loudest one.

---

## 2. Their idea list, with our actual status

Their section 4, answered from the code.

| Their idea | Our status |
|---|---|
| Consumer "my entries / wins / claim status" by phone, no app, no password | **Have, and further than they describe.** A wallet with balance, rewards, history and a per-brand view, signed into by one-time code. Their site describes no consumer account at all. |
| Self-serve brand onboarding with visible pricing | **Do not have.** Provisioning is a setup key handed over by hand. Same posture as theirs, so no disadvantage yet, but it is the gate on any marketing site. |
| Launch in days for non-USSD flows | **Have.** A brand with a QR on a poster is live the same day. Their microsite is weeks and their app is months. |
| Published receipt-validation standards | **Do not have, and should.** See section 1. We have the better mechanism and say less about it than they do about a worse one. |
| Winner verification flow | **Not applicable.** We do not run draws. If we ever do, this becomes real. |
| Live brand dashboard, exports, integrations | **Mostly have.** Console with overview, performance, activity log and CSV exports for performance and code batches. No public API, no CRM or POS integration. |
| Entrant data transparency: what is held, export, delete | **Have, and it is a genuine lead.** Self-service export, leave-a-brand and erase, all without asking anybody, plus a privacy notice generated from the code. They describe deletion on request. |
| Broader language coverage, low-literacy flows | **Do not have.** English only. They claim three languages on one channel. |
| Published, defined metrics | **Have the basis.** Every number in the console is defined by the code that computes it. Nothing is published externally yet because there is nothing external yet. |
| Referral mechanics on the phone identity | **Do not have.** |
| Re-engagement of lapsed shoppers | **Deliberately constrained.** The consent copy promises no marketing on the strength of that agreement alone. Anything here needs the separate consent POPIA s69 requires, and the notice already says a brand must ask separately. |
| Audit-ready export per campaign | **Partly.** Append-only audit events and an immutable ledger exist; a single per-campaign regulator file does not. |
| Recorded, verifiable draw | **Not applicable** unless we run draws. |
| CPA and POPIA disclosure patterns | **In progress.** `docs/popia.md`, `docs/consent-copy.md` and `docs/legal-draft-for-review.md`. Ahead of where most products this size are, behind a lawyer's sign-off. |

---

## 3. Where we are already ahead, and should not copy

Worth naming so we do not trade any of it away chasing their sheet.

- **One shopper, one account, across every brand.** Their persistence story
  is "the WhatsApp number stays reachable". Ours is an account with a
  history. Review observations 1 and 2 are the biggest silence on their
  site and we already answer them.
- **The shopper can see, export and delete everything, themselves.** No
  email, no request, no waiting.
- **A brand sees no individual shopper at all**, by construction. That is a
  stronger privacy claim than anyone selling competitions can make, because
  their whole product is collecting entrant data for the brand.
- **An immutable ledger.** A balance is always the sum of its rows, so
  there is no stored total anybody can disagree with.
- **The product explains itself.** A guide, a setup sequence, and copy that
  describes what the system does rather than what we wish it did.
- **Ongoing rather than time-boxed.** Their 48-day optimum is an admission:
  a campaign ends and the relationship ends with it.

---

## 4. Where we are genuinely behind

In the order I would fix them.

1. **Photo capture of a slip.** Section 1. Removes the POS integration
   requirement, which is the largest single barrier to a brand saying yes.
2. **No feature-phone reach.** They sell USSD to LSM 7 and below as a
   headline. We have SMS join, which covers some of it, and no USSD. Worth
   a decision rather than a drift: USSD is a real channel in this market
   and we are currently absent from it.
3. **English only.** Mass-market reach in South Africa is
   language-dependent and we have not started.
4. **No self-serve signup.** Not costing us anything yet. It gates the
   marketing site, so it will.
5. **Redemption not open.** They have nothing comparable, but it is our own
   unfinished edge and CPA s35 has views about it. See `docs/terms-brief.md`.
6. **No referral mechanic.** They claim a 24% lift. Unaudited, but the
   mechanism is cheap and sits naturally on a phone identity.

---

## 5. Deliberate non-goals

Recording these so they stop coming up.

- **Competitions, draws, prizes, winner verification.** A different
  business with its own regulatory surface, CPA Regulation 11. If a brand
  wants a draw on top of Qumo codes, the terms need a competitions section
  first.
- **Agency services.** Prize sourcing, strategy retainers, press photos.
  They are a service company. We are a product.
- **Games and quizzes.** Nothing to do with proving a purchase.

---

## 6. Their open questions, answered from the code

The review's section 5, which the code already decides.

1. **Buyer is the brand.** Brands are billed; shoppers pay nothing, ever.
2. **Ongoing loyalty, not time-boxed promotions.** Promotions exist and can
   be ended, and a balance survives the end by the honour window.
3. **Identity verification: effectively nowhere, and deliberately.** We
   take a phone number and, where a brand sets a minimum, an unverified age
   answer. The code refuses to call that verification. No ID numbers, no
   documents. Their USSD page captures an ID number at loyalty enrolment;
   we would be taking on a great deal of POPIA exposure to match that and
   should not.
4. **Channels we do not support:** USSD, WhatsApp, app. We have web plus
   SMS. Items 2 and 3 above.
5. **WhatsApp is an add-on, not the entry point.** The entry point is a
   phone number and a web page, which works on any handset with a browser
   and does not put Meta between us and the shopper. Their own site lists
   template approval and the 24-hour window as constraints.
6. **Claims a brand's legal team will test:** fraud handling, audit trail,
   data separation and erasure. We can evidence all four today. Draw
   integrity we cannot, and do not need to until we run a draw.

---

## 7. Suggested order

1. Photo capture as a third proof tier, per-promotion, with the published
   standards that make it defensible.
2. The POPIA items already outstanding, which gate a pilot regardless of
   anything in this document.
3. A language decision, even if the answer is "English for the pilot".
4. Self-serve signup, when the marketing site needs it.
5. Referral, once there are shoppers to refer anybody.

USSD sits outside this list until somebody decides whether we are in that
market. It is the one gap here that is a strategy question rather than a
backlog item.

---

## 8. Market evidence for the pitch, checked against primary sources

Checked 9 November 2026. The rule for the deck is that a figure goes on a
slide only if it was read in its primary source. Coverage of a source does
not count.

### 8.1 The Truth & BrandMapp Loyalty Whitepaper 2025/6

**Source.** Truth and WhyFive Insights, *The Truth and BrandMapp 2025/6
Loyalty Whitepaper*, 10th edition, published Q1 2026.
<https://truth.co.za/wp-content/uploads/2026/03/Truth_BrandMapp_Whitepaper2025_6.pdf>
(38-page PDF of two-page spreads, created 17 March 2026, SHA-256 prefix
`7105d9d42b75fb72`). Page numbers below are the printed page numbers, not
the PDF page index.

**Who it measures.** BrandMapp surveys "over 30,000 South Africans", taken
to represent about 14 million people "whose household income is more than
R10,000 per month". The report calls this group *economically active*. A
separate WhyFive sample of 6,000 people below R10,000 a month is the *mass
market* (p. 3). Unless a figure says mass market, it means the economically
active group.

| Deck claim | Verdict | What the whitepaper says |
|---|---|---|
| **85%** participation | **Correct for 2025/6.** 82% is the previous edition's figure. | p. 9: *"The BrandMapp 2025 data reveals that a substantial 85% of economically active South Africans (with a household income of R10,000+ p.m.), actively participate in loyalty programmes. This represents a 3% points growth from the 82% reported in our 2024/5 loyalty whitepaper."* The author's note says the same on p. 7: *"usage grew from 82% in 2024 to 85%."* |
| **10.4** programmes per person | **Correct.** 10.3 does not appear anywhere in the document. | p. 13: *"The BrandMapp data reveals that the average number of loyalty programmes which South Africans actively use is 10.4 programmes."* Repeated on p. 7 (*"The average loyalty member is using 10.4 different programmes."*) and p. 19 (*"13 versus the average of 10.4"*). |
| **4.6** in 2015 | **Correct.** 3.6 does not appear anywhere in the document. | p. 12, headline graphic: *"+228% increase from 4.6 in 2015"*. |

Three cautions to keep on hand for when an investor checks:

- **The 85% is people, not households, and only the R10,000+ group.** The
  deck said "households", which is wrong, and that wording is now fixed.
  For the mass market the figure is 66% (p. 11: *"66% of BrandMass
  respondents stating that they use loyalty programmes"*), and 7.5
  programmes rather than 10.4 (p. 13). A brand selling to the mass market
  should be shown those two figures, not the headline ones.
- **Do not quote "+228%".** 10.4 is 2.26 times 4.6, which is a 126%
  increase. The whitepaper's own 85%-versus-67% chart on p. 14 calls a
  ratio of 1.27 a "27% difference", so the 228% does not match the
  whitepaper's own method either. The two endpoints are printed figures;
  the percentage between them is not reliable. Bizcommunity repeats the
  228% (below).
- **Where 10.3 and 3.6 came from is unresolved.** Bizcommunity's write-up
  of this edition, *"Whitepaper reveals 85% of South African consumers
  hooked on loyalty programmes"* (20 March 2026,
  <https://www.bizcommunity.com/article/whitepaper-reveals-85-of-south-african-consumers-hooked-on-loyalty-programmes-066405a>),
  gives "4.6 in 2015 to 10.4 in 2025" and "85% … up from 82%", which
  matches the whitepaper. I could not find the 10.3 and 3.6 versions in
  any primary source. They may belong to an earlier edition or come from
  an interview transcribed wrongly. The whitepaper is the primary source,
  and the deck follows it.

### 8.2 What the whitepaper says about redemption, breakage and expiry

**It gives no market-wide redemption rate, no breakage rate, and no
estimate of how much value South African points expire or go unspent.**
The word "breakage" does not appear in it. Nothing in it supports a claim
that South African loyalty value commonly goes unspent.

What it does contain falls into three kinds.

*Consumer attitudes (survey, economically active group):*

- p. 22: *"34% I hate it when points expire before I can use them"*, with
  the commentary *"Point expiry is a major pain point for loyalty
  programme members, potentially leading to dissatisfaction and
  disengagement."*
- p. 22: *"19% I mostly redeem points as soon as I can"*.
- p. 15: *"It is too hard to redeem points or rewards"* is a reason for
  not using loyalty programmes for 3% of both groups. p. 17 says this is
  down *"from 4% in 2024 to 3% in 2025"*.
- p. 17: *"Tiering, points expiry and redemption thresholds are some of
  the most common ways complexity is introduced (often unnecessarily) and
  demotivates consumers to engage."*

*Redemption figures reported by brands about themselves.* These are quoted
statements from the programmes, not Truth's research. Most of them point
to **high** redemption:

- eBucks (FNB), pp. 41 and 52–53: *"Ninety-five percent of eBucks earned
  are redeemed within the month of them being earned."*
- Sasol Rewards, p. 43: *"over R725 million in points earned and R580
  million redeemed - an impressive 80% redemption rate"*. The whitepaper
  attributes this to Sasol Limited's annual integrated reports. The
  programme launched in July 2024, so the R145 million gap is points that
  have not been redeemed *yet*. It is not breakage.
- UCount (Standard Bank), p. 53: *"97% of these members are actively
  redeeming their rewards."* That is a share of members, not of value.

*Nothing else.* Truth publishes no figure for expired value, unredeemed
liability, or breakage, for any sector.

**What this means for Qumo's two arguments.**

- *The sales argument* ("value earned and never spent") **has no source in
  this whitepaper and should not be presented as a market fact.** The
  brand figures above cut the other way for the big programmes. I did not
  find the phrase in `deck/build_pitch.py` or `deck/build_deck.py`, so no
  slide needs taking down. It should not be added until somebody finds a
  real source. A defensible version is narrower, and it is sourced:
  *a third of loyalty users say they hate points expiring before they can
  use them (Truth & BrandMapp 2025/6, p. 22), and a Qumo balance does not
  expire while a programme runs.*
- *The CPA section 35 argument* is about what the law requires, and it
  does not rest on a breakage statistic. The 34% figure shows that
  consumers care about expiry. It is not evidence about how much value is
  lost. The open legal questions are unchanged (`docs/terms-brief.md`,
  `docs/legal-draft-for-review.md`, `docs/popia.md` item 4).

### 8.3 SA SME loyalty vendors: pricing and proof of purchase

**Not verified. Nothing in this section may go in the deck.**

The brief was to read LoyaltyPro, Preepoints, SME Loyalty, Rewardfinity,
Bizzfo, Lekka and LoyaltyPass from each vendor's own pricing page. I could
not do that:

- **I could not identify the vendors' own websites.** Web searches for
  each name turned up no first-party site for LoyaltyPro, Preepoints, SME
  Loyalty, Rewardfinity or LoyaltyPass under those names. "Lekka" turns up
  only as **Lekka Card**, on Capterra. "Bizzfo" turns up only as a
  point-of-sale product (Bizzfo POS), with no loyalty pricing. I did not
  guess at domains.
- **This session's network allows only truth.co.za, bizcommunity.com,
  businesstech.co.za and iol.co.za**, so a vendor page would be refused
  even with a correct URL.

What search did return is listed below. It is an aggregator's summary,
which is exactly what the brief said not to rely on, and it is here only
so the next pass knows where to start:

| Vendor | Unverified lead | Where from |
|---|---|---|
| Lekka Card | "Starting price R249,00", free version and free trial; rewards "via QR codes, with no app downloads or hardware needed" | Capterra listing, <https://www.capterra.co.za/software/1102950/Lekka-Card> |
| Bizzfo | POS "Basic plan at $12 per month"; no loyalty product found | softwarereview.com / TrustRadius listings |
| LoyaltyPro, Preepoints, SME Loyalty, Rewardfinity, LoyaltyPass | Nothing found under these names | — |

So the coffee-shop cost table and the proof-of-purchase comparison are
still to do. **The suspicion that none of them prove a purchase is
unconfirmed, and it should not be stated to an investor yet.** To finish
it, I need:

1. The URL of each vendor's own pricing page, or its homepage.
2. Those hosts added to the session's network allowlist.

For each vendor the table should then record: monthly fee at the
smallest paid tier that fits one coffee shop with one till; setup or
hardware fees; per-customer or per-message charges such as SMS; and what
the product takes as evidence that a purchase happened (staff tap,
customer self-scan of a static QR, POS integration, receipt photo, or
nothing). Each entry needs a quotation from the page, the URL, and the
date it was read.
