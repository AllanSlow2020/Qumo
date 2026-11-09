# What is still open

An index, not a replacement for the documents it points at. Grouped by
what blocks what, and marked by who can actually do each one.

**[A]** Allan. **[L]** needs a lawyer. **[C]** Claude can build it.

There is a spreadsheet of the same list beside this file,
`docs/open-items.xlsx`, with a status column, a target date and somewhere
to write notes. It is the one to track work in. This file stays the
narrative version, with the reasoning in prose, and it is the one to hand
to a lawyer.

Last updated 1 November 2026.

---

## 1. Gates a pilot with real shoppers

Nothing below this heading is optional before a real shopper signs up.
Everything here is calendar time rather than build time, which is why it
is first.

- **[L] Confirm or overturn the responsible-party split.** The code
  implements "both, for different purposes" and the shopper notice now
  says so. See `docs/popia.md`. If a lawyer lands elsewhere, the notice
  changes and every brand needs its own consent captured at join, which is
  a product change rather than a wording one.
- **[L] Get the shopper copy reviewed.** `docs/legal-draft-for-review.md`
  is written and ready to send, with the three points worth reading first
  and its queries marked. `docs/consent-copy.md` is the generated current
  copy beside it.
- **[A] Appoint an Information Officer and register** with the Information
  Regulator, if the split is confirmed.
- **Settled: a shopper can reach Qumo.** There is a contact page at
  `/legal/contact` saying which questions are the brand's and which are
  ours, the privacy notice and the terms both carry the address, and the
  footer links to it from every shopper screen. Both documents are now
  signed by QUMO-APP (PTY) LTD and its registration number rather than by
  a product name. The notice is `web-v6` and the terms are `terms-v2`, so
  anyone already signed in re-affirms at their next sign-in.
- **[A] Make `help@qumo.co.za` deliver** somewhere you actually read,
  before the first real shopper is shown it. It is published in the
  product now. An address that bounces is worse than the silence it
  replaced, and no test can catch it.
- **[A/L] Write down the breach process** (section 22). Who decides, how
  fast, who signs the notification.
- **[L] Review the brand agreement.** Drafted, not reviewed:
  `docs/brand-agreement-draft.md`. The operator clause and the section 21
  obligation are in it and depend on the split above.

## 2. Legal questions already written down

The shopper-facing ones are in `docs/terms-brief.md` with the section
numbers. The company and intellectual property ones are at the end of this
list. `docs/legal-engagement.md` is the covering brief for the lot: what
to ask, in what order, and the company facts a lawyer asks for first. One
instruction rather than four conversations.

- **[L] CPA section 35.** Loyalty credits are a legal medium of exchange
  "despite any provision in any law, agreement or notice to the contrary".
  The terms currently say balances are not. Also: issuing value while
  redemption is closed, against the prohibition on offering a programme
  without the intention of providing the award.
- **[L] CPA section 63.** A prepaid credit or voucher lives three years.
  Our terms give 60 days after a brand closes a programme. Whether section
  63 reaches earned credits is the highest-value question in the list.
- **[L] POPIA section 57.** Prior authorisation for linking unique
  identifiers across responsible parties. One phone number identifying one
  account across many brands is exactly the shape of the worked example,
  and authorisation has to come before the processing, not after.
- **[L] POPIA sections 18 and 72.** The database sits in the United
  States. The notice says nothing about it and probably has to.
- **[L/C] Children.** A brand that sets no minimum age is never asked one,
  so nothing stops a child joining. A product fix, not a drafting one.
- **[L] Taking payment online**, if self-serve signup happens: CPA on
  cancellation and refunds, ECTA on electronic transactions.
- **[A/L] Register Qumo as a trade mark.** There is none. A CIPC company
  registration and two domains stop somebody registering the identical
  company name; they do not stop somebody trading as Qumo. Classes 9, 35
  and 42. **Search before filing and before any further spend on the
  brand:** there may be an existing Qumo in consumer electronics
  elsewhere, and a collision is far cheaper to find now than after a brand
  guide, a site and a print run.
- **[A/L] Assign the IP to the company.** The work was done by the founder
  personally and QUMO-APP (PTY) LTD is a different legal person, so
  copyright may sit in the wrong place. Harmless until a raise, a sale or
  a disagreement. Drafted in `docs/nda-and-assignment-draft.md`.
- **[L] Who owns AI-authored code.** Most of this repository was written
  by Claude under direction: 97 commits to 38. Anthropic's terms assign
  output ownership to the customer, and South Africa is one of the few
  jurisdictions whose Copyright Act addresses computer-generated works
  directly. Probably a clean answer, which is why it is worth confirming
  rather than assuming. Same question for the Lovable-built site.
- **[L] A short mutual NDA** to send before brand meetings. Drafted in
  `docs/nda-and-assignment-draft.md`. Worth having, and worth knowing that
  large brands and their agencies often refuse to sign one from a small
  supplier.

## 3. Decisions only you can take

- **[A] Self-serve signup and payment.** Under consideration. The
  subscription state machine already exists; what is missing is taking
  money and issuing the invite automatically. See the note at the end of
  this file.
- **[A] The dormancy window.** `QUMO_DORMANT_ERASE_AFTER_DAYS` is unset.
  **Do not set it without reading item 4 of `docs/popia.md`:** the sweep
  would erase unspent balances along with the account, and POPIA section
  14 and CPA sections 35 and 63 pull in opposite directions on it.
- **[A] Pick a slip reader**, or decide not to yet. The photograph tier is
  built and disabled. `docs/photo-capture.md` has the four things to weigh,
  including the one that is easy to miss: a cloud reader makes that vendor
  a POPIA operator and, if offshore, a cross-border flow the notice has to
  disclose. A reader running in our own process avoids all of it.
- **[A] Brands whose door is the till.** A coffee chain identifies a
  shopper at the point of sale and hands the reward over at the same
  counter. Qumo has no till door and no point of sale integration, and
  both sit behind the two product gaps above. Worth costing only if brands
  of that shape are a target. See `docs/seattle-coffee-review.md`.
- **[A] USSD, or not.** The competitor sells it hard to feature-phone and
  data-off shoppers and we are simply absent from that market. A strategy
  question, not a backlog item. See `docs/competitive-position.md`.
- **[A] Language.** English only today. Mass-market reach here is
  language-dependent.

## 4. Product gaps

- **Settled: a coupon can be redeemed, once.** `lib/coupons/manage.ts`
  moves a coupon out of `ISSUED`, a console screen under Redeem takes the
  code at the counter, and the shopper's wallet now lists their codes so
  there is something to show. A conditional update on status settles two
  counters trying the same coupon in the same second, and every refusal
  writes a `CouponFraudEvent`, mistyped codes included. No migration was
  needed: every column was already in the schema. The remaining decision
  is a per-store staff role, so a barista's login cannot also change the
  earn rate. See `docs/seattle-coffee-review.md`.
- **Settled: a stamp card can be earned from a till slip.** The slip path
  used to resolve campaigns through one filter, `type: "PERCENT_OF_SPEND"`,
  so the only way to get stamps out of a slip was a share-of-spend rule in
  stamps, which multiplies stamps by rands: 500 stamps on a R100 basket at
  the form's own default. A flat rule has nothing to multiply, and
  `lib/campaigns/slip-earning.ts` now decides what a slip can satisfy for
  both the engine and the console. A coffee shop with a till and no printed
  pack codes can run "buy ten, get one free", which it could not before.
  Two promotions a slip could both satisfy are refused at activation, and
  an overlap that predates the rule is named on the Overview rather than
  resolved in silence.
- **[C] Spending a rand balance at a till.** `REDEMPTION_AVAILABLE` is
  still false, and this is now the only half of redemption that is shut:
  `confirmWalletSpend` has an engine and a test suite and no caller, because
  the two-phase flow assumes every till has a staffed Qumo login. That is a
  question for the first brand whose counters would run it rather than a
  guess made here. CPA section 35 has views about it.
- **[C] Correct-the-read.** Proposed and not built: let a shopper fix a
  misread slip in the moment, identity fields only, never the amount. It
  is what makes photo capture defensible without storing anybody's
  photograph.
- **[C] A reader implementation**, once one is chosen, plus the capture
  screen and published accuracy standards.
- **[C] Referral**, once there are shoppers to refer anybody.
- **[C] WhatsApp.** Planned, not built. Needs its own consent copy and
  version.
- **[C] SMS re-consent has no path.** A web shopper on an old consent
  version re-affirms at next sign-in. An SMS joiner has no next sign-in,
  so nobody who joined under `sms-v1` will ever be shown `sms-v2`. Costs
  nothing while no aggregator is connected. Named in
  `lib/consumer/consent.ts`.

## 5. Operations

- **[A] Tick `DIRECT_DATABASE_URL` for Preview** in Vercel. Production has
  it. Until then every Preview build fails and that failure means nothing.
- **[A] Twilio.** Once approved and a real number is live, confirm an SMS
  actually arrives, **then** clear `DEMO_LOGIN_PHONES` and
  `DEMO_LOGIN_CODE` in production.
- **[A] Vercel plan.** Hobby is licensed for non-commercial personal use
  only and Vercel reads that broadly. See `docs/deploying.md`.
- **[A] Neon region.** The database is in `us-east-2`. Relevant to the
  section 72 question above.
- **[A] `ERROR_WEBHOOK_URL` is unset**, so nothing is alerting anywhere.
- **[A] Attach a reward** to Copper Kettle's live `Rounds card` in
  production. It completes at 10 and names nothing, so shoppers would
  collect forever and be handed nothing.

## 6. Brand and acquisition

- **[A] Brand guide**, from `docs/brand-context.md`, in progress.
- **[A] The site**, from `docs/website-brief.md`, on `qumo.co.za`.
- **Settled:** site on `qumo.co.za`, product stays on `qumo-app.com`, the
  old apex redirects to the site. No migration, and standing the site up
  cannot affect anything running.
- **[A/C] The call to action** depends on the signup decision above.
  Until then it is "request access".

## 7. Housekeeping

Small, safe, and each one gets more awkward the longer it waits.

- **[C] Delete `?ui=stacked`** and the stacked branch with it, once the
  drawer has survived a real brand. Carrying two layouts is how one of
  them rots.
- **[C] Drop `PurchaseScan.wasSigned`** once nothing reads it. `proofTier`
  replaced it and both are written from one decision so they cannot
  disagree, but two columns meaning one thing is a trap for whoever reads
  them next.
- **[C] Rename the theme cookie.** Still `cios_theme`, from before the
  product was called Qumo.
- **[C] "5% back" is named for something it does not do.** It pays a flat
  R5 a scan. Demo data, but it is the first thing anybody sees.
- **[C] `couponExpiryDate` and `codePrefix`** have no console field, so
  they can only be set in the database.
- **[C] Add `QUMO_SLIP_READER` to `.env.example`** so the switch is
  discoverable before somebody needs it.

## 8. Parked

- **NFC tags.** Worth knowing before testing: a tag that opens
  `<brand>.qumo-app.com/s/<code>` works today with no code change, because
  a tag is just another way to carry a code. The catch is that **every
  code earns once, ever**, so a tag mounted permanently on a table or
  shelf would award once and then be dead. Permanent placements want the
  poster link, which deliberately awards nothing. Awarding NFC therefore
  means one tag per item, like an on-pack code, and the question is cost
  per tag rather than anything in the software.
- **Competitions and prize draws.** A different business with its own
  regulatory surface. If one is ever layered on Qumo codes, the terms need
  a competitions section first.
- **Marketing site for shoppers.** There isn't one and there shouldn't be;
  shoppers arrive from a poster or a pack.

---

## On self-serve signup, since it is being weighed

Three pieces of very different size:

1. **Subscription state** - done. Per-brand `TRIALING / ACTIVE /
   CANCELLED / CLOSED`, cancel, resume, period end, and a nightly job that
   closes elapsed programmes. Already load-bearing: it decides whether
   scans earn, and the 60-day honour window hangs off it.
2. **Taking money** - nothing exists. No provider wired at all. A
   provider, a webhook, a return URL.
3. **Issuing the invite** - the provision route and setup key are already
   an invite mechanism. What is missing is generating a one-time link
   rather than handing a key over by hand.

So it is less "build self-service signup" than "replace the human gate
with a payment gate", and what is on the other side stays an invite.
