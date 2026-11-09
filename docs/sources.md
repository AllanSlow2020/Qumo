# Sources for every figure in the decks

Generated from `deck/sources.py` by `python3 deck/sources.py`. Edit that file, not this one. Every build of `deck/build_deck.py` and `deck/build_pitch.py` reads the figures back out of the finished deck and refuses to save it if one is not listed here. `--strict` also refuses the open gaps: use it for any copy that goes to a brand or an investor.

**Open gaps, which `--strict` refuses:** R40,000 (what a managed on-pack promotion costs a brand in South Africa), R80,000 (what two managed promotions a year cost).

## Read in the primary source

| Figure | Claim | Where | Exact words |
|---|---|---|---|
| 85% | Share of economically active South Africans using a loyalty programme | truth-2025, p. 9 | "The BrandMapp 2025 data reveals that a substantial 85% of economically active South Africans (with a household income of R10,000+ p.m.), actively participate in loyalty programmes." |
| 10.4 | Average number of loyalty programmes actively used | truth-2025, p. 13 | "The BrandMapp data reveals that the average number of loyalty programmes which South Africans actively use is 10.4 programmes." |
| 4.6, 2015 | The same average in 2015 | truth-2025, p. 12 | "+228% increase from 4.6 in 2015" *Caution: Quote the 4.6, never the 228%: 10.4 is 2.26 times 4.6, a 126% increase.* |
| R10,000 | The income line that defines 'economically active' | truth-2025, p. 9 | "economically active South Africans (with a household income of R10,000+ p.m.)" |
| R10,000 | The income line that defines 'mass market' | truth-2025, p. 11 | "For mass market consumers (with a household income of less than R10,000 p.m.)" |
| 2025/6 | The edition named in the citation | truth-2025, cover | "2025/6" |
| 78% | Say the loyalty programme they belong to significantly influences where they buy groceries (economically active) | truth-2025, p. 24 (chart) | "How do loyalty programmes influence consumer behaviour in different sectors? - Economically active. 78% Where you shop for groceries" *Caution: The question as asked (p. 24): 'Which of the following things are significantly influenced by the loyalty programme you belong to?' Several answers allowed.* |
| 45% | Name real cashback among the benefits they would most enjoy, the top answer (economically active) | truth-2025, p. 58 (chart); p. 60 | "Which of the following benefits would you most enjoy in your loyalty programme? - Economically active. Real cashback rewards 45%. And p. 60: "Since the initial BrandMapp study, it has remained the number one preferred benefit in South Africa."" *Caution: Several answers allowed: 45% named it, not 45% chose it over everything else.* |
| 40% | Agree 'I want to be instantly rewarded for my loyalty to a brand' (economically active) | truth-2025, p. 22 (chart); p. 60 | "40% I want to be instantly rewarded for my loyalty to a brand. And p. 60: "40% of South African loyalty users want to be instantly rewarded"" |
| 37% | Name points that can be used as cash, second answer (economically active) | truth-2025, p. 58 (chart) | "Points that can be used as cash 37%" |
| 38% | Name competition entries among the benefits they would most enjoy, third answer (mass market) | truth-2025, p. 59 (chart) | "Which of the following benefits would you most enjoy in your loyalty programme? - Mass market. Real cashback rewards 40%, Birthday offer 39%, Competition entries 38%" |
| 64% | Name swiping a card as a way they prefer to use a programme (economically active) | truth-2025, p. 64 (chart) | "How South Africans prefer to make use of a loyalty programme - Economically active. Swiping a card 64%, Scanning an app 37%, Providing a cellphone number 33%" |
| 33% | Name providing a cellphone number (economically active) | truth-2025, p. 64 (chart) | "Providing a cellphone number 33%" |
| 72% | Name swiping a card (mass market) | truth-2025, p. 65 (chart); p. 67 | "How South Africans prefer to make use of a loyalty programme - Mass market. Swiping a card 72%, Providing a cellphone number 32%, Scanning an app 27%. And p. 67: "This likely reflects ongoing challenges with data access, cellphone reception and data costs"" |
| 32% | Name providing a cellphone number, second answer (mass market) | truth-2025, p. 65 (chart) | "Providing a cellphone number 32%" |
| 27% | Name scanning an app (mass market) | truth-2025, p. 65 (chart) | "Scanning an app 27%" |

## Facts about Qumo, with evidence

| Figure | Claim | Evidence |
|---|---|---|
| 0 | Apps a shopper must install | The shopper surface is a web page under app/; there is no native app. |
| 1 | Scans needed to earn | One scan of a code awards it; each code earns once (lib/packs/code.ts). |
| 6 | Length of the texted sign-in code | lib/consumer/otp.ts: const CODE_DIGITS = 6 |
| 800+ | Automated tests passing | pnpm test against a local Postgres on 2026-11-09: 811 tests in 71 files, all passing. Re-run before quoting a more exact figure. |
| 17 | Screens in the decks, each a capture of the running product | deck/shots/ holds 17 captures, written by deck/capture.mjs. |
| 2 | Ways a purchase is proved: a code under the pack, or a till slip | lib/packs/ (pack codes) and lib/stores/receipt.ts (till slips). *Caution: docs/brand-context.md section 8 says 'three ways to earn' for the site, meaning the three promotion shapes. Different axis; do not mix them.* |
| 0 | Nothing in the deck is a mock-up | Every screen is a capture of a running build (deck/capture.mjs). |
| 84 | Days of seeded history in the demo database | scripts/demo.ts: const HISTORY_DAYS = 84 |
| 5 | Stores in the demo database | scripts/demo.ts: 'five Cape Town stores' (the STORES list) |

## Demo data (slide must say illustrative)

| Figure | Claim | Evidence |
|---|---|---|
| 52% | Repeat rate on the performance screen | scripts/demo.ts |
| R12.97 | Cost per person reached on the performance screen | scripts/demo.ts |
| 137 | People who earned, on the performance screen | scripts/demo.ts |
| R3,155 | Value still owed, on the overview screen | scripts/demo.ts |
| 143, 30 | Scans in the last 30 days, on the performance screen | scripts/demo.ts |
| 103 | People who joined in the window, on the performance screen | scripts/demo.ts |

## Qumo's proposed prices (slide must say indicative)

| Figure | Claim | Evidence |
|---|---|---|
| R7,500, 10,000 | Launch tier: price a month, and scans a month | qumo-pricing, the tier table |
| R25,000, 100,000 | Programme tier: price a month, and scans a month | qumo-pricing, the tier table |
| R60,000, 500,000+ | Platform tier: price a month, and scans a month | qumo-pricing, the tier table |

## Arithmetic on the above

| Figure | Claim | How | As strong as |
|---|---|---|---|
| R80,000 | What two managed promotions a year cost | two promotions a year at R40,000 | unsourced |
| R90,000 | Launch tier for a year | R7,500 a month for twelve months | indicative |

## Open gaps

| Figure | Claim | What would close it |
|---|---|---|
| R40,000 | What a managed on-pack promotion costs a brand in South Africa | Written quotes from two or three promotions agencies, or a real invoice with the names removed. Being gathered from agency conversations. |

## The sources

- **truth-2025**: The Truth and BrandMapp 2025/6 Loyalty Whitepaper (10th edition). Truth and WhyFive Insights, March 2026 (PDF created 17 March 2026). <https://truth.co.za/wp-content/uploads/2026/03/Truth_BrandMapp_Whitepaper2025_6.pdf> Read 2026-11-09. SHA-256 prefix 7105d9d42b75fb72, 38-page PDF of spreads. Page numbers are the printed ones. 'Economically active' is the BrandMapp sample: household income above R10,000 a month (p. 3).
- **qumo-code**: The Qumo repository. Qumo. <https://github.com/AllanSlow2020/qumo> Read 2026-11-09.
- **qumo-pricing**: docs/pricing-tiers.md. Qumo. `docs/pricing-tiers.md` Read 2026-11-09. Qumo's own proposed tiers. Zero customers have paid them.
