# Qumo

Purchase loyalty for South African brands. A shopper scans a code on a till
slip or a pack, earns a share of what they spent or a stamp toward a reward,
and sees the balance on a brand-skinned web page — no app to download.

Two things it is not: it is not a points system you can spend anywhere (value
is closed-loop, earned with one brand and spent only there), and it has
nothing to do with CIOS. Shared no tables, shared no runtime.

## Running it

```
pnpm install
cp .env.example .env          # fill in the generated secrets
pnpm prisma:migrate
pnpm db:seed                  # prints two scannable slip URLs
pnpm dev
```

The seed creates a demo brand with two stores — one whose point of sale can
sign its slips and one that cannot — because the difference between them is
the most important operational fact about this product.

`pnpm test` runs the suite against a real Postgres. There is no mock database
and there should not be: every guarantee that matters here is a database one.

## Where to start reading

- `docs/qumo-architecture.md` — what this is, what it deliberately is not,
  and the decisions behind both.
- `docs/qumo-user-journey.html` — every route, what is built, and four
  diagrams. Open it in a browser.
- `lib/ledger/accrue.ts` — the one place a scan becomes money.
- `lib/db/tenant.ts` — the guard that makes one brand unable to read another.
