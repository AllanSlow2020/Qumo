# What is still open

An index, not a replacement for the documents it points at. Grouped by
what blocks what, and marked by who can actually do each one.

**[A]** Allan. **[L]** needs a lawyer. **[C]** Claude can build it.

There is a spreadsheet of the same list beside this file,
`docs/open-items.xlsx`, with a status column, a target date and somewhere
to write notes. It is the one to track work in. This file stays the
narrative version, with the reasoning in prose, and it is the one to hand
to a lawyer.

Last updated 28 October 2026.

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
- **[C] Give a shopper a way to reach Qumo.** There is none. Every route
  runs through whichever brand they scanned. Tolerable for an operator,
  not for a responsible party.
- **[A/L] Write down the breach process** (section 22). Who decides, how
  fast, who signs the notification.
- **[L] Draft the brand agreement**, including the operator clause and the
  section 21 security obligation.

## 2. Legal questions already written down

All in `docs/terms-brief.md` with the section numbers. Worth settling in
the same conversation as the POPIA items rather than a second one.

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

- **[C] A coupon cannot be redeemed.** Separate from the item below and
  worse. A completed stamp card issues a real coupon and nothing anywhere
  can mark it used: `REDEEMED` is in `schema.prisma` and in no TypeScript
  file. `CouponFraudEvent.ALREADY_REDEEMED` therefore can never fire, so
  the same screenshot works at every counter. See
  `docs/seattle-coffee-review.md`.
- **[C] A stamp card cannot be earned from a till slip.** The slip path
  resolves campaigns through one filter, `type: "PERCENT_OF_SPEND"`, so
  the only way to get stamps out of a slip is a share-of-spend rule in
  stamps, which multiplies stamps by rands. At the form's own default that
  is 500 stamps on a R100 basket. A flat-per-slip rule fixes it and
  removes the reason anyone would configure the broken combination.
- **[C] Redemption.** `REDEMPTION_AVAILABLE` is false. The largest
  unfinished edge, and CPA section 35 has views about it.
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
