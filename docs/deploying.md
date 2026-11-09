# Putting Qumo on the internet

Everything below is one afternoon and, apart from a domain, no money. It
gets you two working addresses on real HTTPS:

```
copper-kettle.qumo-app.com    the shopper's site
app.qumo-app.com               the brand console
```

Read the two paragraphs under **Before you start** first. One of them is a
licensing fact rather than a technical one, and it is the sort of thing
worth knowing before rather than after.

---

## Before you start

**Vercel's free plan is technically enough.** The thing that looked like it
would force an upgrade - a wildcard domain, `*.qumo-app.com`, which is what
makes subdomain-per-brand work - is available on every Vercel plan,
including Hobby. The only condition is that the domain has to use Vercel's
own nameservers, because a wildcard certificate is issued by proving
control of DNS and Vercel can only do that if it holds the zone. Hobby caps
you at 50 domains per project, and one wildcard covers every brand you will
ever add.

The nightly cleanup jobs also fit, but only just: Hobby allows two cron
entries at once a day each, and `vercel.json` now carries exactly two -
`sweep-sessions` at 03:00 and `sweep-dormant` at 03:30. A third would need
a paid plan.

**Vercel's free plan is not licensed for this.** Hobby is
non-commercial-personal-use only, and Vercel defines commercial broadly -
any deployment used for the financial gain of anyone involved in producing
it. Showing Qumo to a prospective client in order to win their business is
commercial by that definition. Nobody will stop you deploying, and I am not
going to pretend the risk is dramatic; but it is their platform and their
rule, so you should choose it knowingly rather than find out later. Pro is
$20 a month and the switch is a button, not a migration. If you would
rather not pay and would rather not be offside, the alternatives are at the
bottom of this file.

The one thing you do have to pay for is a domain, and two are bought.
`qumo-app.com` is the one that matters: it is the root every brand
subdomain hangs off and the name that goes on the QR codes. `qumo.co.za`
was bought first, when `qumo.app` and every unhyphenated `.com` spelling
turned out to be taken, and it is now a redirect rather than the product.

Both were bought through **GoDaddy**, which holds the nameservers today.
**They have to move to Vercel**, for the reason in the paragraph above:
the wildcard certificate is issued by proving control of the zone, so
Vercel has to hold the zone. Pointing individual records at Vercel from
GoDaddy's DNS works for one named subdomain and does not work for `*`,
which is the record everything here rests on.

Moving nameservers is not moving the registration. The domain stays
bought at GoDaddy, stays renewable there, and can be pointed back at any
time.

As of today the apex and `www` still resolve to GoDaddy's own parked
page, and `app.qumo-app.com` and every brand subdomain resolve to nothing
at all. The domain half is done and the DNS half has not started.

The good news is that GoDaddy's DNS manager takes a `*` host, which is
the record this whole architecture rests on: **every brand is a
subdomain**, so one wildcard is what makes provisioning a brand a
database write rather than a DNS ticket. Nothing has to be moved.

There is also a free GoDaddy site sitting on the apex. It can stay or go
- the apex record below replaces it either way, because a hostname
answers from one place at a time. Qumo is what is being built here, so
the builder is not part of the deployment.

---

## 1. A database

[Neon](https://neon.tech) - free tier, real Postgres, commercial use fine.

1. Sign up and create a project.
2. Copy the **pooled** connection string. It has `-pooler` in the host.
   That is the one that survives serverless: every request may be a new
   process, and a direct connection per process exhausts Postgres's
   connection limit under any real traffic.
3. Keep it. It becomes `DATABASE_URL`.
4. Copy the **direct** string too - the same database on the host
   *without* `-pooler`. It becomes `DIRECT_DATABASE_URL`, and it is used by
   the Prisma CLI for migrations and by nothing else.

**Why two.** `prisma migrate deploy` takes a session-level advisory lock so
that two deploys landing together cannot apply the same migration twice. A
transaction pooler does not promise the next statement goes to the same
backend, so the session holding the lock and the session waiting on it can
be different connections, and the wait ends at the ten second timeout with
`P1002: the database server was reached but timed out`. Which backend the
pooler hands out decides it, so this passes several deploys and then fails
one for no visible reason. The application keeps the pooled URL, which is
what it wants; only the CLI needs the direct one. `scripts/preflight.mjs`
refuses to build with a pooled `DATABASE_URL` and no `DIRECT_DATABASE_URL`.

**On the region:** what matters is that the database and the app end up in
the same one, not which one. A page makes several queries, and each of them
crossing an ocean costs more than the whole render. The region is in the
connection string - the label between the endpoint id and `.aws.neon.tech`,
e.g. `us-east-2`. Vercel's default is `iad1` (Virginia, `us-east-1`), which
is close enough to any US Neon region to ignore. If you put Neon in Europe,
set Vercel → Settings → Functions → Region to `fra1` to match; Hobby allows
one region of your choosing. Europe is the better pair for South African
users, but a mismatched pair is worse than either.

## 2. The domain

### Or no domain at all, for a first look

You can skip this step entirely and still get a working shopper site.
Vercel gives every project a `<project-name>.vercel.app` hostname, and Qumo
reads the brand from the label to the left of the root domain - so name the
project after the brand's slug, set `NEXT_PUBLIC_QUMO_ROOT_DOMAIN` to
`vercel.app`, and `copper-kettle.vercel.app` resolves correctly.

One brand, and no console: the console lives at `app.{root}`, and
`app.vercel.app` is not yours to claim. Run the console locally against the
same database and show it on a laptop. For a first demo - shopper site on a
phone, console on a screen - that split is arguably the right one anyway.

### The real thing

Buy it wherever you like, then point it at Vercel's nameservers:

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

This is the step that has to happen before the wildcard will work, and DNS
takes anywhere from ten minutes to a few hours to propagate. Do it first
and let it settle while you do everything else.

## 3. The Vercel project

Import the repo from GitHub. Vercel detects Next.js and needs no build
configuration - `vercel.json` is already in the repo and carries both cron
schedules.

Both scheduled routes are authenticated by `CRON_SECRET`, and with it unset
they refuse every call. That is the safe direction, but it also means a
deployment that never sets it keeps every expired session row and every
passcode ever sent, for good. Set it.

Then add the environment variables, under Settings → Environment Variables.

**Generate every secret with the command in the table - do not invent one.**
A typed passphrase is the single most common way this goes wrong:
`ENCRYPTION_KEY` has to decode to exactly 32 bytes for AES-256, and anything
you make up by hand almost certainly will not. The preflight check catches
that one before it deploys; it cannot catch a weak `AUTH_SECRET`.

| Variable | Value | Type |
|---|---|---|
| `DATABASE_URL` | the pooled Neon string from step 1 | Config |
| `DIRECT_DATABASE_URL` | the same database, host without `-pooler`. Migrations only | Secret |
| `NEXT_PUBLIC_QUMO_ROOT_DOMAIN` | `qumo-app.com` - bare hostname, no `https://`, no path | Config |
| `PHONE_HASH_SECRET` | `openssl rand -base64 32` | Config |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` | Config |
| `AUTH_SECRET` | `openssl rand -base64 32` | Secret |
| `AUTH_TRUST_HOST` | `true` | Config |
| `CRON_SECRET` | `openssl rand -hex 32` | Secret |

### Tick every environment, not just Production

Vercel scopes each variable to Production, Preview and Development, and the
dialogue starts with Production alone. Preview is the branch deploy that
opens on every pull request, and it runs the same preflight: a variable set
only for Production makes every preview build fail while production carries
on fine, which reads as "the branch is broken" and is not.

`DIRECT_DATABASE_URL` is the one that catches people, because it was added
later than the rest - while fixing a production problem, with only the
Production box ticked. The build then stops with "DATABASE_URL is a pooled
connection and DIRECT_DATABASE_URL is not set", which is the preflight doing
its job on an environment nobody finished setting up.

Preview and Production can share a database here. If you would rather they
did not, give Preview its own Neon branch and set both URLs for it.

### The Type column matters more than it looks

Vercel offers **Secret** and **Config**. Secret is write-only: once saved,
nobody can ever read the value back - not the dashboard, not `vercel env
pull`, not you. That is the right choice for a value nothing outside Vercel
ever needs.

`ENCRYPTION_KEY` and `PHONE_HASH_SECRET` are not those values. Your laptop
needs them too, because seeding writes rows encrypted and hashed with them
and the live site has to read those rows back. Save them as Secret and you
will discover, at the moment you seed, that you cannot retrieve them - and
the only way out is to regenerate both and set them again on both sides.
Cheap on an empty database; not cheap once there is anything in it.

So: **Config for anything your laptop also needs, Secret for the rest.**
Nothing is really given away by that - anyone who can reach the Vercel
dashboard could already deploy code that prints these.

`NEXT_PUBLIC_QUMO_ROOT_DOMAIN` is compiled into the build rather than read
at runtime, because `proxy.ts` runs in the Edge runtime where there is no
runtime environment to read. Setting it after a build has no effect -
change it and deploy again.

Once they are set, this pulls the Config ones onto your laptop, so local and
production cannot drift:

```bash
pnpm dlx vercel login
pnpm dlx vercel link
pnpm dlx vercel env pull .env --environment=production
```

It writes `[SENSITIVE]` in place of anything saved as Secret, which is the
tell that a value was typed into the wrong box. It also writes a handful of
Vercel's own variables and sets `NEXT_PUBLIC_QUMO_ROOT_DOMAIN` to the
production domain, which will stop `copper-kettle.localhost:3000` working
- so keep this `.env` for pointing at production, and run `pnpm bootstrap`
to get a local one back.

Leave `ERROR_WEBHOOK_URL` empty for now. What that costs you is in **Where
the demo is thin** below.

`TWILIO_*` is no longer "later". The sender is a South African mobile
number, **+27 60 086 7513**, bought on the Qumo-App regulatory bundle, with
messaging and voice enabled on it. Set `TWILIO_FROM_NUMBER` to exactly that,
in full international form.

**It works, and it runs on a scoped API key.** On 3 November a real
passcode reached a real handset and a shopper signed in, which is the first
time that has happened. `DEMO_LOGIN_PHONES` and `DEMO_LOGIN_CODE` are
deleted.

It took three credentials to get there. Two API key pairs were refused,
once with `20003` and once with `70051`, and the account auth token worked
first time, which is what proved the fault was in the pair rather than in
the account, the number or the country. What finally worked was creating a
key and copying the SID and the secret off that one creation screen in a
single action. Twilio shows a secret once, so pairing one key's SID with a
different key's secret is the easy mistake to make, and it is almost
certainly what both refusals were. Production now authenticates with the
Standard key `qumo-live`, and `scripts/preflight.mjs` no longer prints its
auth-token warning: that warning's absence from a build log is how you
tell, without opening Vercel, which credential a deployment is using.

`TWILIO_AUTH_TOKEN` is still set in Vercel and is now dormant, because
`resolveTwilioCredentials` prefers the key pair when both halves are
present. Delete it anyway. There is no reason for the master credential for
the whole account to sit in an environment that does not read it.

### What a passcode has to get past

Three things, and only the first is in this repository.

1. **Credentials.** `TWILIO_ACCOUNT_SID` plus either an API key pair or
   the auth token, and never a half-set pair: `resolveTwilioCredentials`
   returns null rather than quietly downgrading, so the app falls silently
   back to the logging stub and nothing reaches Twilio at all.
2. **Geo Permissions**, under Messaging, Settings. South Africa has to be
   enabled. Invisible from inside the application: with it off a send is
   recorded as a success and no phone ever rings.
3. **Any restriction on the number itself.** Twilio tags a number when its
   regulatory bundle limits what it may do. This number carries "can
   send/receive sms to domestic numbers only", which is harmless here and
   means a foreign handset can never be used to test.

### How to diagnose the next one, which took a whole afternoon to learn

**The log line is `sms send rejected`**, written by `TwilioSmsClient` with
the HTTP status and Twilio's own numeric error code. Search production
runtime logs for it. The code names the cause; the status alone does not,
because a wrong credential, an unpermitted key and a disabled country all
arrive as a 401.

**If instead you find `sms (simulated) send`**, no Twilio call was made at
all: credentials did not resolve and the passcode was printed to the log
in plain text. Read it from there and sign in while you fix the cause.

**If you find neither**, the request never reached the app.

Two observed codes, and the honest state of what we know about them:
`20003` came with a mismatched key pair and went away when the pair was
replaced. `70051` came from a key that Twilio's console lists as
Standard, so the explanation that it means "Restricted key" is **not**
confirmed, and Twilio's error documentation was not reachable to check.
If it appears again, look it up rather than trusting this paragraph.

**Faster than any of it:** `ERROR_WEBHOOK_URL`. Both failures above were
written with `logger.error`, so a configured webhook would have put the
code in front of somebody within seconds instead of after an afternoon.

Receiving works, and it needs two things done in Twilio that nothing here
can do for you.

The route answers in TwiML now (`lib/sms/twiml.ts`), which is what Twilio
parses; it used to answer in plain text, which Twilio reads as an
application error, logs as a 12200 schema warning, and replies to with
nothing. The channel looked fine from our side and was silence from the
shopper's.

To switch it on: set `SMS_WEBHOOK_SECRET` to a long random string in
Vercel, then in the Twilio console open the number, find "A message comes
in", and set it to `https://app.qumo-app.com/api/sms/inbound?token=<that
same string>`, method POST. The token goes in the URL because the Twilio
console offers a URL field and no way to set a header.

Then text the number `HELP` from a phone. A reply means every part of it
is working. No reply, with a 200 in Twilio's debugger, means the token did
not match: the route answers 401 to an unknown token and 401 to no token
at all, and it answers 401 to everything while `SMS_WEBHOOK_SECRET` is
unset, which is the state every deployment starts in.

Not adopted, on purpose: Twilio can sign each webhook with
`X-Twilio-Signature`, which is stronger than a secret in the URL. It signs
with the account auth token, the credential production has just been moved
off, and making it load-bearing again to protect an endpoint already behind
a constant-time comparison is the wrong trade. Revisit if Twilio ever signs
with a scoped key.

The build runs `scripts/preflight.mjs` first and refuses to deploy if any of
the four secrets is missing, if `ENCRYPTION_KEY` is the wrong length, or if
the root domain is still a development value. All of those produce a site
that builds, deploys, and then does not work - which is exactly why they
are caught here rather than by you, later, in front of somebody.

## 4. The domains on the project

Two halves, and both are needed: Vercel has to be told the domains are
its, and GoDaddy has to hand it the zone.

### On Vercel

Settings → Domains, add three for the product root:

| Domain | Why |
|---|---|
| `*.qumo-app.com` | every brand, and the console. This is the one that matters. |
| `qumo-app.com` | the apex. Nothing is served here yet - it answers "this link needs a brand" - but leaving it unclaimed means a typo goes nowhere at all. |
| `app.qumo-app.com` | covered by the wildcard already; add it explicitly so the certificate is issued eagerly rather than on the first request. |

Add the wildcard first. It is the one with a plan and a nameserver
condition attached, so it is the one that tells you early whether the
rest of this is going to work.

### The second domain, and what actually happened to it

This section used to say that `qumo.co.za` should be added to Vercel and
redirected at `qumo-app.com`. That plan was overtaken: the marketing site
was built on Lovable and `qumo.co.za` now points at it. The two domains
are separate on purpose and neither redirects to the other.

| Domain | Serves | Hosted by |
|---|---|---|
| `qumo-app.com` and `*.qumo-app.com` | the product: every brand's shopper site, and the console at `app.` | Vercel |
| `qumo.co.za` and `www.qumo.co.za` | the marketing site | Lovable, at A record `185.158.133.1` |

**The three `qumo.co.za` entries in the Vercel project are leftovers of
the old plan and should be deleted.** They have sat at Invalid
Configuration since they were added, and now there is an explanation
rather than a mystery: the DNS points at Lovable, so Vercel was never
going to be able to validate them. They are not broken, they are
describing a decision that was reversed.

Nothing is lost by the reversal. The reason for wanting one root was that
two live roots serving the *same* thing split cookies and origins. These
two serve different things, and a shopper never sees `qumo.co.za` at all.

The caveat worth keeping: a pack printed with a `qumo.co.za` address
would carry a path, `/s/<code>`, that the marketing site knows nothing
about. Nothing is printed yet, and it stays theory as long as every print
run carries the product root.

### The shopper support address

`help@qumo.co.za` is published in the privacy notice, the terms and the
contact page, so the domain has to accept mail. It did not until 9
November: there was no MX record at all, which is why the first test
messages neither arrived nor bounced quickly. A sending server with no MX
to use falls back to the A record, tries port 25 against a web host, and
retries for hours before giving up.

Mail is now forwarded rather than hosted. Two MX records at GoDaddy point
at ImprovMX, which forwards `help@` and `access@` to a personal inbox.

| Type | Name | Value | Priority |
|---|---|---|---|
| MX | `@` | `mx1.improvmx.com` | 10 |
| MX | `@` | `mx2.improvmx.com` | 20 |

Forwarding rather than a mailbox is a deliberate first step, not a
shortcut. It costs nothing, it unblocks a pilot, and the address does not
change when it is upgraded, which matters more than it sounds: the
address is interpolated into versioned consent copy, so changing it bumps
the privacy notice and re-consents every signed-in shopper. Choosing it
once and keeping it is worth more than the mailbox it currently lacks.

What forwarding does not give you is the ability to *send* as the
address. A shopper making a formal request about their own information
would get a reply from a personal account. That is tolerable while there
are no shoppers and worth fixing when a brand signs: GoDaddy's
Professional Email on this domain is about R27 a month, and the existing
plan on another domain cannot be moved to it.

**There is no `v=spf1` record, deliberately.** SPF governs sending, and
nothing sends as `@qumo.co.za` today. Before one is added, check what the
`_lovable-email` TXT record and the `notify` NS delegation to
`lovable.cloud` are for: only one SPF record may exist, so if Lovable
also sends as this domain, both senders have to be described in the same
one or mail starts failing quietly.

### On GoDaddy

One change, and it is the nameservers rather than the records.

**Add the domain to the Vercel project before you touch the
nameservers.** Vercel's nameservers only answer for zones Vercel knows
about, so pointing a domain at them first does not give you a broken
website, it gives you no domain at all: every lookup fails, not just the
apex. Adding it first also surfaces any plan or configuration objection
while the domain is still resolving normally, which is the difference
between reading an error message and debugging a blackout.

**Copy the records you are keeping first.** Changing nameservers moves
the whole zone, so anything GoDaddy is currently answering stops being
answered by GoDaddy. Write down every `MX` and `TXT` record and recreate
them in Vercel afterwards. `MX` is email delivery and `TXT` is usually
SPF, DKIM or a verification token something else relies on. Nothing else
on a GoDaddy default zone is worth keeping: the parked `A` on `@`, the
`CNAME` on `www` and the `_domainconnect` helper are exactly what is
being replaced, and `NS` and `SOA` are replaced by the change itself.

On this domain, as checked, there is no `MX`, no SPF and no DKIM, so no
mail is live and nothing is at risk. The only record with content worth
carrying over is the DMARC policy on `_dmarc`.

**A trap for later, worth knowing now.** That DMARC record says
`p=quarantine`, and with no SPF and no DKIM alongside it, every message
claiming to come from this domain fails both checks. For a domain that
sends no mail this is the right posture - it is what stops somebody
spoofing your address. But the console sends staff password resets
(`SMTP_*` in `.env.example`), and the day those start going out from an
address at this domain they will be quarantined by receivers unless SPF
and DKIM go in at the same time. If that day comes before Workspace is
set up on the domain, send from an address on a domain that is already
configured, rather than loosening the policy here.

Then, in GoDaddy under Domain → Nameservers → Change → "I'll use my own
nameservers":

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

Vercel shows the pair it wants when you add the domain to the project.
If it differs from the above, Vercel is right and this document is out
of date.

Propagation is usually under an hour and can take up to 48. Vercel
issues the certificates itself once it sees the zone, including the
wildcard.

**If the wildcard is ever the record that will not go in, stop and say
so.** Adding brand subdomains one at a time is not a fallback - it would
mean no brand can be provisioned without somebody editing DNS, which
undoes the thing the provisioning screen exists for.

## 5. The schema, and something to look at

Migrations do not run on deploy, deliberately - a schema change should be a
thing you do, not a side effect of pushing. They run from your laptop,
against the production database.

**Put the connection details in `.env` rather than in front of each
command.** Repeating `DATABASE_URL="…"` four times is four chances to paste
the wrong thing, and every one of them fails in a different way. The `env
pull` above already wrote the file; check it has these three lines and no
`[SENSITIVE]`:

```
DATABASE_URL="postgresql://…-pooler.….neon.tech/neondb?sslmode=require"
ENCRYPTION_KEY="…"
PHONE_HASH_SECRET="…"
```

Then, in order:

```bash
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm db:seed
pnpm demo
```

`prisma generate` is not optional and is easy to miss: `pnpm install` does
not run it, because generation happens inside `pnpm build`, which you have
no reason to run locally when deploying. Skip it and the seed fails with
`Cannot find module '.prisma/client/default'`, which reads like a broken
checkout rather than a missing step.

`db:seed` needs `ENCRYPTION_KEY` - it encrypts each store's receipt-signing
secret before storing it - and `demo` needs `PHONE_HASH_SECRET` as well,
for the members it creates. Both must be the same values the live site
uses, which is the whole reason they are Config rather than Secret above.

That gives you Copper Kettle with five stores, 280 members and three
months of activity, at `https://copper-kettle.qumo-app.com`, and a console
login at `https://app.qumo-app.com`.

**Change the console password immediately.** The seed sets a known one, and
it is in this repository. Sign in, then use the password screen.

---

## Where the demo is thin

Worth knowing before somebody else finds it.

**Sign-in passcodes go to the deployment log.** There is no SMS account, so
`lib/sms/client.ts` falls back to writing the passcode to stdout, which on
Vercel means the Runtime Logs. For a demo where you own every number that
signs in, that is fine. It stops being fine the moment a real shopper signs
in: anyone who can read the logs can sign in as them. This is the first
thing to fix after the pitch, and it is one account and three environment
variables.

**The till simulator is not there.** `/dev/till` 404s in production by
design - it hands out validly signed slips, which is the exact artefact the
whole verification scheme exists to make unforgeable. So a deployed demo
cannot mint its own slips. Two ways round it, both fine:

- run the till on your laptop against the *production* database, and point
  its codes at the deployed site:

  ```bash
  DATABASE_URL="<the pooled Neon string>" \
  QUMO_TILL_ORIGIN="https://copper-kettle.qumo-app.com" \
  pnpm dev
  ```

  Open `http://copper-kettle.localhost:3000/dev/till`, print a slip, scan
  the QR with your phone. The slip is signed with that store's real secret,
  read from the production database, so the deployed site accepts it - the
  till is standing in for a point of sale, which is exactly what it is for;
- or hand out pack codes, which are real single-use codes generated in the
  console under Pack codes, and work on the deployed site with nothing extra.

**Redemption is off.** Shoppers earn and see a balance; there is no spend
flow, because there is no cashier screen for one. `lib/wallet/availability.ts`
gates it and the terms say so plainly.

**One region.** The free tier runs the app in one place, and if the database
is somewhere else every query pays for the gap. Put both in Europe and Cape
Town sees a few hundred milliseconds. Nobody in a pitch will notice; it is
worth knowing before a pilot.

---

## If you would rather not use Vercel Hobby

All of these permit commercial use on their free or near-free tier. All of
them are more work than Vercel, in roughly this order:

- **Vercel Pro, $20/month.** Same steps as above, no licensing question,
  and per-minute cron instead of daily. The honest recommendation if the
  money is available: it is cheaper than the time the alternatives cost.
- **Netlify.** Closest to Vercel in shape. Wildcard subdomains are a paid
  feature there, so the free tier does not do subdomain-per-brand.
- **Fly.io.** Wildcard certificates, real servers, no cold starts, a few
  dollars a month for something this size. Needs a Dockerfile, which this
  repo does not have yet.
- **A small VPS** (Hetzner, around €4/month) behind Caddy, which gets a
  wildcard certificate over DNS-01 by itself. Most control, most work, and
  you own the updates.

The application does not care which of these it runs on. What it needs is
Node 22, a Postgres connection string, the environment variables in step 3,
and a wildcard hostname pointed at it.
