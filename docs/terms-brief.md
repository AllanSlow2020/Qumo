# Brief: write Qumo's shopper terms and privacy notice

For whoever writes the next version of the shopper-facing legal copy,
whether that is Claude in a fresh session, a lawyer, or Claude first and a
lawyer after. It is self-contained: you do not need the codebase to use it.

Hand it over with `docs/consent-copy.md` attached. That file is the current
copy, generated from the code, and it is what you are rewriting rather than
replacing from nothing.

---

## 0. Read this part first

**You are not giving legal advice, and neither did this brief.** The
statutory references below were checked against the Act text and secondary
sources in October 2026, and one was wrong on the first pass: loyalty
programmes are section 35 of the Consumer Protection Act, not section 34,
which covers trade coupons and expressly excludes loyalty programmes.
Assume there are more like that. Confirm every reference against the Act
before anyone relies on it.

**The hard rule: describe only what the system does.** Every clause must
correspond to behaviour listed in section 1. This is not a style
preference. The existing copy was written to this rule and it is the reason
it is worth reviewing at all: a notice that describes the system can be
checked against the system, and one that describes an aspiration cannot.

**Where the law requires something the system does not do, do not write the
clause.** Add it to the "Gaps found while writing" list at the end of your
output instead. A clause promising a capability that does not exist is
worse than a missing clause, because it will be quoted back by the one
person it failed.

**Mark everything you are unsure of.** Inline, as `[[QUERY: ...]]`. The
point of this document is to shorten a lawyer's review, and an honest list
of twelve queries does that better than confident prose that hides three.

**Placeholders.** Use `[[DOUBLE BRACKETS]]` for every fact you do not have,
and list them at the end. Do not invent a registration number, a registered
address, an Information Officer, an email address, or a commencement date.
Known placeholders needed: `[[REGISTERED COMPANY NAME]]`,
`[[COMPANY REGISTRATION NUMBER]]`, `[[REGISTERED ADDRESS]]`,
`[[INFORMATION OFFICER NAME]]`, `[[INFORMATION OFFICER EMAIL]]`,
`[[SHOPPER SUPPORT ADDRESS]]`.

**House style.** South African English. Short sentences. No em dashes
anywhere. Plain language is a legal requirement here, not a preference: CPA
section 22 requires it, so a clause a shopper cannot follow is a defective
clause. Write for somebody reading on a cheap Android phone in a queue. The
existing copy's register is the target: direct, second person, no
"hereinafter", no capitalised Defined Terms unless a definition genuinely
earns its keep.

**Do not claim compliance.** Never write that Qumo "complies with POPIA" or
"is POPIA compliant". Describe what is done and let a reviewer judge.

---

## 1. What the system actually does

These are facts about the running product. Do not write a clause that
contradicts any of them, and do not soften one because it is awkward.

### The parties and the model

Qumo is a platform. Brands run loyalty programmes on it. A shopper buys
something from a brand, scans a code that proves the purchase, and the
brand's promotion decides what that scan earns. Qumo counts it and keeps
the record. Each brand's programme lives at its own subdomain and is
branded as the brand's, with a "run on Qumo" line in the footer.

Qumo bills the brand. The shopper pays Qumo nothing, ever.

### The responsibility split, which is the central legal question

The product is built in two layers, and they have different answers.

**The account layer is Qumo's.** One shopper has one Qumo account no matter
how many brands they use. The mobile number, the age confirmation and the
consent record sit on a single person record with no brand attached to it.
Consent is taken once and honoured for every brand that person later joins.
No brand can see any of it. The number is decrypted in exactly one place in
the whole system: the shopper's own data export. No brand-facing screen can
decrypt it at all.

**Each brand's programme layer is the brand's.** The brand decides what its
promotions offer, what a scan is worth, when they run and when they stop.
Those records are visible to that brand and no other, enforced structurally
rather than by convention.

The current copy describes this as a split: Qumo answers for the account,
each brand answers for its own programme. Until recently it said Qumo held
everything "on behalf of the brands", which is operator language and was
wrong about the account layer. See `docs/popia.md` for the full argument.
**Treat the split as the working position and test it, not as settled.**

### What is collected

- The mobile number. Encrypted at rest. Looked up through a separate
  keyed hash, so the searchable value is not the number.
- A record of every scan, award and redemption, per brand.
- When the shopper agreed, and the version of the copy they agreed to.
- When age was confirmed, and the minimum it was checked against.

### What is deliberately not collected

- **No date of birth, ever.** The age step asks for one and the answer is
  thrown away. Only the outcome and the threshold are kept.
- A refusal on age stores a timestamp and nothing else.
- There are name and suburb columns and **no code writes to either**. Only
  the demo seed sets them. Do not write a clause about names.
- No email address, no physical address, no payment details. Qumo never
  takes money from a shopper.
- No special personal information in the POPIA sense: no race, health,
  religion, biometrics or criminal history.

### Earning, balances and redemption

- A scan earns once, ever. A duplicate earns nothing.
- A till slip more than 30 days old is too old to scan.
- Promotions can cap what one person earns per day and what the promotion
  hands out in total. Caps apply at the moment of the scan.
- An unverifiable code earns nothing and nothing is deducted. The screen
  says why.
- Balances are per brand. Points, stamps and wallet value earned with one
  brand work only with that brand.
- **Redemption is not open yet.** Value is recorded and held. The brand
  decides when and how it can be used. This is the single most legally
  sensitive fact in this list: see the CPA section 35 point below.
- An individual reward, such as a coupon for a completed card, can carry
  its own expiry date, and where it does the date is shown on the reward.
- If a brand ends its programme, earning stops that day and already-earned
  value stays usable for **60 days**, then the programme closes. Nothing is
  deleted. If the brand restarts, balances are where they were.

### Access, erasure and retention

- A shopper downloads everything held about them as a JSON file, from their
  own wallet, without asking anyone. This works today.
- A shopper can leave any brand's programme themselves. Works today.
- A shopper can delete their account themselves. Works today, but **it is
  erasure, not deletion**, and the distinction has to be described
  honestly. Everything identifying is destroyed and the lookup hash is
  overwritten with a value no real number can produce, so the record is
  unreachable rather than flagged. The ledger row survives as the brand's
  financial record of value it issued, with nothing on it that identifies
  anybody. Deleting the row outright would change a brand's liability for a
  quarter that has already closed.
- Sign-in session records are deleted 90 days after they expire, not 90
  days after they are created. Spent passcodes are swept after 7 days.
  Expired rate-limit counters are swept nightly.
- A dormant-shopper erasure job exists, is tested, and **is switched off**
  because no retention window has been chosen. The code refuses any window
  under a year rather than clamping it.

### Channels

- **Web.** Register, tick a box beside a line of copy, with the privacy
  notice and terms linked. Sign in by one-time code sent over SMS.
- **SMS.** An unrecognised number receives a two-sentence notice and joins
  by replying YES. Replying TERMS returns the full notice, currently 15
  message segments. This is the weakest consent record in the product and
  it is aimed at people who cannot open a web page.
- **WhatsApp** is planned and not built. It will need its own copy and its
  own version. Do not write it now.

### Age

Each brand can set a minimum age, or set none. **If a brand sets none, no
age question is ever asked.** Where one is set, the shopper types a date,
nothing verifies it, and a refusal can be retried after a cooldown. The
code does not call this verification and neither should you. What it is
worth is that the programme asked, recorded asking, and refused when told
no.

### Where the data physically sits

The database, the application hosting and the SMS delivery are all
third-party services hosted in the United States. This matters: see POPIA
section 72 below. Get the current provider list and regions from Allan
before writing the transborder clause.

### What does not exist

- **There is no way for a shopper to contact Qumo.** None. The only contact
  route anywhere in the shopper product is the brand's own support line.
  Every route into Qumo runs through whichever brand the shopper happened to
  scan. The current notice says this plainly rather than implying a channel.
- No Information Officer has been appointed or registered.
- No operator agreement with any brand exists yet.
- No breach-response process is written down.
- No redemption mechanism.

---

## 2. What to produce

Four things, in one response, clearly separated.

1. **The tick-box line.** One sentence. It is the only thing most people
   will read. Current version is about 30 words; do not exceed 40.
2. **The privacy notice.** Headed sections, each a short heading and a
   paragraph. Target 700 to 1,100 words. This is the POPIA document.
3. **The terms.** Same shape. Target 900 to 1,400 words. This is the
   contract and CPA document: what a balance is, how earning works, what
   happens when a programme ends.
4. **Two lists at the end**, outside the copy: `[[PLACEHOLDERS]]` to fill,
   and **gaps found while writing** (law requires it, product does not do
   it).

Keep the privacy notice and the terms separate documents. They answer
different questions and merging them produces one document nobody finishes.

Note on versioning, because it constrains your edits: each block is
recorded against a version string, a shopper's record keeps the version
they agreed under, and any change of substance bumps the version and
re-consents every existing shopper on next sign-in. Today that costs
nothing because there are no real shoppers. So **now is the moment to
change substance freely.** Say clearly which of your changes are
substantive.

---

## 3. POPIA checklist

Protection of Personal Information Act 4 of 2013. Work through all eight
conditions for lawful processing in Chapter 3. The notice must satisfy
section 18 in particular, which is the one that dictates content.

### Section 18: what a shopper must be told

This is the backbone of the privacy notice. Walk it item by item and make
sure each is answered somewhere, or flagged:

- what information is being collected, and from where if not from the
  shopper
- the name and address of the responsible party
- the purpose of the collection
- whether supplying it is voluntary or mandatory
- the consequences of not supplying it
- any law that authorises or requires the collection
- whether the information will be transferred to another country, and the
  level of protection there
- further information including the recipients, the right of access and
  correction, the right to object, and **the right to complain to the
  Information Regulator, with the Regulator's contact details**

That last item is worth calling out: the current notice does not mention
the Information Regulator at all. It almost certainly has to.

### The other conditions and provisions to cover

- **Section 11, justification.** Which ground is Qumo relying on? Consent
  is the obvious answer and is what the product captures, but necessity for
  performance of a contract may be the better ground for the parts a
  shopper cannot opt out of while still using the programme. Note that
  consent can be withdrawn at any time, and the product must still work
  coherently when it is. `[[QUERY]]` this; it changes the notice's framing.
- **Section 10, minimality and section 13, purpose.** Qumo is in good shape
  here and the notice should say so concretely rather than abstractly: no
  date of birth, no email, no address, no name in practice.
- **Section 14, retention.** Cover the 90-day sessions, the 7-day
  passcodes, and the fact that ledger rows persist in anonymised form after
  erasure. The dormant-account window is unchosen: flag it, do not invent a
  number.
- **Section 15, further processing.** Say whether anything is used for a
  purpose beyond running the programme. Today nothing is. If that ever
  changes, this clause is the one that has to change first.
- **Sections 19 and 21, security.** Describe the measures honestly:
  encryption at rest, keyed-hash lookup, structural separation between
  brands. Section 21 requires a **written contract** with any operator, so
  if brands are operators for any layer, the brand agreement carries this
  and the notice should reflect that the arrangement exists.
- **Section 22, breach notification.** The notice should tell a shopper
  they will be told. There is no process behind this yet, so either write
  the commitment and flag the gap loudly, or describe it in terms of what
  the law requires rather than what Qumo has built. Say which you did.
- **Sections 23, 24 and 25, data subject participation.** Access and
  deletion are built and self-service, which is better than most notices
  can claim. Correction is the interesting one: there is nothing to correct
  because the only identifier is the number itself, and signing in on the
  right number puts you on the right account. Say that plainly rather than
  describing a correction procedure that does not exist.
- **Sections 34 and 35, children.** `[[FLAG THIS LOUDLY]]` A brand that
  sets no minimum age is never asked an age question, so nothing prevents a
  child from joining that brand's programme. POPIA restricts processing a
  child's personal information. This is a product gap, not a drafting
  problem, and the notice cannot paper over it.
- **Section 69, direct marketing.** The current copy promises no marketing
  on the strength of this agreement, and that a brand wanting to market
  will ask separately. Keep that promise and make it precise. Note the
  existing-customer soft opt-in and the prescribed-form consent route for
  everyone else, and that every marketing message must carry the sender's
  identity and a way to say stop. The SMS one-time codes are transactional,
  not marketing, and the notice should distinguish them.
- **Section 72, transborder flows.** `[[FLAG THIS]]` The data sits on US
  services. Section 72 restricts sending personal information outside South
  Africa unless conditions are met, and section 18 requires telling the
  shopper. The current notice says nothing about this at all. It is one of
  the clearer omissions.
- **Sections 55 and 56, Information Officer.** If Qumo is a responsible
  party for the account layer, it needs an Information Officer, registered
  with the Regulator. Nobody is appointed. Flag it.
- **Sections 57 and 58, prior authorisation.** `[[QUERY, and a real one]]`
  Section 57(1)(a) requires the Regulator's prior authorisation to process
  unique identifiers for a purpose other than the one they were collected
  for, where the aim is to link that information with information held by
  other responsible parties. Qumo uses one mobile number as the identifier
  for one account spanning multiple brands, and each brand may be a
  responsible party for its own layer. The commentary's worked example for
  this section is a loyalty programme. Whether Qumo is inside section 57 is
  a question for a lawyer, and it is the question in this brief with the
  largest consequence if the answer is yes, because authorisation has to be
  obtained before the processing starts.

---

## 4. Consumer Protection Act checklist

Act 68 of 2008. More of this applies than people expect.

- **Section 35, customer loyalty programmes.** The governing section. Two
  points matter enormously:
  - Loyalty credits or awards are **a legal medium of exchange** when
    offered as payment for goods or services under the programme, "despite
    any provision in any law, agreement or notice to the contrary". So a
    term asserting that balances are not a medium of exchange may simply be
    overridden. "Not cash and not transferable" is a different and probably
    survivable claim. Draft carefully and flag it.
  - A person must not offer participation in a loyalty programme without
    the intention of providing the credit or award as offered. **Redemption
    is not open yet.** Qumo does intend to open it, but a programme issuing
    value with no live redemption path needs this clause written with real
    care, and needs `[[QUERY]]` on whether the current state is tenable at
    all for a pilot.
  - There is also a restriction on treating a consumer paying with loyalty
    credits differently from one paying cash, subject to a limited number
    of days a year. Check the section text.
- **Section 63, prepaid certificates, credits and vouchers.** `[[FLAG]]`
  A prepaid certificate, card, credit, voucher or similar device does not
  expire until the earlier of its full value being redeemed or **three
  years** from issue, unless a longer period is agreed. Qumo's terms give
  **60 days** after a brand ends its programme. Whether earned loyalty
  credits fall under section 63 or only under section 35 is a genuine
  question, and if section 63 reaches them the 60-day window is a problem.
  Do not resolve this yourself. Flag it as the highest-value question in
  the CPA part of the review.
- **Section 34, trade coupons.** Expressly does not apply to loyalty
  programmes regulated by section 35. Mentioned so you do not cite it by
  mistake, as this brief did on its first pass. Worth a `[[QUERY]]` on
  whether on-pack codes and stickers are reached by it independently.
- **Section 36, promotional competitions.** Not applicable today: Qumo
  issues value against a purchase, which is not a competition. The moment a
  brand layers a prize draw on a Qumo code it applies in full, with rules
  on terms, record keeping and prize fulfilment. Write nothing about
  competitions now. Note in the gaps list that the terms will need a
  competitions section before the first draw.
- **Section 22, plain and understandable language.** A legal requirement,
  and the reason the house style above is not optional.
- **Sections 48, 49 and 51, unfair terms and notice of risk.** Review your
  own draft against these, particularly anything that limits Qumo's
  liability, lets a brand change a promotion retrospectively, or allows
  value to be forfeited. Terms requiring special notice must actually be
  drawn to the shopper's attention, which is a design constraint and not
  just a drafting one. Say which clauses you think need prominence.

---

## 5. The other two regimes

- **WASPA code of conduct**, for mobile messaging. It applies to the SMS
  one-time codes today, which are transactional and therefore a lighter
  obligation than marketing, but not nothing. It would apply much more
  heavily to a shortcode or USSD mechanic, which carries rules about
  displaying cost-to-enter on promotional material. Relevant to the terms
  only insofar as the SMS channel is described.
- **Electronic Communications and Transactions Act 25 of 2002.** Check
  section 43 on information a supplier must provide on a website, and the
  provisions on electronic agreements and the point at which an agreement
  is concluded. The tick box and the SMS YES are both electronic
  agreements.

---

## 6. The questions to raise, not answer

Put these at the end of your output as an explicit list for the lawyer, in
roughly this order of consequence:

1. Is the account-versus-programme split the right characterisation, and
   does it make Qumo a responsible party for the account layer?
2. Does section 57(1)(a) prior authorisation apply to one mobile number
   identifying one account across multiple brands?
3. Does CPA section 63's three-year rule reach earned loyalty credits, and
   if so what happens to the 60-day post-closure window?
4. Is issuing value with redemption not yet open tenable under CPA section
   35, and what must the terms say about it?
5. Is consent the right POPIA section 11 ground, or is contractual
   necessity better for the parts a shopper cannot decline?
6. Is "deletion" the right word for erasure that leaves an anonymised
   financial record, under section 24?
7. What has to be said about US-hosted data under sections 18 and 72?
8. What is the minimum acceptable consent record on the SMS channel, where
   the whole agreement is two sentences and a reply of YES?
9. What is required before a child can join a programme whose brand sets no
   minimum age?
10. What retention period should the dormant-account erasure use, given
    that the sweep currently erases unspent balances along with the
    account? POPIA section 14 argues for a window; CPA sections 35 and 63
    argue for preserving earned value. See item 4 of `docs/popia.md`.

---

## 7. What success looks like

A reviewer should be able to read your output next to section 1 of this
brief and check every clause against a fact. Nothing should be
unverifiable, nothing should be aspirational, and every place the law
reaches past what the product does should be visible as a flag rather than
buried as a promise.

If you find yourself writing a sentence you cannot trace to section 1,
stop and flag it instead.
