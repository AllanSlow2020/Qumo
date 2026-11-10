# Where things stand

**10 November 2026.**

A handover file, written because the work now runs in more than one chat and
a chat's memory does not leave the chat. The repository is the shared
memory. If something matters and it is only in a conversation, it is lost
the moment that conversation ends.

**The one rule for this file:** it says where things *stand*. It does not
say what is *left*, because `docs/open-items.md` already does and two lists
of open items is how they start disagreeing. When this file goes stale,
update it or delete it. A handover nobody trusts is worse than none.

---

## 1. The two chats

| Chat | Owns | Has pushed |
|---|---|---|
| **Build** | the product, the repository, deployments | PRs 26 to 32, all merged to `main` |
| **Deck and research** | the pitch deck, market research, sourcing | branch `claude/confident-cray-3eloht`, unmerged |

They share one repository, one `main`, and one Vercel project. Either can
push and either can merge. Neither can see the other's conversation.

They run on different environments, and the only difference is network
reach: the research one can open `truth.co.za`, `bizcommunity.com`,
`businesstech.co.za` and `iol.co.za`. Same repository, same permissions.
The build chat cannot reach the public internet, including the product's
own production URLs, so anything about the live site has to come from
somebody looking at it.

**Coordination.** Before starting work in either chat, `git fetch` and look
at what the other has in flight. Conflicts so far have been avoided by
accident rather than design: the build chat touches `app/`, `lib/`, `tests/`
and `docs/open-items.*`, the deck chat touches `deck/` and the
research documents.

---

## 2. What is built, and live

The loop closes end to end. A shopper gets a passcode by SMS, signs in with
no password and no app, scans a till slip or a pack code, collects a stamp,
finishes a card, finds the code in their wallet, and a staff member takes it
at the counter, once.

Live on `main` as of PR 32:

- **Earning** from a pack code or a till slip. A flat rule or a share of the
  basket. Each slip and each code earns once, ever.
- **Stamp cards**, earnable from a till slip, which they were not until 9
  November. The slip path used to resolve campaigns through one filter,
  `PERCENT_OF_SPEND`, so the only lever that produced stamps from a slip
  multiplied stamps by rands.
- **Redemption of a completed card's coupon.** `lib/coupons/manage.ts`, a
  console screen under Redeem, and the codes listed in the shopper's wallet.
  A coupon works once; the second attempt names who took it first.
- **A contact route to Qumo**, at `/legal/contact`, with `help@qumo.co.za`
  behind it. Confirmed delivering on 9 November.
- **Inbound SMS** answering in TwiML, with the number's webhook pointed at
  `/api/sms/inbound`.

What is **not** built: spending a rand balance at a till. `confirmWalletSpend`
has an engine and a test suite and no caller, because the two phase flow
assumes every till has a staffed Qumo login. That is a question for the first
brand whose counters would run it. See `lib/wallet/availability.ts`.

**Section 1 of `docs/open-items.md`**, headed "nothing below this heading is
optional before a real shopper signs up", has no buildable items left in it.
What remains there needs a lawyer, an Information Officer appointment, or a
decision.

---

## 3. Standing instructions that live only in conversation

These are not in any lint rule or test except the first, and a new session
will not infer them.

- **No em dashes.** Anywhere: code, comments, documents, decks, replies. En
  dashes in numeric ranges are fine. `tests/no-em-dashes.test.ts` enforces it
  for the repository; nothing enforces it for a chat reply.
- **Never put a production secret in a chat.** Allan types them straight into
  Vercel or Twilio. When writing a prompt for an agent that will operate one
  of those consoles, tell it explicitly not to report, transcribe or paste
  any credential.
- **Send screenshots before merging anything with a screen in it.** Render it
  and look at it. Verifying geometry is not verifying rendering.
- **Do not open a pull request unless asked.** Push the branch and say it is
  there.
- **Commit trailers:** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
  and the `Claude-Session:` line. No model identifier anywhere else in a
  commit, a pull request or a code comment.
- **A test that cannot fail proves nothing.** Several things in this project
  looked finished and were not: the inbound SMS route answered 200 with a
  body Twilio could not parse, and the published support address pointed at a
  domain with no MX record.

---

## 4. Things a session would otherwise rediscover painfully

- **Postgres dies.** Often, and mid-run. `pg_ctlcluster 16 main start`. A
  sweep of failures across most test files is almost always this and not the
  code.
- **The test suite runs one file at a time**, deliberately, since PR 30. It
  takes about 53 seconds instead of 24. The reasoning is in
  `vitest.config.ts` and it is not a performance bug to be fixed.
- **Use `/usr/bin/python3.13`** for anything touching openpyxl. `python3` is
  3.11 and pip installed to 3.13.
- **The console is at `app.localhost:3000`**, the shopper surface at
  `<brand>.localhost:3000`. Routing is by hostname in `proxy.ts`.
- **Seeded console login:** `owner@copper-kettle.example`, password in
  `prisma/seed.ts`.
- **Playwright** is preinstalled at `/opt/pw-browsers/chromium`. Launch with
  `--no-sandbox`. Scripts must live inside the repository to resolve the
  module.
- **The first `button[type=submit]` on a console page is the theme toggle.**
  Scope selectors to the form.
- **`docs/open-items.xlsx` is generated**, from a script in the session
  scratchpad, not from the repository. It conflicts on every merge because it
  is binary. Rebuild it rather than resolving it by hand, and if the
  generating script is gone, say so rather than editing the spreadsheet.

---

## 5. The documents, and which to read first

| Document | Answers |
|---|---|
| `docs/open-items.md` | what is left, grouped by what blocks what |
| `docs/open-items.xlsx` | the same list, with a status column to work in |
| `docs/deploying.md` | how it deploys, the Twilio setup, the domains, the email |
| `docs/popia.md` | the responsible party question, and why the answer is "both" |
| `docs/legal-draft-for-review.md` | the shopper copy, written for a lawyer to redline |
| `docs/brand-context.md` | the product, for a brand guide |
| `docs/competitive-position.md` | who else is doing this |
| `docs/sources.md` | every figure in the deck, with the page it came from |

---

## 6. The open questions that are decisions, not work

Listed here because a session that does not know them will either guess or
build the wrong thing.

1. **A per store staff role.** Redeeming is open to owner, admin and
   marketing, because a single site brand runs it from the console logins it
   already has. A barista at a franchise wants a login that takes a coupon
   and cannot change the earn rate. The first brand whose counters run this
   decides the shape.
2. **Spending a rand balance at a till.** Needs a brand to say whether their
   counters can run a confirmation screen.
3. **A slip reader**, and with it the photographed slip tier, which is built
   and switched off.
4. **Whether Preview should have its own database.** The build runs
   `prisma migrate deploy` on every deployment, Preview included.
5. **Twilio's reserved keywords.** `HELP` and the `STOP` family never reach
   our handler. `YES` does. The fix is a Messaging Service, not renaming our
   keywords.
