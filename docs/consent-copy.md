# What a Qumo shopper agrees to

Every word a shopper is shown before they agree to anything, in the five
places they can be shown it. This is the document to mark up.

**Generated from the code, not written here.** The copy lives in
`lib/consumer/consent.ts` and `lib/consumer/terms.ts`; this file is
regenerated from them with `pnpm legal:copy`. Editing it directly is
lost work, and a test fails when the two disagree. Mark it up, hand it
back, and the changes are applied to the constants.

**Not written by a lawyer, and that is the point of sending it.** It was
written to describe what the system actually does and to claim nothing it
does not, which is a different standard from being legally sufficient. No
part of it has been reviewed.

## How a version works here

Each block below is recorded under a version. A shopper's row keeps the
version they agreed under and is never rewritten, so the question "what did
this person actually read" has an answer for every person on the platform.
Change any of these words in substance and the version is bumped, and every
existing shopper re-affirms on their next sign-in.

Today that costs nothing, because there are no real shoppers: the only
numbers in any database are ours. After a pilot, a correction to these
words is a re-consent screen in front of people who already signed up.
That asymmetry is the reason this is being reviewed now rather than when
the product feels finished.

## The three things worth a reviewer's attention first

1. **"Who answers for what", in the privacy notice.** It says Qumo
   answers for the shopper's account and each brand answers for its own
   programme. That is a split responsibility reading, and it was chosen to
   match what the code does rather than to take a legal position: the
   shopper's number, age confirmation and consent are held once for the
   whole platform and no brand can see them, while each brand's programme
   records are visible only to that brand. See `docs/popia.md` for the
   argument and for what follows from it. If the right answer is that the
   brand is the responsible party for all of it, this is the sentence that
   changes, and the contract changes with it.
2. **"Your choices", in the privacy notice.** It promises a download, a way
   to leave any brand, and deletion, all without asking anyone, and it says
   deletion leaves an anonymous record of a reward having been earned
   because that record is the brand's financial one. All three are built
   and work today. The question is whether describing it as deletion, when
   a row survives with nothing identifying on it, is the right word under
   section 24(1)(b).
3. **The SMS join message.** Two sentences and a reply of YES is the entire
   consent on that channel, for people who cannot open a web page. It is
   the weakest consent record here by some distance, and it is the one most
   likely to be relied on in a township market.

---

## 1. The tick box

Beside the checkbox on the registration screen, linking to both documents below.

*Recorded as `web-v5`.*

> I agree to Qumo storing my mobile number and my activity with the brands I scan, as described in the privacy notice and the terms.

## 2. Privacy notice

At /legal/privacy, linked from the tick box.

*Recorded as `web-v5`.*

### What we keep

Your mobile number, and a record of every scan, reward and redemption you make with brands on Qumo. Your number is stored encrypted, and is used to sign you in and to send you one-time codes. You have one account here however many brands you use, so the number is held once, by us, rather than once per brand.

### What brands can see

A brand can see your activity with that brand only: the scans you made, the rewards you earned and what you have spent with them. A brand cannot see your activity with any other brand, or that you use any other brand at all. It also never sees your mobile number. The brand's screens identify you by a membership that belongs to them, and the number stays with us.

### Who answers for what

Two parties, and the split is worth knowing if you ever want to take something up with somebody. Qumo answers for your account: your mobile number, your age confirmation, this agreement, and keeping all of it secure. Those are ours, they are held once for you across every brand, and no brand sees them. Each brand answers for its own programme: what it offers, what a scan is worth, and the record of what you earned with them. The brand is where you start for either kind of question, and anything that is ours they bring to us. A way to reach Qumo directly is not built yet, and this notice will say so until it is.

### Your balances

Points, stamps and wallet value are earned with one brand and can only be used with that brand. They are not money, cannot be transferred between brands, and cannot be exchanged for cash.

### Your choices

You can download a copy of everything we hold about you, leave any brand's programme, or delete your account, all from your own details page and without asking anyone. Deleting removes your number, your name and anything else that identifies you. The record that a reward was earned on a date stays with the brand, because it is their financial record and once your details are gone it is no longer about you.

### Marketing

We will send you the one-time codes you ask for. We will not send you marketing messages on the strength of this agreement alone. If a brand wants to market to you, you will be asked separately.

## 3. Terms

At /legal/terms, linked from the tick box.

*Recorded as `terms-v1`.*

### What this is

A rewards programme run by a brand you buy from. Qumo is the software it runs on. The brand decides what the programme pays, which promotions run, and when they end; Qumo counts it and keeps the record.

### Who you are dealing with

Two parties, and it is worth knowing which is which. The brand sold you the thing and runs the promotion. Qumo runs the programme it is counted in and keeps the record. So anything about a price, a product or a store is the brand's; anything about a balance, a scan that did not work, or a record that looks wrong is ours, and the brand can raise it with us on your behalf.

### What a balance is

Points, stamps and wallet value are a record of what you have earned with one brand. They are not money and not a deposit. They cannot be exchanged for cash, transferred to anyone else, or used with a different brand, and not because of a rule we could waive: but because value earned with one brand is held against that brand and nowhere else.

### How you earn

Scan a code that proves a purchase (a till slip, a pack, a sticker) and the brand's promotion decides what it is worth. Each slip and each code earns once, ever. A slip more than 30 days old is too old to scan. A promotion may cap what one person can earn in a day and what it will hand out in total, and those caps are applied at the moment of the scan.

### When a scan does not earn

A code we cannot verify earns nothing. That covers a slip whose signature does not check out, a code already used, a total that has been edited, and a scan for a promotion that is not running. Nothing is deducted from you when this happens. The scan simply does not count, and the screen says why.

### Using what you have earned

Redemption is not open yet. What you earn is recorded and held for you; the brand decides how you eventually use it and will tell you when that opens. Your balance does not expire while the programme is running. An individual reward, such as a coupon for a completed card, can carry its own expiry date, and where it does, that date is shown on the reward itself.

### If the brand ends the programme

Earning stops the day the brand ends it. Anything you have already earned stays yours to use for 60 days after that, and then the programme closes. Nothing is deleted. If the brand starts again, your balance is where you left it.

### Leaving

You can leave a brand's programme whenever you like, from your own details page, without asking anyone. Leaving stops you earning immediately. You can also ask for a copy of everything held about you, or ask for it to be deleted. The privacy notice covers how.

### Getting it wrong on purpose

Forging a slip, copying a code, or scanning purchases that are not yours is not a loophole in the programme, it is the thing the programme is built to detect. Where we find it, the brand can refuse the value and end that membership. Honest mistakes are not this, and we would rather hear about one than find it.

### Changes

A brand can change or end its own promotions at any time, and value you have already earned is not taken away when it does. If we change these terms in substance, the version below changes with them and you will be shown the new ones the next time you sign in.

### Where you stand

These terms are governed by South African law, and nothing in them takes away a right you have under the Consumer Protection Act or the Protection of Personal Information Act. If a clause here turns out to be unenforceable, the rest still stands.

## 4. SMS join message

Sent to an unrecognised number before any account exists for it. The reply YES is the whole of the agreement on this channel, so this is all the person will have read when they agree.

*Recorded as `sms-v3`.*

*187 characters, 2 SMS segments.*

> Qumo: reply YES to join. We keep your number and your scans with the brands you use, and each brand sees only its own. Reply TERMS for the full notice, or HELP for what else you can send.

## 5. SMS full notice

Sent when somebody replies TERMS. Built from the privacy notice above rather than written again, so the two cannot drift into saying different things.

*Recorded as `sms-v3`.*

*2275 characters, 15 SMS segments.*

> Qumo privacy notice. We hold your account. Each brand holds its own programme record.
>
> What we keep: Your mobile number, and a record of every scan, reward and redemption you make with brands on Qumo. Your number is stored encrypted, and is used to sign you in and to send you one-time codes. You have one account here however many brands you use, so the number is held once, by us, rather than once per brand.
>
> What brands can see: A brand can see your activity with that brand only: the scans you made, the rewards you earned and what you have spent with them. A brand cannot see your activity with any other brand, or that you use any other brand at all. It also never sees your mobile number. The brand's screens identify you by a membership that belongs to them, and the number stays with us.
>
> Who answers for what: Two parties, and the split is worth knowing if you ever want to take something up with somebody. Qumo answers for your account: your mobile number, your age confirmation, this agreement, and keeping all of it secure. Those are ours, they are held once for you across every brand, and no brand sees them. Each brand answers for its own programme: what it offers, what a scan is worth, and the record of what you earned with them. The brand is where you start for either kind of question, and anything that is ours they bring to us. A way to reach Qumo directly is not built yet, and this notice will say so until it is.
>
> Your balances: Points, stamps and wallet value are earned with one brand and can only be used with that brand. They are not money, cannot be transferred between brands, and cannot be exchanged for cash.
>
> Your choices: You can download a copy of everything we hold about you, leave any brand's programme, or delete your account, all from your own details page and without asking anyone. Deleting removes your number, your name and anything else that identifies you. The record that a reward was earned on a date stays with the brand, because it is their financial record and once your details are gone it is no longer about you.
>
> Marketing: We will send you the one-time codes you ask for. We will not send you marketing messages on the strength of this agreement alone. If a brand wants to market to you, you will be asked separately.
