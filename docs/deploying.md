# Putting Qumo on the internet

Everything below is one afternoon and, apart from a domain, no money. It
gets you two working addresses on real HTTPS:

```
chicken-licken.qumo.co.za    the shopper's site
app.qumo.co.za               the brand console
```

Read the two paragraphs under **Before you start** first. One of them is a
licensing fact rather than a technical one, and it is the sort of thing
worth knowing before rather than after.

---

## Before you start

**Vercel's free plan is technically enough.** The thing that looked like it
would force an upgrade - a wildcard domain, `*.qumo.co.za`, which is what
makes subdomain-per-brand work - is available on every Vercel plan,
including Hobby. The only condition is that the domain has to use Vercel's
own nameservers, because a wildcard certificate is issued by proving
control of DNS and Vercel can only do that if it holds the zone. Hobby caps
you at 50 domains per project, and one wildcard covers every brand you will
ever add.

The nightly cleanup job also fits: Hobby allows cron, once a day, and
`vercel.json` already schedules it once a day.

**Vercel's free plan is not licensed for this.** Hobby is
non-commercial-personal-use only, and Vercel defines commercial broadly -
any deployment used for the financial gain of anyone involved in producing
it. Showing Qumo to Chicken Licken in order to win their business is
commercial by that definition. Nobody will stop you deploying, and I am not
going to pretend the risk is dramatic; but it is their platform and their
rule, so you should choose it knowingly rather than find out later. Pro is
$20 a month and the switch is a button, not a migration. If you would
rather not pay and would rather not be offside, the alternatives are at the
bottom of this file.

The one thing you do have to pay for is a domain. `qumo.app` belongs to
somebody else; `qumo.co.za` is about R100 a year.

---

## 1. A database

[Neon](https://neon.tech) - free tier, real Postgres, commercial use fine.

1. Sign up and create a project.
2. Copy the **pooled** connection string. It has `-pooler` in the host.
   That is the one that survives serverless: every request may be a new
   process, and a direct connection per process exhausts Postgres's
   connection limit under any real traffic.
3. Keep it. It becomes `DATABASE_URL`.

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
`vercel.app`, and `chicken-licken.vercel.app` resolves correctly.

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
configuration - `vercel.json` is already in the repo and carries the cron
schedule.

Then add the environment variables, under Settings → Environment Variables.

**Generate every secret with the command in the table - do not invent one.**
A typed passphrase is the single most common way this goes wrong:
`ENCRYPTION_KEY` has to decode to exactly 32 bytes for AES-256, and anything
you make up by hand almost certainly will not. The preflight check catches
that one before it deploys; it cannot catch a weak `AUTH_SECRET`.

| Variable | Value | Type |
|---|---|---|
| `DATABASE_URL` | the pooled Neon string from step 1 | Config |
| `NEXT_PUBLIC_QUMO_ROOT_DOMAIN` | `qumo.co.za` - bare hostname, no `https://`, no path | Config |
| `PHONE_HASH_SECRET` | `openssl rand -base64 32` | Config |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` | Config |
| `AUTH_SECRET` | `openssl rand -base64 32` | Secret |
| `AUTH_TRUST_HOST` | `true` | Config |
| `CRON_SECRET` | `openssl rand -hex 32` | Secret |

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
production domain, which will stop `chicken-licken.localhost:3000` working
- so keep this `.env` for pointing at production, and run `pnpm bootstrap`
to get a local one back.

Leave `TWILIO_*` and `ERROR_WEBHOOK_URL` empty for now. What that costs you
is in **Where the demo is thin** below.

The build runs `scripts/preflight.mjs` first and refuses to deploy if any of
the four secrets is missing, if `ENCRYPTION_KEY` is the wrong length, or if
the root domain is still a development value. All of those produce a site
that builds, deploys, and then does not work - which is exactly why they
are caught here rather than by you, later, in front of somebody.

## 4. The domains on the project

Settings → Domains, add three:

| Domain | Why |
|---|---|
| `*.qumo.co.za` | every brand, and the console. This is the one that matters. |
| `qumo.co.za` | the apex. Nothing is served here yet - it answers "this link needs a brand" - but leaving it unclaimed means a typo goes nowhere at all. |
| `app.qumo.co.za` | covered by the wildcard already; add it explicitly so the certificate is issued eagerly rather than on the first request. |

Vercel issues the certificates itself once the nameservers have propagated.

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

That gives you Chicken Licken with five stores, 280 members and three
months of activity, at `https://chicken-licken.qumo.co.za`, and a console
login at `https://app.qumo.co.za`.

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
  QUMO_TILL_ORIGIN="https://chicken-licken.qumo.co.za" \
  pnpm dev
  ```

  Open `http://chicken-licken.localhost:3000/dev/till`, print a slip, scan
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
