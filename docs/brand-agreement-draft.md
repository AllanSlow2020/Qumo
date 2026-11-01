# Qumo and the brand: draft agreement for legal review

1 November 2026 · drafted for review, not for use

## Status

**A first draft for a lawyer to mark up, not an agreement to sign.** It is
not legal advice. Every clause here was written from what the product
actually does, checked against the code, so the commercial and technical
facts should be right. The legal form is the part that needs a lawyer.

How to read the flags:

- `[[QUERY: ...]]` is a point a lawyer must settle, or one the drafter is
  unsure of.
- `[[GAP: ...]]` is something the agreement promises or assumes that the
  product does not do yet. Flagged rather than drafted around.
- `[[DOUBLE BRACKETS]]` are facts still to be supplied. Nothing has been
  invented, and no figure appears that has not been decided.

**One clause is load-bearing and unusual, and a reviewer should go to it
first: clause 7, redemption.** The product issues rewards it cannot
currently record as redeemed. That is a real exposure for a brand and the
agreement has to say so rather than imply the opposite.

---

## 1. Parties

**Qumo:** QUMO-APP (PTY) LTD, registration 2026/858757/07, a private
company incorporated in South Africa. `[[QUERY: confirm the registration
number against the CIPC certificate. It is taken from the footer of
qumo.co.za.]]` `[[REGISTERED ADDRESS]]`

**The Brand:** `[[BRAND LEGAL NAME]]`, registration `[[NUMBER]]`,
`[[ADDRESS]]`.

## 2. What this agreement is for

Qumo operates a purchase-loyalty platform. The Brand runs a loyalty
programme on it under the Brand's own name. A shopper buys the Brand's
product, proves the purchase by scanning a unique code, and the Brand's
promotion decides what that scan earns.

The programme is the Brand's. The platform is Qumo's. Clause 9 sets out
which party answers for what, and that split is the central question of
this agreement.

## 3. What Qumo provides

Each item below exists today unless flagged.

1. **A console** at a Qumo address, where the Brand sets up promotions,
   generates codes, manages its stores and reads its own totals.
2. **Shopper-facing pages** on a subdomain of a Qumo domain, carrying the
   Brand's accent colour, typeface and name. Qumo appears once, in a
   footer line.
3. **Unique codes**, generated in batches, for printing under packs, on
   stickers or on till slips. **Every code earns once and only once,
   ever.**
4. **A ledger** recording what each shopper earned with the Brand. A
   balance is always the sum of its entries; no total is stored separately
   from the entries that produce it.
5. **Shopper identity**, held once across every brand on the platform: a
   mobile number, a one-time passcode sign-in, and an age confirmation.
6. **A performance view** of the Brand's own programme.
7. **A poster address and QR code** which explains whatever is live and
   takes a sign-up, and which deliberately awards nothing, so it is safe
   to print anywhere.

`[[QUERY: should service levels be stated at all at this stage? There is
no uptime commitment anywhere in the product or the infrastructure, and a
number invented here would be a promise nobody is measuring. The honest
options are to say nothing or to say expressly that no service level is
offered during a pilot.]]`

## 4. What the Brand provides

1. **Printing.** Codes onto packs, slips or stickers, at the Brand's cost
   and through the Brand's own vendor.
2. **The reward.** The Brand decides what a scan earns and what a
   completed card gives, and the Brand bears that cost.
3. **Store set-up.** Where the programme reads till slips, the Brand
   configures its stores and, where its point of sale can, installs the
   signing secret described in clause 6.
4. **A named contact** Qumo can reach with questions.
5. **Accurate information** about the Brand's own products, promotions
   and stores.

## 5. How a promotion works, and what bounds it

The Brand chooses, per promotion, one of:

- **a stamp card**, where every qualifying purchase earns one stamp and a
  full card earns a named reward;
- **a share of what the shopper spent**, which requires a till slip,
  because only a slip says what was spent;
- **a fixed amount every scan**, whatever was bought.

**Three ceilings bound what any promotion can cost the Brand**, all set by
the Brand in the console and all enforced at the moment of the scan rather
than reconciled afterwards:

1. the most one shopper may earn in a rolling day;
2. the most times one shopper may earn in a rolling day;
3. the most the promotion may ever issue in total.

A promotion with no total ceiling is unbounded, and the console says so on
the screen. `[[QUERY: should a total ceiling be contractually mandatory
rather than merely warned about? It is the only thing standing between a
store that cannot sign its slips and an open-ended liability.]]`

**Nothing earns until the Brand switches the promotion on.**

## 6. Proof of purchase, and its limits

The Brand chooses, per promotion, the weakest evidence it will accept.
This is a commercial trade and the agreement should record that the Brand
made it knowingly.

| What is accepted | What it guarantees | What it costs |
|---|---|---|
| A slip signed by the till | The total cannot be altered between the till and the scan | Every store needs a signing secret printed on its slips |
| Any slip carrying a Qumo code | Each slip earns once, and only if recent | A shopper who edits the total on their own receipt will be believed |
| A photograph of a slip | The same, as well as the reading of it allows | Built and switched off. Not available under this agreement unless expressly enabled |

Two defences apply whatever the Brand chooses, and both are enforced by
the database rather than by a check that can be skipped:

- the same slip can never earn twice;
- a slip more than **30 days** old is refused.

`[[QUERY: where a store cannot sign its slips, the amount-editing defence
is absent and the Brand's exposure is bounded only by the ceilings in
clause 5. Should the agreement require the Brand to acknowledge that in
writing per store, rather than once in general?]]`

## 7. Rewards and redemption, which is where this agreement is unusual

**Earning works. Redeeming does not, yet.**

A shopper earns, the ledger records it, and a completed stamp card issues
a unique reward code to that shopper. **Qumo cannot currently record that
a reward code has been used.** There is no till-side screen, no API and no
console action that marks one redeemed.

Two consequences the Brand must accept expressly:

1. **Honouring a reward is the Brand's own process**, carried out at the
   Brand's counters by the Brand's staff, outside the platform.
2. **The platform cannot prevent the same reward code being presented more
   than once.** A code shown on a phone can be screenshotted. Until Qumo
   builds redemption, nothing detects that.

`[[GAP: this is the largest unfinished edge in the product. Until it is
built, either the Brand accepts the exposure in writing, or the agreement
caps it, or rewards are limited to a form the Brand can control at its own
till. A lawyer should say which.]]`

`[[QUERY: and the related question of law. The Consumer Protection Act
section 35 governs loyalty programmes and section 63 gives a prepaid
credit or voucher a three-year life. Whether either reaches an earned
Qumo balance is the highest-value open question across all of this, and it
determines what this clause may lawfully say. See docs/terms-brief.md.]]`

## 8. Fees and term

`[[PRICING]]` Not set. Plans are named and priced by scan volume and by
how many channels are open, and the figures have not been fixed. See
`docs/pricing-tiers.md`.

The pilot is free, on one product line, for `[[PILOT LENGTH]]`.

Billing is not integrated: there is no payment provider, and invoicing and
collection happen outside the platform. `[[GAP]]`

## 9. Data protection, and who answers for what

**This clause is subject to the open question in `docs/popia.md` and should
not be settled before it is.**

The drafted position is that **both parties are responsible parties, for
different purposes**:

- **Qumo** answers for the shopper's account: the mobile number, the age
  confirmation, the agreement the shopper accepted, and the security of
  all of it. These are held once per shopper across every brand, and **no
  brand ever sees a shopper's mobile number.** The console has no screen
  that shows an individual shopper.
- **The Brand** answers for its own programme: what it offers, what a scan
  is worth, and the record of what was earned with it.

`[[QUERY: if a lawyer concludes instead that Qumo is the Brand's operator,
this clause becomes an operator agreement under POPIA section 21 and the
product changes: each brand would need its own consent captured when a
shopper joins. That is a product change, not a drafting one. Settle this
before the rest of the clause is written.]]`

Whichever way it lands, the agreement needs:

1. **Section 21 security obligations**, in writing, on whichever party is
   the operator.
2. **A breach process** under section 22: who decides, how fast, who signs
   the notification. `[[GAP: no process exists yet.]]`
3. **Transborder disclosure** under section 72. **The database is hosted
   in the United States** (`us-east-2`). `[[QUERY: what the agreement and
   the shopper notice each have to say about this.]]`
4. **Shopper rights.** A shopper can download everything held about them,
   leave a brand's programme, or delete their account, without asking
   either party. The Brand cannot override any of those.

`[[QUERY: POPIA section 57 and prior authorisation. One mobile number
identifies one shopper across many brands, which resembles the Regulator's
worked example of linking unique identifiers across responsible parties.
Authorisation, if needed, must precede the processing.]]`

## 10. Confidentiality

Mutual. Each party's non-public commercial information, and in Qumo's case
the platform's workings, stay confidential. `[[QUERY: standard carve-outs
and a term.]]`

## 11. Intellectual property

1. **Qumo owns the platform**, including the software, the console, the
   code-generation scheme and the ledger design. Nothing in this agreement
   transfers any of it.
2. **The Brand owns its brand**, and grants Qumo a licence to display the
   Brand's name, mark, colour and typeface on the shopper-facing pages of
   the Brand's own programme, for the term, for that purpose only.
3. **Programme data.** The record of what was earned with the Brand is the
   Brand's. The shopper's identity and cross-brand account are Qumo's.
   `[[QUERY: on exit, what the Brand may take with it. It cannot be given
   mobile numbers without breaking the guarantee in clause 9.]]`
4. **No competitions.** Qumo does not run competitions, prize draws or
   games, and the Brand may not operate one through Qumo codes without a
   separate agreement. That is a different regulatory surface.

## 12. Warranties, and what is not warranted

The platform is offered as it stands. Specifically, and these are facts
rather than boilerplate:

- **No uptime or availability commitment** is given. `[[QUERY: acceptable
  for a pilot, probably not for a paid year.]]`
- **Qumo does not verify a shopper's age.** The shopper is asked, the
  answer is recorded, and a shopper who says they are under the Brand's
  minimum is refused. Nothing checks the answer.
- **Qumo makes no representation that the programme complies with the
  Consumer Protection Act or POPIA.** That review has not happened. See
  clauses 7 and 9.
- **Where a store cannot sign its slips**, the amount-editing defence does
  not apply. See clause 6.

## 13. Term, cancellation, and what happens to shoppers

This is implemented and the agreement should match it exactly, because the
product will do this whatever the contract says.

| State | Earning | Redeeming |
|---|---|---|
| Trialing, or paying | Yes | Yes |
| Cancelled | **Frozen immediately**, from the moment of cancellation | Honoured for **60 days** |
| Closed, 60 days after cancellation | No | No |

Two properties worth stating in the agreement:

1. **Earning stops at cancellation, not at the end of the honour window.**
2. **The honour date is fixed when the cancellation is recorded.** If Qumo
   later changes the window, a promise already made to a shopper does not
   move.

`[[QUERY: what happens to an unspent balance when a programme closes. The
drafted answer is that it lapses after the 60-day window, and that is
exactly what Consumer Protection Act section 63 may not permit if an
earned balance is a prepaid credit. This is the same question as clause 7
and it has to be answered once, consistently, here and in the shopper
terms.]]`

`[[GAP: a brand with no billing record at all currently keeps earning and
redeeming. That is deliberate while brands are onboarded by hand, and it
reverses the day billing exists.]]`

## 14. Liability

`[[QUERY: entirely for a lawyer. The commercial facts a cap should be
built on are: the Brand's exposure is bounded by the ceilings in clause 5,
except for the redemption exposure in clause 7, which is not bounded by
anything in the platform.]]`

## 15. General

`[[QUERY: governing law and jurisdiction, dispute resolution, notices,
assignment, whole agreement, variation, severability.]]` South African law
is assumed throughout.

---

## Notes for the reviewer

Three things in this draft are unusual and deliberate.

**It states what the product cannot do.** Clause 7 on redemption, clause
12 on age, and the warranty that no compliance representation is made.
Each is true today, and an agreement that implied otherwise would be the
first thing to fail.

**It does not settle the POPIA question.** Clause 9 carries the drafted
position and flags that it is open. `docs/popia.md` has the argument in
full. If the answer changes, clause 9 and the product change together.

**The commercial facts are taken from the running system, not from
intent.** The 60-day window, the 30-day slip limit, the three ceilings,
one code one award, and the cancellation behaviour in clause 13 are all
implemented and tested. They will happen whether or not the contract
describes them.

Everything else in this document is a lawyer's to rewrite.
