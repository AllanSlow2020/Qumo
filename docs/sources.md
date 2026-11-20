# Sources for every figure in the decks

Generated from `deck/sources.py` by `python3 deck/sources.py`. Edit that file, not this one. Every build of `deck/build_deck.py` reads the figures back out of the finished deck and refuses to save it if one is not listed here. `--strict` also refuses the open gaps: use it for any copy that goes to a brand or an investor.

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
| 1,000+ | Automated tests passing | pnpm test against a local Postgres on 2026-11-20, main at b4abccf: 1,009 tests in 86 files, all passing (863 in 76 on 2026-11-11, 811 in 71 on 2026-11-09). Re-run before quoting a more exact figure. |
| 1 | High advisories accepted by the audit gate, each with a written reason | pnpm audit:ci on 2026-11-20: 'Nothing blocking. 1 accepted, 0 stale.' The one is source-map-js (GHSA-68fv-2mgg-jv7q), reached through next > postcss at build only. Exceptions and reasons are in scripts/audit.mjs, which CI runs as its own job (.github/workflows/ci.yml). pnpm audit --prod the same day: 1 advisory, high. On 2026-11-11 it was 8 accepted of 22. *Caution: Changes as advisories are published and fixed. Re-run before quoting it.* |
| 18 | Screens in the deck, each a capture of the running product | The distinct screenshots build_deck.py places, every one in deck/shots/ and written by deck/capture.mjs; recaptured 2026-11-20 from main at b4abccf. Counted at build time, not trusted. |
| 3 | Ways a promotion can award: a stamp toward a card, a fixed amount per scan, or a share of what they spend | app/console/(authed)/(gated)/guide/codes.ts: AWARD_ROWS, 'The three shapes a promotion can award, in the console's own words'. The stamp card is the third, beside the two EarnRuleType values in prisma/schema.prisma. *Caution: Until 2026-11-20 this slide said 2, counting ways to prove a purchase (pack code, till slip). Codes are a different axis: slip, pack code or sticker.* |
| 0 | Nothing in the deck is a mock-up | Every screen is a capture of a running build (deck/capture.mjs). |

## Demo data (slide must say illustrative)

| Figure | Claim | Evidence |
|---|---|---|
| 59% | Repeat rate on the performance screen | Read off deck/shots/console-performance.png, captured 2026-11-20 from the demo seed (scripts/demo.ts). The demo is random: re-read after every capture. |
| R13.92 | Cost per person reached on the performance screen | Read off deck/shots/console-performance.png, captured 2026-11-20 from the demo seed (scripts/demo.ts). The demo is random: re-read after every capture. |
| 128 | People who earned, on the performance screen | Read off deck/shots/console-performance.png, captured 2026-11-20 from the demo seed (scripts/demo.ts). The demo is random: re-read after every capture. |
| R2,713.97 | Value still owed, on the performance screen | Read off deck/shots/console-performance.png, captured 2026-11-20 from the demo seed (scripts/demo.ts). The demo is random: re-read after every capture. |

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

## Statements without figures

Claims on slides that carry no number, so the figure check cannot see them. The build fails if a file cited here no longer exists.

| Claim | Shown by | How |
|---|---|---|
| Two-factor sign-in is required for owner and admin accounts. | `lib/staff/mfa-policy.ts`, `lib/staff/login.ts` | ROLES_REQUIRING_SECOND_FACTOR = ['OWNER', 'ADMIN']; sign-in asks for the code once one is enrolled. |
| It is checked on every server action as well as every page. | `lib/staff/current.ts` | requireStaff() redirects an account that owes a second factor; every console server action starts by calling it. |
| An owner cannot switch their own off. | `lib/staff/mfa.ts` | disableMfa() refuses outright for a role that requires a second factor. |
| Nobody can reset their own; another owner resets a lost phone. | `lib/staff/users.ts` | resetSecondFactorForSession(): MANAGE_USER_ROLES is OWNER only, and a reset of one's own account is refused. |
| Inbound text messages are checked against Twilio's request signature, which covers the sender, so a forged number is refused. | `lib/sms/twilio-signature.ts`, `app/api/sms/inbound/route.ts` | twilioSignatureValid() is called by the inbound route; the signed payload includes From. |
| A known high or critical advisory in a production dependency fails the build. | `scripts/audit.mjs`, `.github/workflows/ci.yml`, `package.json` | pnpm audit:ci runs scripts/audit.mjs as its own CI job, with documented exceptions and a stale-exception warning. |
| Dependabot checks weekly. | `.github/dependabot.yml` | package-ecosystem npm, interval weekly. |
| Nobody sees a shopper's mobile number, the brand included, and no other brand sees a brand's activity. | `docs/brand-context.md`, `lib/db` | brand-context.md section 10, true of the running product: a brand never sees a shopper's mobile number and has no screen showing an individual shopper; every brand's data is separated structurally (the tenant guard in lib/db). |
| Each promotion's per-person-per-day and total ceilings are enforced at the moment of the scan. | `lib/ledger/accrue.ts`, `lib/packs/scan.ts`, `lib/stores/receipt.ts` | maxScansPerPersonPerDay and maxTotalAmount are checked in the earn paths, not in the interface. |
| A live promotion with no ceiling is flagged on the first screen. | `app/console/(authed)/(gated)/page.tsx` | The overview's 'A live promotion has no ceiling' notice. |
| A stamp card's reward code is taken at the counter once; a second attempt names who took it first. A rand balance cannot be spent at a till. | `lib/coupons/manage.ts`, `lib/wallet/availability.ts` | ALREADY_REDEEMED carries the staff member who took it; REDEMPTION_AVAILABLE for wallet spend is still false (docs/state-of-play.md, section 2). |
| A pack code needs nothing from the brand's stores and nothing installed. | `lib/packs/scan.ts` | A pack code is scanned by the shopper's phone and awarded by the page; no till, POS or store system is involved (docs/competitive-position.md, section 1). |
| No penetration test has been done; what was done is a source-code review. | - | Stated by the owner on 2026-11-11. The security work in PRs 37 to 41 was a review of the source, not an exercise against a running system. |

## Not to be claimed

The build refuses the words for the first two (see FORBIDDEN in `deck/sources.py`). The third has no single word to catch, so it rests on this list.

- **That the product is secure, hardened or penetration tested.** It has had a source-code review only.
- **Durability or disaster recovery.** Restore capacity is six hours of point-in-time restore on Neon's free plan, with the one manual snapshot already used.
- **Correct security response headers in production.** Correct in configuration, not yet confirmed on the live site.

## The sources

- **truth-2025**: The Truth and BrandMapp 2025/6 Loyalty Whitepaper (10th edition). Truth and WhyFive Insights, March 2026 (PDF created 17 March 2026). <https://truth.co.za/wp-content/uploads/2026/03/Truth_BrandMapp_Whitepaper2025_6.pdf> Read 2026-11-09. SHA-256 prefix 7105d9d42b75fb72, 38-page PDF of spreads. Page numbers are the printed ones. 'Economically active' is the BrandMapp sample: household income above R10,000 a month (p. 3).
- **qumo-code**: The Qumo repository. Qumo. <https://github.com/AllanSlow2020/qumo> Read 2026-11-09.
- **qumo-pricing**: docs/pricing-tiers.md. Qumo. `docs/pricing-tiers.md` Read 2026-11-09. Qumo's own proposed tiers. Zero customers have paid them.
