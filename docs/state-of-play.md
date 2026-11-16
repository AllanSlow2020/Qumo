# Where things stand

**16 November 2026.** Written on 10 November, brought up to date after the
security sprint of the 10th and a change of model on the 16th.

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
| **Build** | the product, the repository, deployments | PRs 26 to 42. All merged except 42, which is open |
| **Deck and research** | the pitch deck, market research, sourcing | PR 31, merged 10 November |

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


### What landed on 10 November, after a security review

Six pull requests, 37 to 42. The review read the code; it did not exercise a
running system, and those find different things. Say that plainly to anyone
who asks, and do not call the product secure, hardened or penetration
tested, because it is none of those.

- **Dependencies.** Next 16.3.1 to 16.4.6, zod 4.4.3 to 4.6.7. Production
  advisories went from 38 including 5 critical to 22 including none. The 8
  highs that remain are all in the Prisma CLI and PostCSS build tooling,
  which the deployed app does not load.
- **A gate so the next one fails a branch.** `scripts/audit.mjs`, run as its
  own CI job by `pnpm audit:ci`. It fails on any high or critical in
  production dependencies, carries 8 written-down exceptions keyed on
  advisory ID rather than package, and reports an exception that has stopped
  matching so the list cannot rot. Dependabot runs weekly.
- **Inbound SMS authenticates on Twilio's request signature**
  (`lib/sms/twilio-signature.ts`). The signature covers the sender, so a
  forged `From` is refused. It used to be a shared secret accepted from the
  query string, which Twilio's request inspector and the platform logs both
  record, so it leaked by design. What a forged sender could do was read any
  balance, claim a pack code into somebody else's account, opt a number out,
  and answer YES to write a consent record for a number that never
  consented. That last one forges the evidence the whole lawful basis rests
  on, which is why this came first.
- **A second factor is required of OWNER and ADMIN** (`lib/staff/mfa-policy.ts`).
  Enforced in `requireStaff()` rather than in a layout, because layouts do
  not run for server actions and an attacker with a stolen password would
  simply post the actions directly. Deny by default, with an opt-out used
  only by the two screens that satisfy the requirement.
- **An owner can reset a colleague's second factor** and never their own
  (`resetSecondFactorForSession` in `lib/staff/users.ts`). Refusing your own
  account is the rule the whole requirement hangs on: without it an owner
  resets themselves, enrols on a new device, and has done what turning it
  off refuses to allow.
- **Enrolment shows a QR code**, with the typed key kept beside it.

---

## 3. The live production state that is not in the code

Written down because it is environment, not repository, and a session cannot
see it.

- **`TWILIO_AUTH_TOKEN` is load-bearing now.** It is the only thing that
  validates the inbound signature; Twilio signs with the account auth token
  and there is no way to do it with an API key. It is read for a local HMAC
  and never transmitted. Sending still runs on the scoped API key, which
  takes precedence, so the old master-credential build warning stays away.
  Unset it and inbound SMS refuses every message.
- **`SMS_WEBHOOK_SECRET` is deleted** from Production, Preview and
  Development. The bearer fallback is unreachable for Twilio anyway, whose
  webhook settings have nowhere to put a header.
- **The `?token=` query string is gone** from the number's webhook URL in the
  Twilio console. Verified working after the change: a `BALANCE` text was
  answered.
- **Preview has no `TWILIO_AUTH_TOKEN`**, so preview builds print a preflight
  warning about the inbound webhook. Cosmetic. Warnings never fail a build,
  only `problems` do, even on Vercel.
- **Allan is enrolled in two-factor on production and is the only OWNER.**
  His recovery codes are therefore the only way back into an account that
  can no longer turn its own second factor off. A break-glass second owner
  was decided on and has not been created yet. The runbook: enrol first or
  the Team screen is unreachable, then invite with the role set to **Owner**,
  because an admin cannot reset anybody and would look like a recovery route
  without being one.
- **PR 42 is open and unmerged**, so the navigation bug below is still live.

### The navigation bug, which is live

Hiding the nav while a second factor is outstanding is right: every link
would bounce back to the enrolment screen. Giving it back afterwards was
missed, so the first person to enrol landed on an Overview with no way to
leave it. Nothing is broken and a reload fixes it. The fix is
`router.refresh()` in the security form, on the branch, in PR 42.

It was found by looking at a screenshot of a screen that every test passed.

---

## 4. Standing instructions that live only in conversation

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

## 5. Things a session would otherwise rediscover painfully

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
- **`docs/open-items.xlsx` is generated** by `scripts/open-items-xlsx.py`,
  which lived in a session scratchpad until 16 November and is now in the
  repository where it cannot be cleared. It conflicts on every merge because
  it is binary. Rebuild it rather than resolving it by hand, and run the
  recalculator afterwards; the script's own header has both commands.
- **A squash merge makes the branch look unmerged.** `main` has the content;
  the branch still has the commits by identity, so the next push is rejected
  as behind. Do not reach for a force push: the sandbox classifier refuses it
  as destructive, and rightly. Check that
  `git diff origin/main origin/<branch>` is empty, then merge the remote
  branch in. The merge produces a byte-identical tree, changes no files, and
  the push fast-forwards. This happened on every one of PRs 39 to 42, so the
  branch carries several such merge commits and the pull request's file count
  reads higher than the real diff.
- **Enrolment's own TOTP code cannot sign you in.** `confirmEnrolment`
  records the step it consumed, which is the replay guard working. A script
  that enrols and then logs in has to wait for the next 30 second window.
- **A screenshot script that touches the seeded data must put it back.** Two
  runs that failed partway left three orphaned staff accounts in the local
  database, and a later run then reported four reset controls where one was
  expected. Enrolling the seeded owner and leaving them enrolled locks local
  development out of the console entirely.
- **The console gate makes some screens unreachable for a screenshot.** An
  unenrolled owner is held at `/security`, so `/people` bounces. Minting a
  session with `createStaffSession` and setting the cookie is deterministic
  and avoids the TOTP dance; `scripts/shot-mfa-reset.ts` does it that way.

---

## 6. The documents, and which to read first

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

Scripts worth knowing about, because they check things the test suite cannot
see and nothing runs them automatically:

| Script | Checks |
|---|---|
| `scripts/audit.mjs` | high and critical advisories in production dependencies. Wired into CI as `pnpm audit:ci` |
| `scripts/check-nav-after-enrolment.ts` | the nav returns on enrolment, and the recovery codes survive the refresh |
| `scripts/check-dialog-portal.mjs` | dialogs and drawers render as modals with the console's tokens |
| `scripts/open-items-xlsx.py` | regenerates the tracked spreadsheet |

---

## 7. The open questions that are decisions, not work

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
6. **Whether an owner should be able to reset another owner's second
   factor at all.** They can, today, and it is what makes a lost phone
   survivable. The cost is that a compromised owner can strip a colleague's
   protection. Revisit it the first time a brand has staff in the console
   who are not Allan.
7. **Whether MARKETING should need a second factor.** It is out of the
   required set today and it is a close call, because that role can redeem a
   coupon, which is money. The line drawn was between who can change the
   rules and who acts within them. Worth revisiting at the volume where a
   marketing account is worth stealing. One entry in
   `ROLES_REQUIRING_SECOND_FACTOR`.

---

## 8. What is open, and what is only waiting on somebody

`docs/open-items.md` is the list, and the rule at the top of this file says
this one should not keep a second copy.

These are here anyway, and the reason is worth stating rather than hiding:
they came out of the security review on 10 November and have **not** been
added to `docs/open-items.md` yet. So this is the only record of them.
Moving them across, and regenerating the spreadsheet with
`scripts/open-items-xlsx.py`, is itself a small job somebody should do, at
which point this section should shrink to a pointer.

**Operational, none of it code:**

1. **Save the production recovery codes**, if that has not been done. Single
   owner, enrolled, cannot self-disable. This is the fragile one.
2. **Create the break-glass second owner.** Decided: an account Allan holds,
   with its authenticator on a device that is not his everyday phone, and its
   codes stored apart from his own.
3. **A restore drill on a paid Neon plan.** Six hours of point-in-time
   restore with the one manual snapshot already spent. This is the weakest
   link in the whole picture and it is not a code problem: a compromise found
   on a Monday morning may be older than six hours.
4. **Decide who reads the CSP reports and the fraud events.** Both are being
   written to and nobody looks at either. Detection nobody reads is not
   detection.
5. **Confirm the response headers are live.** The configuration is right and
   it has only ever been checked in source, because this sandbox cannot reach
   the production host. Thirty seconds in devtools on the console login page.
6. **A penetration test before a national brand signs.** It is also the thing
   that answers a procurement questionnaire.

**On the deck:** the R40,000 per managed promotion on slide 3, and the
R80,000 derived from it on slides 3 and 11, are still unsourced. A normal
build warns; `--strict` refuses. Agency quotes close it.
