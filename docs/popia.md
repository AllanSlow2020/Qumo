# POPIA, and the one decision nobody has taken

Qumo holds South African shoppers' mobile numbers and a record of what they
bought. That makes POPIA the law this product lives under, and there is one
question in it that changes the contract, the privacy notice and part of the
product, which has not been answered.

This document is not legal advice and was not written by a lawyer. It is a
brief, so the question can be answered in one meeting rather than discovered
over several. Everything under "What the system does today" is a statement
of fact about the code, with the file that implements it, so an adviser can
check rather than take it on trust.

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
does, because nobody has taken the decision.

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
| **Collected** | Mobile number, and the activity of the brands that number scans. A first name and suburb only if a brand asks for them. |
| **Not collected** | No date of birth is ever stored. The age gate keeps the answer and the threshold it was checked against, never the date (`lib/consumer/age-check.ts`). A refusal stores a timestamp and nothing else. |
| **At rest** | The number is encrypted with `ENCRYPTION_KEY`. Lookups go through a separate HMAC under `PHONE_HASH_SECRET`, so the searchable value is not the number (`lib/security/crypto.ts`). |
| **Consent** | Captured at registration with a version. Rows keep the version they agreed under and nothing is rewritten, so an audit can answer what a given person actually saw. A shopper on an old version re-affirms at next sign-in (`lib/consumer/otp.ts`). |
| **Separation** | A brand sees only its own members. There is no cross-brand view and no combined list, enforced by a tenant guard rather than by query discipline (`forBrand()` in `lib/db/tenant.ts`). |
| **Access** | A shopper downloads everything held about them as a JSON file, from their own wallet, without asking anybody (`lib/consumer/export.ts`). |
| **Erasure** | Erasure, not deletion. Everything that makes the row a person is destroyed and the lookup hash is overwritten with a value no number can hash to, so the record is unreachable rather than flagged. The ledger entry survives as a financial fact about the brand that is no longer about anyone (`lib/consumer/erase.ts`). |
| **Retention** | Sessions are swept nightly. There is no retention rule yet for a membership nobody has touched in years. **Open.** |

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

1. **Take the responsible party decision.** Everything else follows from it.
2. **Have the consent copy and privacy notice reviewed** against that
   decision. They were written in good faith to describe what the system
   actually does, and deliberately claim nothing it does not, but no lawyer
   has read them.
3. **Draft the brand agreement**, including the operator clause if that is
   the answer, and the section 21 security obligation.
4. **Decide a retention rule** for dormant memberships, and implement it in
   the nightly sweep.
5. **Register with the Information Regulator** if the decision makes Qumo a
   responsible party, and appoint an Information Officer.

Items 1 and 2 gate the first pilot with real shoppers. The rest can follow.
