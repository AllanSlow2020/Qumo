# What is still open

An index, not a replacement for the documents it points at. Grouped by
what blocks what, and marked by who can actually do each one.

**[A]** Allan. **[L]** needs a lawyer. **[C]** Claude can build it.

There is a spreadsheet of the same list beside this file,
`docs/open-items.xlsx`, with a status column, a target date and somewhere
to write notes. It is the one to track work in. This file stays the
narrative version, with the reasoning in prose, and it is the one to hand
to a lawyer.

Last updated 16 November 2026. On that date the security-review items that
had only ever been written in `docs/state-of-play.md` were moved in here, and
two entries about Twilio that the signature work had made wrong were
corrected: see "Settled: the Twilio number answers" and the entry about
`TWILIO_AUTH_TOKEN`.

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
- **Settled: an inbound SMS gets a reply.** `/api/sms/inbound` answered in
  plain text, which Twilio reads as an application error: it logs a schema
  warning and sends the shopper nothing, so the channel looked like it
  worked from our side and was silence from theirs. It answers in TwiML
  now. Switching it on is two settings in Twilio and one in Vercel, and
  `docs/deploying.md` has both.
- **Settled: the Twilio number answers.** The number's "A message comes
  in" webhook points at `/api/sms/inbound`, and the route authenticates
  each request by Twilio's `X-Twilio-Signature`. First proved on 9
  November by texting `BALANCE` from a real handset and getting a real
  answer back from production. That was under a shared secret in the
  webhook URL; the secret, `SMS_WEBHOOK_SECRET`, is now **deleted** from
  Production, Preview and Development, and the `?token=` query string is
  gone from the number's webhook URL. A `BALANCE` text was answered again
  after the change, so the signature path is the one proved working.
- **[A/C] Twilio answers `HELP` instead of us, and owns `STOP`.** Twilio
  handles a reserved set of keywords itself, before the webhook is
  called. Our table in `lib/sms/inbound.ts` overlaps that set in three
  rows, and the three have turned out differently.

  **JOIN is fine.** This was the row worth worrying about, because an
  affirmative reply is the consent record for an SMS joiner, so a
  swallowed `YES` would mean the join flow could not record consent at
  all. Tested on 9 November from a number that was already a member:
  `YES` reached `handleJoin` and got our reply, not Twilio's. Twilio
  appears to treat its opt-in keywords as meaningful only for a number
  that has previously opted out, which is the next item.

  **HELP never reaches us.** A shopper texting `HELP` gets "Reply STOP to
  unsubscribe. Msg&Data Rates May Apply" instead of our line telling them
  to reply YES to join and send a code to earn. Low harm, real cost: the
  one message whose entire job is to explain the service does not.

  **STOP is Twilio's, and that is mostly good.** Carrier-grade opt-out
  beats ours and should stay. What it costs is that `handleStop()` never
  runs, so our own record of who opted out is never written. The shopper
  stops receiving messages, and Qumo does not know they asked to.

  **The untested edge, and it is the one to think about.** A shopper who
  texts `STOP` is blocked at Twilio. If they later text `YES` to come
  back, Twilio is likely to consume that `YES` as its own opt-in keyword,
  unblock them, and never call the webhook. They would be reachable again
  and still not rejoined at Qumo, and nothing would say so. Testing this
  means opting a real handset out and back in, which is reversible but
  blocks that number in the meantime.

  The fix for all three is on Twilio's side rather than ours: attaching
  the number to a Messaging Service allows the built-in keyword handling
  to be configured. Renaming our keywords instead would mean telling
  shoppers to reply with something other than YES, which is worse.
- **Settled: `help@qumo.co.za` delivers.** The domain had no MX record at
  all until 9 November, which is why the first tests neither arrived nor
  bounced quickly. Two MX records now point at ImprovMX, forwarding
  `help@` and `access@` to a personal inbox, and both were confirmed by
  sending from an unrelated account and watching the messages arrive. The
  address was published before it worked, which is the sequence to avoid
  rather than repeat. See `docs/deploying.md`.
- **Settled: both domains are locked.** `qumo.co.za` was off and is now
  on; `qumo-app.com` was already on and was left alone. An unlocked domain
  is meaningfully easier to have transferred away by somebody who talks
  their way past a registrar, and these two carry a registered company's
  name, its marketing site, its product and its support address. Transfers
  out are possible from 14 November for `qumo.co.za` and 25 December for
  `qumo-app.com`; unlocking first is the deliberate extra step.
- **Settled: the dead `qumo.co.za` entries are off the Vercel project.**
  All three, `qumo.co.za`, `www.qumo.co.za` and `*.qumo.co.za`, had sat at
  Invalid Configuration since they were added, because the DNS points at
  Lovable and Vercel was never going to validate them. Every
  `qumo-app.com` entry was confirmed untouched and still Valid afterwards.
- **Settled: the demo brands named after real companies are gone.** Two
  of them, not one. The early demo data used real names and the habit was
  corrected later, so the invented ones (Copper Kettle, Amber Oak, Harbour
  Bakery) sat beside two that were not. Both are deleted from production,
  by id, after a snapshot. Each had nothing attached worth keeping: one
  had a single membership and no ledger rows, the other was empty on every
  count. Copper Kettle was untouched and `Person` was unchanged before and
  after, which is the architecture working, since `Person` carries no
  `brandId` and is shared across brands.

  The name is clear everywhere now: the repository, the git history, the
  branches, Vercel and the database. Those slugs resolve to nothing and
  serve the "this link needs a brand" page.

  **The lesson worth keeping is the one about demo data.** A realistic
  demo name is a trade mark somebody else owns, and the slug is what
  carries the risk, because `<slug>.qumo-app.com` resolves through the
  wildcard. Invent them.
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
- **[A] Whether an owner should be able to reset another owner's second
  factor at all.** They can today, and it is what makes a lost phone
  survivable. The cost is that a compromised owner can strip a colleague's
  protection. An owner can never reset their own, because that would
  unravel the requirement. Revisit it the first time a brand has staff in
  the console who are not Allan. See `docs/state-of-play.md`.
- **[A] Whether MARKETING should need a second factor.** It is out of the
  required set today and it is a close call, because that role can redeem a
  coupon, which is money. The line drawn was between who can change the
  rules and who acts within them. Worth revisiting at the volume where a
  marketing account is worth stealing. It is one entry in
  `ROLES_REQUIRING_SECOND_FACTOR`.

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

- **Settled: `DIRECT_DATABASE_URL` is set for Preview.** It was Production
  only, so `scripts/preflight.mjs` stopped every Preview build before it
  reached the migration it would have failed on. Proved fixed on 9
  November by the Preview build of pull request 28, which got past
  preflight: that check is a hard refusal, not a warning, so a build
  reaching Next at all is the evidence. Preflight also refuses a
  `DIRECT_DATABASE_URL` that is itself pooled, because the first version
  of that check passed on one copied out of a provider dialog with the
  pooling toggle left on.
- **[A] Decide whether Preview should have its own database.** The build
  runs `prisma migrate deploy` on every deployment, Preview included. If
  Preview and Production share one `DATABASE_URL`, a Preview build of any
  branch carrying a migration applies that migration to the production
  database before anybody has reviewed the pull request. Nothing has been
  harmed by this yet, because no branch in flight carries one. A Neon
  branch database for Preview is the real answer and it is a bigger job
  than the item above, which is why they are separate: tick the variable
  to get the check green, then decide this on its own merits.
- **Settled: Twilio sends, on a scoped API key.** On 3 November a real
  passcode reached a real handset and a shopper signed in, the first time
  that has happened. `DEMO_LOGIN_PHONES` and `DEMO_LOGIN_CODE` are
  deleted. Production authenticates with the Standard key `qumo-live`, and
  the preflight's auth-token warning is gone from the build log, which is
  the confirmation that the scoped key is the one in use. The fix was
  copying the key SID and its secret off a single Twilio creation screen
  in one action. See `docs/deploying.md`.
- **Settled, and reversed: do not delete `TWILIO_AUTH_TOKEN`.** This item
  used to say to delete it. It no longer applies, and acting on the old
  wording would break inbound SMS. Twilio signs every inbound webhook with
  the account auth token, and an API key cannot validate that signature, so
  the token is the only thing that authenticates inbound SMS. It is read
  for a local HMAC and never transmitted. Sending still runs on the scoped
  key `qumo-live`, which takes precedence, so the master-credential warning
  in the build log stays away. Unset it and inbound SMS refuses every
  message. The cost accepted: the master credential for the whole account
  stays in the environment, where it can buy numbers, spend money and read
  every message ever sent, and it cannot be scoped or rotated on its own.
  Preview has no token, so preview builds print a harmless preflight
  warning.
- **[A] Delete the surplus Twilio API keys.** Six exist for one
  integration. Keep `qumo-live` and delete the rest. That surplus is most
  of why the afternoon of 3 November went the way it did.
- **[A] Vercel plan.** Hobby is licensed for non-commercial personal use
  only and Vercel reads that broadly. See `docs/deploying.md`.
- **[A] Neon region.** The database is in `us-east-2`. Relevant to the
  section 72 question above.
- **[A] `ERROR_WEBHOOK_URL` is unset**, so nothing is alerting anywhere.
  This stopped being theoretical on 3 November: every failed passcode
  wrote `sms send rejected` with Twilio's own error code from 16:18
  onwards, and nothing said so, which cost an afternoon.
- **[A] Attach a reward** to Copper Kettle's live `Rounds card` in
  production. It completes at 10 and names nothing, so shoppers would
  collect forever and be handed nothing.
- **[A] Save the production recovery codes**, if that has not been done.
  Allan is enrolled in two-factor on production and is the only OWNER, and
  an owner cannot turn their own second factor off, so the codes are the
  only way back into the account if the authenticator is lost. This is the
  fragile one: without them it cannot be fixed from the console, only from
  the database.
- **[A] Create the break-glass second owner.** Decided: an account Allan
  holds, with its authenticator on a device that is not his everyday phone,
  and its codes stored apart from his own. Enrol first, or the Team screen
  is unreachable; then invite with the role set to **Owner**. An admin
  cannot reset anybody, so an admin account would look like a recovery
  route without being one. See `docs/state-of-play.md`.
- **[A] A restore drill on a paid Neon plan.** Six hours of point-in-time
  restore, with the one manual snapshot already spent. This is the weakest
  link in the whole security picture and it is not a code problem: a
  compromise found on a Monday morning may be older than six hours.
- **[A] Decide who reads the CSP reports and the fraud events.** Both are
  being written to and nobody looks at either. Detection nobody reads is
  not detection. Related to the `ERROR_WEBHOOK_URL` item above: with it
  unset, nothing here alerts anyone either.
- **[A] Confirm the response headers are live.** The configuration is right
  and it has only ever been checked in source, because the sandbox cannot
  reach the production host. Thirty seconds in devtools on the console
  login page.
- **[A] A penetration test before a national brand signs.** It is also the
  thing that answers a procurement questionnaire.

## 6. Brand and acquisition

- **[A] Brand guide**, from `docs/brand-context.md`, in progress.
- **[A] The site**, from `docs/website-brief.md`, on `qumo.co.za`.
- **Settled:** site on `qumo.co.za`, product stays on `qumo-app.com`, the
  old apex redirects to the site. No migration, and standing the site up
  cannot affect anything running.
- **[A/C] The call to action** depends on the signup decision above.
  Until then it is "request access".
- **[A] Source the managed-promotion price on the deck.** The R40,000 per
  managed promotion on slide 3, and the R80,000 derived from it on slides 3
  and 11, are still unsourced. A normal deck build warns; `--strict`
  refuses, and `--strict` is the one to use for any copy that goes to a
  brand or an investor. Written quotes from two or three promotions
  agencies, or a real invoice with the names removed, close it, and they
  are being gathered from agency conversations. See `docs/sources.md`.

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
