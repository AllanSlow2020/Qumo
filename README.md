# Qumo

Purchase loyalty for South African brands. A shopper scans a code on a till
slip or a pack, earns a share of what they spent or a stamp toward a reward,
and sees the balance on a brand-skinned web page — no app to download.

Two things it is not: it is not a points system you can spend anywhere (value
is closed-loop, earned with one brand and spent only there), and it has
nothing to do with CIOS. Shared no tables, shared no runtime.

## Trying it yourself

Everything below runs on one machine with no accounts, no domain and no
deployment. Two commands, then a browser.

```bash
pnpm bootstrap     # database, secrets, schema — safe to re-run
pnpm demo          # a Chicken Licken worth looking at
pnpm dev
```

`pnpm demo` builds a brand that looks like a business rather than a test
fixture: five Cape Town stores, 280 members, three months of deliberately
uneven activity, a stamp card partway through and forty unscanned pack
codes. It clears its own rows first, so run it as often as you like.

### The three addresses

| | |
|---|---|
| **Shopper** | http://chicken-licken.localhost:3000 |
| **Console** | http://app.localhost:3000 — `owner@chicken-licken.example` / `qumo-dev-password` |
| **Till** | http://chicken-licken.localhost:3000/dev/till |

`*.localhost` resolves to your own machine in every current browser, so
there is nothing to add to `/etc/hosts`.

### The loop worth walking

1. **Open the till.** Pick a store and a basket. It signs a slip with that
   store's own secret, through the same code a real point of sale would
   use — what comes out is a real slip, not a special case.
2. **Scan it** — click it on the laptop, or point a phone at the QR.
3. **Sign in** with any South African mobile number. There is no SMS
   account yet, so the passcode is printed to the terminal running
   `pnpm dev`: look for `sms (simulated) send`.
4. **Watch the balance move**, then scan the same slip again. The page
   says the same thing — it is the same award — but the balance underneath
   does not move, because a slip is worth one award, ever. Scanned from a
   second phone it is refused outright.
5. **Try a pack code** from the bottom of the till page — the other way to
   earn, with no till involved.
6. **Open the console** and look at Performance: the scan you just made is
   in the chart, in the store table, and in the activity log under your
   own name.

### Using a phone

`chicken-licken.localhost` means nothing to a phone, and Qumo resolves the
brand from the subdomain, so a bare IP will not do. `nip.io` solves it with
no code and no configuration — it resolves any `<anything>.<ip>.nip.io` to
that IP.

```bash
ipconfig getifaddr en0                       # macOS, e.g. 192.168.1.42
NEXT_PUBLIC_QUMO_ROOT_DOMAIN=192.168.1.42.nip.io pnpm dev
```

Then browse to `http://chicken-licken.192.168.1.42.nip.io:3000` from the
phone, on the same wifi. The till's QR codes will point there too, so they
scan properly.

The root domain is read at build time as well as at run time, so if you
have already run `pnpm build`, rebuild after changing it.

### The till simulator is development only

It hands out validly signed slips, which is the exact artefact the whole
verification scheme exists to make unforgeable. It 404s when `NODE_ENV` is
`production`, which `next build` sets — there is no header, cookie or query
string that reaches it. See `lib/dev/guard.ts`.

## Running it on your own machine

You need three things installed: **Node 22 or newer**, **pnpm**, and
**Postgres 14 or newer**. Nothing else — no Docker, no cloud account, no SMS
provider. The whole product runs locally, including logging in as a shopper.

Node comes from [nodejs.org](https://nodejs.org) (take the LTS build). pnpm
comes from Node itself, once:

```
corepack enable pnpm
```

### 1. Postgres

On a Mac, the simplest route is [Postgres.app](https://postgresapp.com) —
download, drag to Applications, click Initialize. Or with Homebrew:

```
brew install postgresql@16 && brew services start postgresql@16
```

On Windows, use the [official installer](https://www.postgresql.org/download/windows/)
and keep the password you set. On Linux, `sudo apt install postgresql` and
`sudo systemctl start postgresql`.

If you would rather not install it at all:

```
docker run --name qumo-db -e POSTGRES_PASSWORD=qumo -p 5432:5432 -d postgres:16
```

You do **not** need to create a database by hand. Prisma creates it on the
first migration, as long as the Postgres user is allowed to.

### 2. Everything else, in one command

```
git clone https://github.com/AllanSlow2020/Qumo.git
cd Qumo
corepack enable pnpm
pnpm install
pnpm bootstrap
```

`pnpm bootstrap` does the rest: it finds your Postgres, generates the four
secrets, writes `.env`, creates the database, applies the schema, adds a demo
brand, and prints every address to open. It is safe to run twice — it never
overwrites an existing `.env`.

If it can't find Postgres it says so and tells you how to start one. If your
Postgres needs a password or lives somewhere unusual, put its connection
string in `.env` as `DATABASE_URL` and run it again.

Then:

```
pnpm dev
```

<details>
<summary>Doing it by hand instead</summary>

`pnpm bootstrap` is only convenience. The long way:

```
cp .env.example .env
```

Replace the four placeholder secrets — each command prints one value:

```
openssl rand -base64 32     # AUTH_SECRET
openssl rand -base64 32     # PHONE_HASH_SECRET
openssl rand -base64 32     # ENCRYPTION_KEY
openssl rand -hex 32        # CRON_SECRET
```

On Windows without `openssl`, use
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
and `'hex'` for the last one.

Point `DATABASE_URL` at your Postgres, then:

```
pnpm prisma:migrate
pnpm db:seed
pnpm dev
```

You do **not** need to create the database first — Prisma creates it, as long
as the Postgres user is allowed to.

</details>

Leave `TWILIO_*` empty. Empty is what makes shopper login passcodes print to
your terminal instead of being texted, which is what lets you sign in as
anybody.

The seed prints the addresses to open. They look odd and they are correct:

| | |
|---|---|
| `chicken-licken.localhost:3000` | a brand's shopper site |
| `campari.localhost:3000` | a second brand, to see the reskin |
| `app.localhost:3000` | the brand console |
| `localhost:3000` | the apex, which belongs to no brand |

Every browser resolves `*.localhost` to your own machine, so these work with
no hosts-file editing. **Each brand is a subdomain** — that is the whole
routing model, and using plain `localhost:3000` will show you a page saying
this link needs a brand, which is correct rather than broken.

### Signing in

**As a shopper**, open a brand address and enter any valid-looking SA mobile
number (`0821234567`). No SMS is sent — the passcode appears in the terminal
running `pnpm dev`, on a line reading `sms (simulated) send`. Copy the six
digits from it.

**As a brand**, open `app.localhost:3000` and use the credentials the seed
printed: `owner@chicken-licken.example` / `qumo-dev-password`.

### What is worth trying

Roughly in the order the product happens:

1. **Scan a slip.** The seed printed two, one signed and one unsigned. Open
   one on your phone-sized browser window and follow it through sign-up. Then
   open the *same* URL again — it should show you what you earned, not an
   error.
2. **Try the poster.** `chicken-licken.localhost:3000/join` explains what is
   running and takes an opt-in. It never awards anything, deliberately.
3. **Open the console** and look at Overview. The outstanding figure is what
   the brand owes its shoppers, summed from the ledger.
4. **End the programme** under Plan, then reload the shopper's wallet. They
   keep their balance and are told the date it stays spendable until.
   Restart it and everything comes back.
5. **Print pack codes** under Pack codes, download the CSV, and open one of
   the URLs in it. That is the Campari sticker path.
6. **Add somebody to the team**, then sign in as them in a private window —
   the one-time password only works once.
7. **Break something on purpose.** Take the *unsigned* slip URL, change
   `c=12000` to `c=99999999`, and open it: the promotion's ceilings refuse it
   rather than paying out R5,000. Do the same to the *signed* slip and it is
   refused before anything is even considered, because the amount no longer
   matches the signature. Those two refusals are the difference between the
   two stores, and the reason the console nags about unsigned ones.

### Running the tests

```
pnpm test
```

The suite runs against a real Postgres — there is no mock database and there
should not be, because every guarantee that matters here is a database one.
It creates and cleans up its own rows, so it is safe against the same
database you are developing on.

### If something goes wrong

- **"Can't reach database server"** — Postgres isn't running, or
  `DATABASE_URL` doesn't match how you installed it.
- **Every page says "this link needs a brand"** — you are on `localhost:3000`
  rather than a brand subdomain. Use `chicken-licken.localhost:3000`.
- **The login passcode never appears** — check `TWILIO_*` are empty in `.env`,
  and look at the terminal running `pnpm dev` rather than the browser.
- **A slip says it has already been scanned** — they are single-use. Re-run
  `pnpm db:seed` for fresh ones.
- **Prisma complains about a missing column after pulling changes** — run
  `pnpm prisma:migrate` again; a running `pnpm dev` also needs restarting,
  because it holds a generated client from before the change.

## Where to start reading

- `docs/qumo-architecture.md` — what this is, what it deliberately is not,
  and the decisions behind both.
- `docs/qumo-user-journey.html` — every route, what is built, and four
  diagrams. Open it in a browser.
- `lib/ledger/accrue.ts` — the one place a scan becomes money.
- `lib/db/tenant.ts` — the guard that makes one brand unable to read another.
