# Qumo shopper legal copy: draft for legal review

Oct 27, 2026 · @Allan

## Status

**Hand-written, not generated.** `docs/consent-copy.md` next door is
rendered from the copy constants and kept in step by a test. This file is
not: it is a proposed rewrite that has not been applied to the code, so the
two will differ until it is. Do not wire it in while it still carries
placeholders.

Three factual corrections were applied after it was checked against the
code, and are marked in place: what a brand can see, the redemption record,
and the passcode sweep. Two of its queries were answerable from the code and
are answered inline rather than sent on. One answer turned up a defect and
is flagged under "Using what you have earned".

This is a first draft for a lawyer to mark up. It is not legal advice and not ready to publish. It is written from `consent-copy.md` and `terms-brief.md`, and every statutory reference needs checking against the Acts.

How to read the flags:

- [[QUERY: ...]] marks a point I am unsure of, or one the lawyer must settle.
- [[GAP: ...]] marks something the law requires that the product does not do yet. No clause was written for it.
- [[DOUBLE BRACKETS]] mark facts still to be supplied. Nothing has been invented.

A sentence is kept only if it traces to the system facts in the brief or to the current copy. Where it comes from the current copy alone, it is tagged.

## 1. Tick-box line

This is the one sentence most shoppers will read, 24 words long. The substance is unchanged and the wording is shorter.

> I agree to Qumo keeping my mobile number and my scans with the brands I use, as set out in the privacy notice and the terms.

~~[[QUERY: confirm a wording-only change does not need a version bump.]]~~
**Answered from the code: it does need one.** A version answers "what did
this person read", so the rendered string is what matters, not whether the
substance moved. The precedent is in the file's own history: `web-v1` to
`web-v2` was bumped for a rendered-string change that was expressly not a
change of substance. Moot for this draft, which changes substance anyway
(see section 6), but it governs future wording-only edits.

## 2. Privacy notice

This is the POPIA document. It is written to section 18 and describes only what the system does.

### Who we are

Qumo is run by [[REGISTERED COMPANY NAME]], registration number [[COMPANY REGISTRATION NUMBER]], of [[REGISTERED ADDRESS]]. Qumo is the software that brands use to run rewards programmes. We look after your Qumo account. Each brand looks after its own programme. See "Who answers for what" below. [[QUERY: does this make Qumo a responsible party for the account layer?]]

### What we keep

- Your mobile number. We store it encrypted. We find your account using a separate scrambled version of the number, so the searchable value is not your number.
- A record of every scan and every reward, for each brand, and of what you spend with a brand once redemption opens.
- When you agreed to this notice, and which version you agreed to.
- Where a brand sets a minimum age: when your age was checked, and the minimum it was checked against.

You must give us your mobile number to use Qumo. Without it we cannot make an account or send you a sign-in code. The scan records are created when you scan. [[QUERY: is a mandatory or voluntary statement needed per item, and is there a law that requires any of this? None known.]]

### What we do not keep

We never keep your date of birth. If a brand asks your age, you type a date, we check it against the brand's minimum, and the date is thrown away. If you are refused, we keep only the time of the refusal. We do not collect your email address, home address, payment details or any special personal information such as race, health or religion. We do not collect your name.

### Why we use it

We use your information to sign you in, count your scans, record what you earn, and run the programme. We do not use it for anything else. [[QUERY: s15 further processing. If this ever changes, this sentence changes first.]]

### Why we are allowed to

We rely on your consent, which you give when you tick the box or reply YES. You can withdraw it by leaving a brand or deleting your account. [[QUERY: s11. Is consent the right ground, or is contractual necessity better for the parts a shopper cannot decline? What happens to the programme when consent is withdrawn?]]

### What brands can see

A brand sees only your activity with that brand: your scans, your rewards and what you have spent. It cannot see your activity with any other brand, or that you use any other brand. It never sees your mobile number. It has no screen that shows you as a person at all: a brand sees the totals for its own programme, not a list of who is in it.

### Who answers for what

Qumo answers for your account: your mobile number, your age check, your consent, and keeping them secure. They are held once for you across every brand. Each brand answers for its own programme: what it offers, what a scan is worth, and the record of what you earned with it. For now, the brand is where you start with a question or complaint about either. Anything that is ours, they pass to us.

### Where your information is kept

Our database, our hosting and our SMS delivery are run by other companies, and they keep your information in the United States. [[HOSTING PROVIDERS AND REGIONS: get from Allan.]] [[QUERY: s72 and s18. What level of protection applies there, and which s72 condition do we rely on?]]

### How long we keep it

- Sign-in records are deleted 90 days after they expire.
- Sign-in codes are deleted 7 days after they expire, whether they were used or not.
- Your account and scan records are kept until you delete your account. [[DORMANCY WINDOW: a clean-up of long-unused accounts exists but is switched off. No period has been chosen, so none is stated.]]
- If you delete your account, the record that a reward was earned stays with the brand, with nothing on it that identifies you. See "Your choices".

### How we protect it

Your number is encrypted. Brands cannot see it. Each brand's records are kept apart from every other brand's by the way the system is built, not just by rules. We do not claim this is enough for every risk.

### If something goes wrong

The law requires us to tell the Information Regulator, and to tell you, if your information is accessed by someone who should not have it. We would use your mobile number to do this. [[GAP: no written breach process exists. I described the legal duty rather than promising a process. See gaps.]]

### Your choices

From your own details page, without asking anyone, you can:

- download everything we hold about you;
- leave any brand's programme;
- delete your account.

Deleting your account is erasure. We destroy your number and everything else that identifies you, and the account can never be found again. The brand keeps a record that a reward was earned on a date, because it is their financial record, and once your details are gone it is no longer about you. [[QUERY: s24. Is "delete" the right word for this?]]

Correcting your information. The only personal information we hold is your mobile number. If you sign in with the right number, you are on the right account, so there is nothing to correct.

Objecting. [[GAP: no objection route exists beyond leaving or deleting. Do not promise one.]]

### Marketing

We send you the one-time sign-in codes you ask for. These are not marketing. We will not send you marketing on the strength of this agreement. If a brand wants to market to you, it must ask you separately, and every marketing message must say who it is from and how to stop it. [[QUERY: s69. Soft opt-in for existing customers and the prescribed-form route for others.]]

### Complaints

Start with the brand you scanned. For anything about your account you can also write to us at [[SHOPPER SUPPORT ADDRESS]]. [[GAP: no such route exists today. Do not publish this line until it does.]] Our Information Officer is [[INFORMATION OFFICER NAME]], [[INFORMATION OFFICER EMAIL]]. [[GAP: none appointed or registered.]]

You may also complain to the Information Regulator at inforegulator.org.za. [[QUERY: confirm current contact details before adding an email or address.]]

### Changes

If we change this notice in substance, you will be shown the new one next time you sign in.

## 3. Terms

This is the contract and Consumer Protection Act document: what a balance is, how earning works and what happens when a programme ends.

### What this is

A rewards programme run by a brand you buy from. Qumo is the software it runs on. The brand decides what the programme pays, which promotions run and when they end. Qumo counts it and keeps the record. The programme costs you nothing. Qumo never takes money from you.

### Who you are dealing with

The brand sold you the product and runs the promotion. Anything about a price, a product or a store is the brand's. Qumo runs the programme and keeps the record. Anything about a balance, a scan that did not work, or a record that looks wrong is ours. The brand can raise it with us for you.

### Joining

You join on the web by ticking the box, or by SMS by replying YES. These are electronic agreements, and they take effect when you tick or reply. [[QUERY: ECTA concluding the agreement, and s43 supplier information.]]

Some brands set a minimum age. If one does, you type your date of birth. We do not verify it. If you are refused, you may try again after a waiting period. Some brands set no minimum age and ask nothing. [[GAP: children. See gaps.]]

If you join by SMS, replying TERMS sends the full privacy notice. [[QUERY: does replying YES cost the shopper anything, and what must the SMS say under WASPA?]]

### What a balance is

Points, stamps and wallet value are a record of what you have earned with one brand. They cannot be exchanged for cash, given to someone else, or used with another brand. [[QUERY: CPA s35. Credits can be a legal medium of exchange when offered as payment under the programme, despite any agreement to the contrary. The old "not money, not a deposit" wording is removed for this reason.]]

### How you earn

Scan a code that proves a purchase, such as a till slip, a pack or a sticker. The brand's promotion decides what it is worth. Each slip and each code earns once, ever. A slip more than 30 days old is too old to scan. A promotion can limit what one person earns in a day and what it gives out in total. Limits apply at the moment you scan.

### When a scan does not earn

A code we cannot verify earns nothing. This includes a slip that fails our checks, a code already used, a total that has been changed, and a scan for a promotion that is not running. Nothing is taken from you. The screen tells you why.

### Using what you have earned

Redemption is not open yet. What you earn is recorded and held for you. The brand decides when and how you can use it and will tell you when that opens. [[QUERY: CPA s35 requires the intention to provide the award as offered. Is issuing value before redemption opens tenable for a pilot?]]

Your balance does not expire while the programme is running. [[FLAG: true today and false the moment a dormancy window is configured. The nightly dormant-account sweep protects a shopper holding an unexpired coupon but not one holding an unspent balance, so arming it would erase earned value along with the account. No window is set, so nothing is lost today. See item 4 of docs/popia.md: POPIA s14 and CPA s35/s63 pull in opposite directions here and somebody has to choose. Do not publish this sentence without settling that.]] A single reward, such as a coupon for a full card, can have its own expiry date. If it does, the date is shown on the reward.

### If a brand ends its programme

Earning stops the day the brand ends it. What you have already earned stays usable for 60 days. Then the programme closes. Nothing is deleted. If the brand starts again, your balance is where you left it. [[FLAG: CPA s63. Credits and vouchers may not expire for three years. If s63 reaches earned loyalty credits, 60 days is a problem. Not resolved here.]]

### Leaving and deleting

You can leave a brand's programme whenever you like, from your own details page. Leaving stops you earning straight away. You can also download your information or delete your account. The privacy notice explains how.

### Cheating

Forging a slip, copying a code, or scanning purchases that are not yours is what the programme is built to catch. Where we find it, the brand can refuse the value and end your membership with it. An honest mistake is not cheating. [[QUERY: CPA s48, s49, s51. Forfeiture needs to be drawn to your attention.]]

### Changes

A brand can change or end its promotions at any time. Value you have already earned is not taken away when it does. [[QUERY: not in section 1. Kept from current copy. Review against s48 on retrospective change.]] If we change these terms in substance, you will be shown the new ones next time you sign in.

### Where you stand

These terms are governed by South African law. Nothing in them takes away a right you have under the Consumer Protection Act or the Protection of Personal Information Act. If one clause turns out to be unenforceable, the rest still stands.

### Clauses needing prominence in the interface (s49)

The 60-day closure window, the cheating and forfeiture clause, and "redemption is not open yet" should be visible before agreeing, not only on the linked page.

## 4. Placeholders to fill

Nine facts are still needed before anything is published. None has been invented.

- [[REGISTERED COMPANY NAME]]
- [[COMPANY REGISTRATION NUMBER]]
- [[REGISTERED ADDRESS]]
- [[INFORMATION OFFICER NAME]]
- [[INFORMATION OFFICER EMAIL]]
- [[SHOPPER SUPPORT ADDRESS]]
- [[HOSTING PROVIDERS AND REGIONS]]
- [[DORMANCY WINDOW]]
- A commencement date, which has not been added to the copy.

## 5. Gaps found while writing

Ten places where the law reaches past what the product does. No clause was written for any of them.

1. **Children.** A brand with no minimum age never asks one, so nothing stops a child joining. This needs a product fix, not a clause.
2. **No way to reach Qumo.** The complaints section cannot honestly name a route until one exists.
3. **No Information Officer** has been appointed or registered.
4. **No breach process** (s22). Nothing is written down on who decides, how fast, or who notifies.
5. **No objection route** for shoppers.
6. **No operator agreement** with any brand (s21).
7. **No redemption mechanism**, which is the CPA s35 exposure.
8. **Competitions.** If a brand adds a prize draw, the terms need a competitions section (CPA s36) first.
9. **SMS channel.** The join message and full notice need regenerating from this text. The consent record is still two sentences and a YES. WhatsApp will need its own copy and version.
10. **No dormancy period** has been chosen, so retention has no stated upper limit.

## 6. Substantive changes

These changes bump the version and re-consent every existing shopper on next sign-in. Today that costs nothing, because there are no real shoppers.

- Removed "not money and not a deposit" and the "not a rule we could waive" explanation (CPA s35).
- Added the US hosting statement (POPIA s18 and s72).
- Added the Information Regulator complaint line, the Information Officer line, the legal basis, the minimality statements, the retention periods, the breach duty and the marketing distinction.
- Added the minimum-age description and the electronic agreement clause.
- Expanded the correction point to say plainly that there is nothing to correct.

## 7. Questions for the lawyer

In order of consequence.

1. Is the account-versus-programme split the right characterisation, and does it make Qumo a responsible party for the account layer?
2. Does POPIA s57(1)(a) prior authorisation apply to one mobile number identifying one account across brands? It must be obtained before processing starts.
3. Does CPA s63's three-year rule reach earned loyalty credits, and what happens to the 60-day window if so?
4. Is issuing value before redemption opens tenable under CPA s35, and what must the terms say?
5. Is consent the right s11 ground, or is contractual necessity better for the parts a shopper cannot decline?
6. Is "delete" the right word for erasure that leaves an anonymised financial record, under s24?
7. What must be said about US-hosted data under s18 and s72?
8. What is the minimum acceptable consent record on the SMS channel?
9. What is needed before a child can join a programme whose brand sets no minimum age?
10. What retention period should the dormant-account erasure use?
