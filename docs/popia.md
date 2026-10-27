# POPIA, and the decision the code already took

Qumo holds South African shoppers' mobile numbers and a record of what they
bought. That makes POPIA the law this product lives under, and there is one
question in it that changes the contract, the privacy notice and part of the
product.

This document used to open by saying nobody had answered that question. That
was wrong, in a way worth recording rather than quietly correcting. The
schema had answered most of it years before anyone asked, and the privacy
notice shown to shoppers had answered it the other way, in a single sentence
nobody had read as a legal position. A notice cannot abstain: it either tells
a person who to complain to or it leaves them guessing, and both are answers.
The notice has since been corrected to match the code, and this brief sets
out the argument for that position so an adviser can overturn it
deliberately rather than inherit it by accident.

This document is not legal advice and was not written by a lawyer. It is a
brief, so the question can be answered in one meeting rather than discovered
over several. Everything under "What the system does today" is a statement
of fact about the code, with the file that implements it, so an adviser can
check rather than take it on trust. The words a shopper is actually shown
are in `docs/consent-copy.md`, which is generated from the code, kept honest
by a test, and meant to be marked up and handed back.

---

## The decision

**Is Qumo the responsible party for shopper data, or the operator acting for
the brand?**

POPIA's responsible party decides why and how personal information is
processed. The operator processes it for somebody else, under their
instruction and a written contract.

**If the brand is the responsible party and Qumo is its operator**, then the
brand answers to the Information Regulator and to the shopper, Qumo answers
to the brand, and a shopper's complaint goes to the brand first. The privacy
notice is written in the brand's voice. Qumo needs an operator agreement with
every brand, and a security obligation under section 21.

**If Qumo is the responsible party**, Qumo answers to the Regulator directly,
publishes its own notice, and carries the obligations for every shopper on
the platform regardless of which brand they scanned.

**A third answer is possible and may be the real one: both, for different
purposes.** The brand decides the programme and the rewards. Qumo decides
how the platform retains, secures and deletes. Joint responsibility is more
work to document and is sometimes the honest description.

The deck used to assert the first answer in front of a client. It no longer
does. The privacy notice asserted it too, in front of shoppers, until it was
corrected - see below.

### What the code has already answered

Not as a matter of law, which is what the review is for, but as a matter of
fact about where the data sits and who can reach it. These constrain which
answers are available.

**The account layer is Qumo's.** `Person` carries the mobile number, the age
confirmation and the consent, and it has **no `brandId`**. `phoneHash` is
unique platform-wide, so one number is one row however many brands that
person uses. Consent is taken once, under one version, and honoured for
every brand the person later joins (`lib/consumer/otp.ts`); the age
confirmation behaves the same way and says so in a comment on the column
("age is a fact about the human"). No brand can see any of it: `decryptPhone()`
is called in exactly one place in the entire codebase, the shopper's own data
export (`lib/consumer/export.ts`). No console screen calls it at all.

A brand cannot be the responsible party for a record it has never seen,
cannot reach, and did not obtain the consent for. If each brand were
answerable for the number, each would need its own consent from each shopper,
and the product would have to ask again at every brand a person joined. It
does not. That is not an oversight to be fixed either, because asking a
shopper to re-consent at every brand would be a worse product and no better
protection.

**Each brand's programme layer is the brand's.** The brand decides what a
promotion offers, what a scan is worth, when it runs and when it stops. Those
records, and the memberships hanging off them, are visible to that brand and
to no other, enforced by `forBrand()` rather than by query discipline. Here
Qumo genuinely processes on somebody else's instruction, which is the
operator position.

So the honest description is the third answer listed above: both, for
different purposes. What has changed is that it is no longer a hypothesis
about how the product might be arranged. It is how it is built.

### What the notice used to say, and why it is now a finding

Until `web-v5` the privacy notice told shoppers:

> Qumo holds this information on behalf of the brands you interact with, and
> uses it to run the rewards programme.

"On behalf of" is operator language. Read against the facts above it was
wrong about the account layer, and wrong in the direction that costs a
shopper something: it pointed a complaint about a mobile number at the one
party that cannot see the number. The terms next door, meanwhile, already
described a two-party split and put the record on Qumo's side, so the two
documents a shopper agreed to in the same tick box disagreed about who they
were dealing with.

The notice now describes the split (`lib/consumer/consent.ts`, the point
headed "Who answers for what"), and a test fails if the "on behalf of"
wording returns (`tests/legal-copy.test.ts`). The correction re-consents
every shopper on their next sign-in, which today is nobody. That is the
whole reason it was made now.

### What it changes in the product

- The wording and voice of the consent copy and the privacy notice
  (`lib/consumer/consent.ts`). A second version will be needed for the
  WhatsApp channel when it is built, since it shows different words and
  must keep its own version rather than borrowing this one.
- Who a data subject request reaches first, and therefore whether the
  console needs a screen for a brand to action one.
- Whether the footer line "run on Qumo" is a courtesy or a legal necessity.
- What the brand agreement has to contain.

### When it has to be answered

**Before the first real shopper registers on a brand's programme.** Not
before a demo on numbers you own. Retrofitting consent onto people who have
already signed up means re-consenting them, and the version machinery will
force them through it on next sign-in, which is a worse first impression
than getting it right once.

---

## What the system does today

Facts, with the code that implements them.

| | |
|---|---|
| **Collected** | Mobile number, and the activity of the brands that number scans. Nothing else. `Person` has a `firstName` and a `suburb` column and **no code path writes either** - the only thing that sets them is the demo seed. This row previously claimed they were collected "if a brand asks", which overstated it: there is no screen or message anywhere that asks. |
| **Not collected** | No date of birth is ever stored. The age gate keeps the answer and the threshold it was checked against, never the date (`lib/consumer/age-check.ts`). A refusal stores a timestamp and nothing else. |
| **At rest** | The number is encrypted with `ENCRYPTION_KEY`. Lookups go through a separate HMAC under `PHONE_HASH_SECRET`, so the searchable value is not the number (`lib/security/crypto.ts`). |
| **Consent** | Captured at registration with a version. Rows keep the version they agreed under and nothing is rewritten, so an audit can answer what a given person actually saw. A shopper on an old version re-affirms at next sign-in (`lib/consumer/otp.ts`). |
| **Separation** | A brand sees only its own members. There is no cross-brand view and no combined list, enforced by a tenant guard rather than by query discipline (`forBrand()` in `lib/db/tenant.ts`). |
| **One account, not one per brand** | `Person` has no `brandId` and `phoneHash` is unique platform-wide, so a shopper has a single account across every brand they use. The brands cannot see it or each other. This is the fact the responsible party question turns on. |
| **The number never reaches a brand** | `decryptPhone()` has exactly one caller in the codebase: the shopper's own export. No console screen decrypts a shopper's number, so a brand identifies its members by a membership that belongs to it and never holds the number itself. |
| **Access** | A shopper downloads everything held about them as a JSON file, from their own wallet, without asking anybody (`lib/consumer/export.ts`). |
| **Erasure** | Erasure, not deletion. Everything that makes the row a person is destroyed and the lookup hash is overwritten with a value no number can hash to, so the record is unreachable rather than flagged. The ledger entry survives as a financial fact about the brand that is no longer about anyone (`lib/consumer/erase.ts`). |
| **Retention** | Sessions, spent passcodes and lapsed rate limits are swept nightly (`/api/cron/sweep-sessions`). Dormant shoppers are erased by a second nightly job (`lib/consumer/dormancy.ts`) which is **inert until a window is configured** - the mechanism is built, the number is a decision nobody has taken. See item 4. |
| **Erasure, completely** | Erasure now also destroys the passcode trail and the rate-limit counters keyed on the same phone hash. Until this was fixed it did not, and that mattered - see "Two defects found" below. |

---

## Two defects found while auditing the code against this brief

Both are fixed. Recorded here rather than only in a commit message, because
an adviser reading this needs to know what the guarantees were before, and
because the same reasoning will be asked about again.

### Erasure left the sign-in trail behind

`lib/consumer/erase.ts` is built on one enforcement: `Person.phoneHash` is
overwritten with a value no phone number can hash to, so every lookup in the
system fails to find the row without any of them having to check a flag.

Two other tables carried the same hash and were not touched. `PhoneOtp` held
one row per passcode ever requested, with `phoneHash` on it directly.
`RateLimit` held it inside its key (`otp:send:<phoneHash>`).

That is more than an untidy edge. `phoneHash` is a deterministic HMAC of the
real number, so anyone who could compute it - this service, or anyone holding
`PHONE_HASH_SECRET` and a number to test - could take an erased person's
number, hash it, and find rows proving that number used Qumo and on which
dates. The overwrite existed to make exactly that impossible.

The file's own argument for deleting session rows rather than revoking them
("the rows are a list of when this person used the service... precisely the
kind of record they have just asked us not to keep") applies to `PhoneOtp`
word for word. It was reasoned out for one table and missed for the other.

Erasure now deletes both, inside the same transaction and before the hash is
destroyed, since the hash is the only way to find them.

### Passcode rows were never deleted at all

`PhoneOtp` had no sweep of any kind. Every passcode ever sent was still on
disk: one row per sign-in attempt, each carrying the HMAC of a number and the
moment it was made, kept forever, answering a question nobody can ask - there
is no screen anywhere that shows a shopper their sign-in attempts.

Nothing reads a passcode row after its ten minutes are up. The two rate
limits run off their own table and their own fifteen-minute windows. The rows
are now swept after seven days, which is short on purpose: `ShopperSession`
is kept ninety days so a shopper who notices something weeks later can be
told when a device signed in and whether it was them, and these rows answer
nothing of the kind while being keyed on the number itself rather than on a
person.

### Nothing needs remediating

Both defects affected only data that exists. There are no real shoppers on
any brand's programme yet - the only numbers in any database are demo ones
owned by us - so there is no erasure request that was answered incompletely
and nobody to notify. If this had been found after a pilot, the first
question would have been whether an incomplete erasure is a section 22
matter, and the answer would not have been obvious.

---

## The other two regimes

POPIA is not the only one that applies.

**The Consumer Protection Act** governs promotional competitions. If a brand
runs a prize draw off a Qumo code, the CPA's rules on competition terms,
record keeping and prize fulfilment are the brand's, but the platform has to
make them possible: terms shown before entry, records kept, and the ability
to prove who won what. Qumo today issues value against a purchase, which is
not a competition, but the moment a draw is layered on top this applies.

**The WASPA code** governs mobile messaging. It applies to the SMS passcodes
today, and would apply far more heavily to a shortcode or USSD mechanic,
which has rules about displaying cost-to-enter on every piece of promotional
material. Qumo's SMS is transactional rather than marketing, which is a
lighter obligation, but it is not nothing.

---

## What is outstanding

1. **Confirm or overturn the split.** The code implements "both, for
   different purposes" and the notice now says so. What a lawyer has to
   settle is narrower than it was: whether that is the right
   characterisation in law; whether it can be put to a shopper in the words
   now used; and whether it makes Qumo a responsible party for the account
   layer with the registration and Information Officer duties that brings
   (item 5). If the answer is that the brand is responsible for all of it,
   the notice changes back and every brand needs its own consent captured
   at join, which is a product change and not only a wording one.
2. **Have the consent copy and privacy notice reviewed.** They were written
   in good faith to describe what the system actually does, and deliberately
   claim nothing it does not, but no lawyer has read them. `docs/consent-copy.md`
   is the artefact to send: every word a shopper can be shown, generated
   from the code, with the version each block is recorded under and the
   three questions worth looking at first. Mark it up and the changes go
   back into the constants.
3. **Draft the brand agreement**, including the operator clause if that is
   the answer, and the section 21 security obligation.
4. **Choose the dormancy window, and fix what it erases first.** The
   mechanism is built and tested; the number is not set, and while it is
   unset the sweep runs and does nothing. Anything under a year is refused
   by the code rather than clamped, because a mistyped value here destroys a
   customer base overnight. Three years is a common answer in South African
   practice and is a starting point for the conversation, not a
   recommendation from this document.

   **Setting the variable is not the whole task, and it is not safe to do
   on its own.** `sweepDormantShoppers()` protects a shopper who is holding
   an unexpired coupon, and says why: "a shopper sitting on an unexpired
   coupon has something of value here, dormant or not". It does not protect
   a shopper holding an unspent **balance**. The ledger exclusion asks
   whether there is a transaction *since the cutoff*, which is recent
   activity, not whether the balance is positive. So a shopper who earned
   value four years ago, never came back, and holds no coupon is erased
   along with the value, silently, by a nightly job. It is the same shape as
   the erasure defect this file came out of: reasoned through for one case
   and missed for the one next to it.

   It is inert today because the window is unset, which is the only reason
   this is a note rather than an incident. The moment somebody sets the
   variable it is live, and the variable looks like a one-line change.

   The fix is a decision rather than an obvious patch, because the two
   regimes pull in opposite directions. POPIA section 14 says personal
   information must not be kept longer than necessary, which is the entire
   argument for the sweep. CPA section 35 treats earned loyalty credits as
   the holder's, and section 63 keeps a prepaid credit or voucher alive for
   three years. "Keep balances forever" and "erase dormant accounts" cannot
   both hold, so somebody has to choose between protecting any positive
   balance indefinitely, expiring balances on a stated period and saying so
   in the terms, or de-identifying the account while preserving the value.
   Whichever is chosen, the terms currently promise the shopper that "your
   balance does not expire while the programme is running", which is true
   today and false the moment a window is set.
5. **Register with the Information Regulator** if the decision makes Qumo a
   responsible party, and appoint an Information Officer.
6. **Give a shopper a way to reach Qumo.** There is none. The only contact
   route anywhere in the shopper-facing product is the brand's own, in
   `app/(shopper)/qumo-footer.tsx`, and every route into Qumo runs through
   whichever brand the shopper happens to have scanned. That is tolerable
   while Qumo is purely an operator, because the brand is then the right
   first stop. It is not tolerable if the split above is confirmed: a
   responsible party has to be reachable by the people whose information it
   holds, has to name an Information Officer, and cannot route a complaint
   about its own handling through a third party who cannot see the record.
   The notice says plainly that no direct route exists rather than implying
   one, which is the right behaviour for today and a poor one to still be
   true at a pilot. Found by loading the page rather than by reading the
   code, which is the usual way.
7. **Write down what happens after a breach** (section 22). There is no
   documented process, and that is a policy gap rather than a code one - the
   system can already answer "whose data" from the memberships and the
   ledger. What is missing is who decides, how fast, and who signs the
   notification to the Regulator and to the affected people.

### One thing that looks outstanding and is not

**Correction, section 24.** A data subject can demand that inaccurate
personal information be corrected, and there is no "edit my details" screen.
There is nothing to put on one: the only personal information held is the
mobile number, which corrects itself - sign in on the right number and you
are on the right account - and the `firstName` and `suburb` columns are never
written by anything. If a brand ever asks for a name, this stops being true
and a correction path has to be built with it.

Items 1 and 2 gate the first pilot with real shoppers. The rest can follow.

They gate it because of an asymmetry rather than because of their size.
Correcting this copy today costs nothing: there are no real shoppers, so
nobody is re-consented and nothing is retrofitted. Correcting it after a
pilot means a re-consent screen in front of people who have already signed
up, and, if an incomplete answer was given to someone about who held their
number, a harder question than the wording one. Both items take calendar
time rather than build time, which is why they are worth starting before the
product feels finished.
