# What to ask a lawyer, and in what order

One covering brief for the whole engagement, so it goes out as a single
instruction rather than four separate conversations. The detail lives in
the documents named under each workstream; this file says what the job is,
what is blocking what, and which facts the lawyer will ask for first.

Written 1 November 2026. Nothing in this file is legal advice.

---

## The company, in one block

The lawyer will ask for all of this in the first email, so it is here
rather than scattered.

| | |
|---|---|
| **Entity** | QUMO-APP (PTY) LTD, registration 2026/858757/07, South Africa |
| **Registration number source** | As published in the footer of `qumo.co.za`. Confirm against the CIPC certificate before anything is filed on it. |
| **Trading names in use** | Qumo |
| **Domains owned** | `qumo.co.za` (the acquisition site), `qumo-app.com` (the product) |
| **Customers** | None. No brand has signed, no shopper has joined outside demo data. |
| **Employees or contractors** | None. Nobody outside the founder has written any part of it. |
| **Where the product runs** | Vercel, with the database in Neon, `us-east-2`, United States |
| **Source code** | Private repository, no licence file, `"private": true`. All rights reserved by default. |

## The four workstreams

Two of them gate a pilot with real shoppers. Two do not, and are cheaper
to settle now than later.

### A. Shopper terms and privacy notice. **Gates a pilot**

The drafting job. Everything needed is already written.

- `docs/terms-brief.md` is the instruction: what the system actually does,
  what it collects, what it deliberately does not, and a clause-by-clause
  POPIA and CPA checklist.
- `docs/legal-draft-for-review.md` is a first draft to mark up, with its
  own queries flagged in place. It is hand-written, not generated, and is
  not wired into the product.
- `docs/consent-copy.md` is the copy the product shows **today**, generated
  from the code and kept in step by a test. It is what a shopper is
  currently agreeing to.

The highest-value questions in it, in order: whether CPA section 35 makes a
loyalty balance a medium of exchange the terms cannot disclaim, whether CPA
section 63's three-year life reaches earned credits, and whether POPIA
section 57 requires prior authorisation for one phone number identifying
one shopper across many brands.

### B. The responsible-party decision. **Gates a pilot**

Not drafting. A single structural answer that changes the product if it
goes the other way.

`docs/popia.md` argues that Qumo and each brand are **both** responsible
parties for different purposes, and the shopper notice now says so. If a
lawyer lands elsewhere, the notice changes and every brand needs its own
consent captured at the moment a shopper joins, which is a product change
rather than a wording one.

Dependent on the answer: appointing an Information Officer and registering
with the Information Regulator, and a written breach process under
section 22.

### C. The brand agreement

The contract between Qumo and each brand. **A full first draft now exists
at `docs/brand-agreement-draft.md`**, written from what the product
actually does and flagged throughout.

Three clauses in it are the review: **7**, which says plainly that a
reward code is issued and cannot be marked redeemed; **9**, which carries
the responsible-party split from B and must not be settled before B is;
and **13**, which has to match the cancellation behaviour exactly, because
the product will do that whatever the contract says.

### D. Company and intellectual property

Not blocking, and the cheapest of the four to settle. Four items.

**1. Trade mark.** Qumo is not registered as a trade mark anywhere. A CIPC
company registration and two domains are not trade mark rights: they stop
somebody registering the identical company name, not somebody trading as
Qumo.

Classes to discuss: 9 (software), 35 (advertising, business, loyalty
schemes) and 42 (software as a service).

**Search before filing, and before any further spend on the brand.** There
may be an existing Qumo in consumer electronics in other markets. That may
be irrelevant in these classes or it may not, and the cost of finding out
now is a search fee against the cost of a rebrand after a brand guide, a
website and a print run.

**2. Assignment of the IP to the company.** QUMO-APP (PTY) LTD and the
founder are different legal persons, and the work was done by the founder.
Copyright may therefore sit personally rather than with the company, which
is fine until a raise, a sale, or a disagreement, and then it is not. A
written assignment fixes it.

**3. Who owns AI-authored code.** Most of this repository was written by
Claude, an Anthropic model, directed by the founder: 97 of the commits are
attributed to it against 38 to a person. Anthropic's terms assign output
ownership to the customer. South Africa is also one of the few
jurisdictions whose Copyright Act addresses computer-generated works
directly, attributing authorship to the person who made the arrangements
necessary for the work's creation. If that reading holds it is an
unusually clean answer, which is exactly why it should be confirmed rather
than assumed. The same question applies to the marketing site, which was
built with Lovable: check their output-ownership terms.

**4. A short mutual NDA** to send before brand meetings. Worth having and
worth knowing it will sometimes be refused: large brands and their
agencies often will not sign one from a small supplier. The pitch deck is
written to survive travelling, and the defensible part of the product, the
engine, the ledger and the proof tiers, is not in it.

## What is not worth asking for

- **A patent.** Computer programs as such are excluded from patentability
  in South Africa, and the cost and time would buy very little here.
- **Protection for the idea.** "A unique code under a pack turns a purchase
  into loyalty" is not ownable. Copyright covers this implementation, not
  the concept, and nothing will stop a competitor building their own.

Worth being clear-eyed about where the protection actually comes from:
pre-revenue there is nothing worth cloning, and what will be hard to copy
later is signed brands, shoppers with balances, and a record of what a scan
is worth. The legal work here is about not losing what gets built, not
about stopping somebody starting.

## Suggested order

1. **A and B together**, in one conversation. They are the same body of
   facts and B changes A's answer.
2. **D at the same meeting.** Two of the four are drafted already, in
   `docs/nda-and-assignment-draft.md`, so they are a redline rather than a
   drafting job. The assignment is the one to do first: it costs almost
   nothing now and gets awkward the longer the company trades on work it
   may not own. The trade mark search in particular
   should start early, because a collision is cheaper to discover now.
3. **C once B is settled**, since the operator clause depends on it.

## What already exists to hand over

| | |
|---|---|
| `docs/terms-brief.md` | The drafting instruction, with the POPIA and CPA checklists |
| `docs/legal-draft-for-review.md` | A first draft to mark up, queries flagged in place |
| `docs/consent-copy.md` | What the product shows today, generated from the code |
| `docs/popia.md` | The responsible-party argument |
| `docs/brand-agreement-draft.md` | A full draft of the brand agreement, flagged throughout |
| `docs/nda-and-assignment-draft.md` | The IP assignment and the mutual NDA, both drafted |
| `docs/open-items.md` | Everything outstanding, including which items are waiting on this engagement |
