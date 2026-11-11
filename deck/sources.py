"""
Where every figure in the decks comes from, and the check that keeps it so.

    python3 deck/sources.py          # rewrite docs/sources.md from this file
    python3 deck/build_deck.py       # builds, then checks every figure on every slide
    python3 deck/build_deck.py --strict    # also refuses known gaps: use for anything
                                           # that leaves the building

── The rule ─────────────────────────────────────────────────────────────

A number goes on a slide only if this file says where it came from. The
build reads the text back out of the finished deck, finds every figure in
it, and fails if any figure has no entry here. That is deliberately done on
the output rather than at the call site, so a number typed straight into a
text() call is caught the same as any other.

Every entry is one of six kinds, and the kind decides what it must carry:

  primary      read in its primary source. Needs a source, a page or place,
               and the exact words, copied rather than paraphrased.
  product      a fact about Qumo itself. Needs evidence a reader can check:
               a file, a command, a constant. May carry a verify() that
               the build runs, for facts it can count for itself.
  demo         a figure on a screen of seeded demo data. The slide must
               say ILLUSTRATIVE, or the build fails.
  indicative   a price or limit Qumo proposes. Needs the document it comes
               from; the slide must say indicative.
  derived      arithmetic on other entries. As strong as its weakest input.
  unsourced    a known gap. Says what would close it. The build warns;
               --strict refuses.

An entry with a `where` matches only on a slide whose text contains that
phrase, so the same figure can mean two things on two slides without one
entry vouching for both.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
STRICT = "--strict" in sys.argv

# ---------------------------------------------------------------- sources

SOURCES = {
    "truth-2025": {
        "title": "The Truth and BrandMapp 2025/6 Loyalty Whitepaper (10th edition)",
        "publisher": "Truth and WhyFive Insights",
        "published": "March 2026 (PDF created 17 March 2026)",
        "url": "https://truth.co.za/wp-content/uploads/2026/03/Truth_BrandMapp_Whitepaper2025_6.pdf",
        "read": "2026-11-09",
        "fingerprint": "SHA-256 prefix 7105d9d42b75fb72, 38-page PDF of spreads",
        "note": "Page numbers are the printed ones. 'Economically active' is the BrandMapp "
                "sample: household income above R10,000 a month (p. 3).",
    },
    "qumo-code": {
        "title": "The Qumo repository",
        "publisher": "Qumo",
        "url": "https://github.com/AllanSlow2020/qumo",
        "read": "2026-11-09",
    },
    "qumo-pricing": {
        "title": "docs/pricing-tiers.md",
        "publisher": "Qumo",
        "url": "docs/pricing-tiers.md",
        "read": "2026-11-09",
        "note": "Qumo's own proposed tiers. Zero customers have paid them.",
    },
}

# ---------------------------------------------------------------- figures

FIGURES = [
    # ── Truth & BrandMapp ──────────────────────────────────────────────
    {"id": "wp-participation", "figure": "85%", "decks": ["qumo"], "kind": "primary",
     "where": "BrandMapp", "source": "truth-2025", "locator": "p. 9",
     "claim": "Share of economically active South Africans using a loyalty programme",
     "quote": "The BrandMapp 2025 data reveals that a substantial 85% of economically active "
              "South Africans (with a household income of R10,000+ p.m.), actively participate "
              "in loyalty programmes."},
    {"id": "wp-programmes", "figure": "10.4", "decks": ["qumo"], "kind": "primary",
     "source": "truth-2025", "locator": "p. 13",
     "claim": "Average number of loyalty programmes actively used",
     "quote": "The BrandMapp data reveals that the average number of loyalty programmes which "
              "South Africans actively use is 10.4 programmes."},
    {"id": "wp-2015", "figure": ["4.6", "2015"], "decks": ["qumo"], "kind": "primary",
     "source": "truth-2025", "locator": "p. 12",
     "claim": "The same average in 2015",
     "quote": "+228% increase from 4.6 in 2015",
     "caution": "Quote the 4.6, never the 228%: 10.4 is 2.26 times 4.6, a 126% increase."},
    {"id": "wp-threshold", "figure": "R10,000", "decks": ["qumo"], "kind": "primary",
     "where": "Economically active", "source": "truth-2025", "locator": "p. 9",
     "claim": "The income line that defines 'economically active'",
     "quote": "economically active South Africans (with a household income of R10,000+ p.m.)"},
    {"id": "wp-threshold-mass", "figure": "R10,000", "decks": ["qumo"], "kind": "primary",
     "where": "Mass market: household income", "source": "truth-2025", "locator": "p. 11",
     "claim": "The income line that defines 'mass market'",
     "quote": "For mass market consumers (with a household income of less than R10,000 p.m.)"},
    {"id": "wp-edition", "figure": "2025/6", "decks": ["qumo"], "kind": "primary",
     "source": "truth-2025", "locator": "cover",
     "claim": "The edition named in the citation", "quote": "2025/6"},

    {"id": "wp-groceries", "figure": "78%", "decks": ["qumo"], "kind": "primary",
     "where": "groceries", "source": "truth-2025", "locator": "p. 24 (chart)",
     "claim": "Say the loyalty programme they belong to significantly influences where they "
              "buy groceries (economically active)",
     "quote": "How do loyalty programmes influence consumer behaviour in different sectors? - "
              "Economically active. 78% Where you shop for groceries",
     "caution": "The question as asked (p. 24): 'Which of the following things are significantly "
                "influenced by the loyalty programme you belong to?' Several answers allowed."},
    {"id": "wp-cashback", "figure": "45%", "decks": ["qumo"], "kind": "primary",
     "where": "cashback", "source": "truth-2025", "locator": "p. 58 (chart); p. 60",
     "claim": "Name real cashback among the benefits they would most enjoy, the top answer "
              "(economically active)",
     "quote": "Which of the following benefits would you most enjoy in your loyalty programme? "
              "- Economically active. Real cashback rewards 45%. And p. 60: \"Since the initial "
              "BrandMapp study, it has remained the number one preferred benefit in South "
              "Africa.\"",
     "caution": "Several answers allowed: 45% named it, not 45% chose it over everything else."},
    {"id": "wp-instant", "figure": "40%", "decks": ["qumo"], "kind": "primary",
     "where": "instantly", "source": "truth-2025", "locator": "p. 22 (chart); p. 60",
     "claim": "Agree 'I want to be instantly rewarded for my loyalty to a brand' "
              "(economically active)",
     "quote": "40% I want to be instantly rewarded for my loyalty to a brand. And p. 60: \"40% of "
              "South African loyalty users want to be instantly rewarded\""},
    {"id": "wp-points-cash", "figure": "37%", "decks": ["qumo"], "kind": "primary",
     "where": "usable as cash", "source": "truth-2025", "locator": "p. 58 (chart)",
     "claim": "Name points that can be used as cash, second answer (economically active)",
     "quote": "Points that can be used as cash 37%"},
    {"id": "wp-competitions", "figure": "38%", "decks": ["qumo"], "kind": "primary",
     "where": "competition entries", "source": "truth-2025", "locator": "p. 59 (chart)",
     "claim": "Name competition entries among the benefits they would most enjoy, third answer "
              "(mass market)",
     "quote": "Which of the following benefits would you most enjoy in your loyalty programme? "
              "- Mass market. Real cashback rewards 40%, Birthday offer 39%, Competition entries "
              "38%"},
    {"id": "wp-card-ea", "figure": "64%", "decks": ["qumo"], "kind": "primary",
     "source": "truth-2025", "locator": "p. 64 (chart)",
     "claim": "Name swiping a card as a way they prefer to use a programme (economically active)",
     "quote": "How South Africans prefer to make use of a loyalty programme - Economically "
              "active. Swiping a card 64%, Scanning an app 37%, Providing a cellphone number 33%"},
    {"id": "wp-phone-ea", "figure": "33%", "decks": ["qumo"], "kind": "primary",
     "where": "phone number", "source": "truth-2025", "locator": "p. 64 (chart)",
     "claim": "Name providing a cellphone number (economically active)",
     "quote": "Providing a cellphone number 33%"},
    {"id": "wp-card-mass", "figure": "72%", "decks": ["qumo"], "kind": "primary",
     "source": "truth-2025", "locator": "p. 65 (chart); p. 67",
     "claim": "Name swiping a card (mass market)",
     "quote": "How South Africans prefer to make use of a loyalty programme - Mass market. "
              "Swiping a card 72%, Providing a cellphone number 32%, Scanning an app 27%. And "
              "p. 67: \"This likely reflects ongoing challenges with data access, cellphone "
              "reception and data costs\""},
    {"id": "wp-phone-mass", "figure": "32%", "decks": ["qumo"], "kind": "primary",
     "where": "phone number", "source": "truth-2025", "locator": "p. 65 (chart)",
     "claim": "Name providing a cellphone number, second answer (mass market)",
     "quote": "Providing a cellphone number 32%"},
    {"id": "wp-app-mass", "figure": "27%", "decks": ["qumo"], "kind": "primary",
     "where": "app", "source": "truth-2025", "locator": "p. 65 (chart)",
     "claim": "Name scanning an app (mass market)",
     "quote": "Scanning an app 27%"},

    # ── Promotions spend: the open gap ────────────────────────────────
    {"id": "promo-cost", "figure": "R40,000", "decks": ["qumo"], "kind": "unsourced",
     "claim": "What a managed on-pack promotion costs a brand in South Africa",
     "needed": "Written quotes from two or three promotions agencies, or a real invoice "
               "with the names removed. Being gathered from agency conversations."},
    {"id": "promo-cost-year", "figure": "R80,000", "decks": ["qumo"], "kind": "derived",
     "from": ["promo-cost"], "how": "two promotions a year at R40,000",
     "claim": "What two managed promotions a year cost"},

    # ── Qumo itself ───────────────────────────────────────────────────
    {"id": "no-app", "figure": "0", "decks": ["qumo"], "kind": "product",
     "where": "apps to download", "source": "qumo-code",
     "claim": "Apps a shopper must install",
     "evidence": "The shopper surface is a web page under app/; there is no native app."},
    {"id": "one-scan", "figure": "1", "decks": ["qumo"], "kind": "product",
     "where": "scan to earn", "source": "qumo-code",
     "claim": "Scans needed to earn",
     "evidence": "One scan of a code awards it; each code earns once (lib/packs/code.ts)."},
    {"id": "otp-digits", "figure": "6", "decks": ["qumo"], "kind": "product",
     "where": "digit sign-in", "source": "qumo-code",
     "claim": "Length of the texted sign-in code",
     "evidence": "lib/consumer/otp.ts: const CODE_DIGITS = 6"},
    {"id": "tests", "figure": "800+", "decks": ["qumo"], "kind": "product",
     "where": "tests passing", "source": "qumo-code",
     "claim": "Automated tests passing",
     "evidence": "pnpm test against a local Postgres on 2026-11-11: 863 tests in 76 files, "
                 "all passing (811 in 71 on 2026-11-09). Re-run before quoting a more exact "
                 "figure."},
    {"id": "audit-accepted", "figure": "8", "decks": ["qumo"], "kind": "product",
     "where": "8 are accepted", "source": "qumo-code",
     "claim": "High advisories accepted by the audit gate, each with a written reason",
     "evidence": "pnpm audit:ci on 2026-11-11: 'Nothing blocking. 8 accepted, 0 stale.' The "
                 "exceptions and their reasons are in scripts/audit.mjs, which CI runs as its "
                 "own job (.github/workflows/ci.yml). pnpm audit --prod the same day: 22 "
                 "advisories, 0 critical, 8 high.",
     "caution": "Changes as advisories are published and fixed. Re-run before quoting it."},
    {"id": "screens", "figure": "17", "decks": ["qumo"], "kind": "product",
     "where": "screens, all real", "source": "qumo-code",
     "claim": "Screens in the decks, each a capture of the running product",
     "evidence": "deck/shots/ holds 17 captures, written by deck/capture.mjs; every one "
                 "appears in the deck.",
     "verify": lambda: len([f for f in os.listdir(os.path.join(HERE, "shots"))
                            if f.endswith(".png")])},
    {"id": "earn-ways", "figure": "2", "decks": ["qumo"], "kind": "product",
     "where": "ways to earn", "source": "qumo-code",
     "claim": "Ways a purchase is proved: a code under the pack, or a till slip",
     "evidence": "lib/packs/ (pack codes) and lib/stores/receipt.ts (till slips).",
     "caution": "docs/brand-context.md section 8 says 'three ways to earn' for the site, "
                "meaning the three promotion shapes. Different axis; do not mix them."},
    {"id": "imaginary", "figure": "0", "decks": ["qumo"], "kind": "product",
     "where": "lines of it imaginary", "source": "qumo-code",
     "claim": "Nothing in the deck is a mock-up",
     "evidence": "Every screen is a capture of a running build (deck/capture.mjs)."},

    # ── Demo data on console screens ──────────────────────────────────
    {"id": "demo-repeat", "figure": "52%", "decks": ["qumo"], "kind": "demo",
     "claim": "Repeat rate on the performance screen", "evidence": "scripts/demo.ts"},
    {"id": "demo-cpr", "figure": "R12.97", "decks": ["qumo"], "kind": "demo",
     "claim": "Cost per person reached on the performance screen", "evidence": "scripts/demo.ts"},
    {"id": "demo-earned", "figure": "137", "decks": ["qumo"], "kind": "demo",
     "claim": "People who earned, on the performance screen", "evidence": "scripts/demo.ts"},
    {"id": "demo-owed", "figure": "R3,155", "decks": ["qumo"], "kind": "demo",
     "claim": "Value still owed, on the overview screen", "evidence": "scripts/demo.ts"},

    # ── Qumo's proposed prices ────────────────────────────────────────
    {"id": "tier-launch", "figure": ["R7,500", "10,000"], "decks": ["qumo"],
     "kind": "indicative", "source": "qumo-pricing", "locator": "the tier table",
     "claim": "Launch tier: price a month, and scans a month"},
    {"id": "tier-programme", "figure": ["R25,000", "100,000"], "decks": ["qumo"],
     "kind": "indicative", "source": "qumo-pricing", "locator": "the tier table",
     "claim": "Programme tier: price a month, and scans a month"},
    {"id": "tier-platform", "figure": ["R60,000", "500,000+"], "decks": ["qumo"],
     "kind": "indicative", "source": "qumo-pricing", "locator": "the tier table",
     "claim": "Platform tier: price a month, and scans a month"},
    {"id": "tier-launch-year", "figure": "R90,000", "decks": ["qumo"], "kind": "derived",
     "from": ["tier-launch"], "how": "R7,500 a month for twelve months",
     "claim": "Launch tier for a year"},
]

# ---------------------------------------------------------------- statements

# Statements on slides that carry no figure, so the figure check cannot see them.
# Each names the files that show it; the build fails if one of those files is gone,
# which catches a rename that would leave a claim pointing at nothing.
CLAIMS = [
    {"id": "mfa-required", "slide": "Enforced in the code",
     "claim": "Two-factor sign-in is required for owner and admin accounts.",
     "files": ["lib/staff/mfa-policy.ts", "lib/staff/login.ts"],
     "evidence": "ROLES_REQUIRING_SECOND_FACTOR = ['OWNER', 'ADMIN']; sign-in asks for the code "
                 "once one is enrolled."},
    {"id": "mfa-actions", "slide": "Enforced in the code",
     "claim": "It is checked on every server action as well as every page.",
     "files": ["lib/staff/current.ts"],
     "evidence": "requireStaff() redirects an account that owes a second factor; every console "
                 "server action starts by calling it."},
    {"id": "mfa-no-self-off", "slide": "Enforced in the code",
     "claim": "An owner cannot switch their own off.",
     "files": ["lib/staff/mfa.ts"],
     "evidence": "disableMfa() refuses outright for a role that requires a second factor."},
    {"id": "mfa-reset", "slide": "Enforced in the code",
     "claim": "Nobody can reset their own; another owner resets a lost phone.",
     "files": ["lib/staff/users.ts"],
     "evidence": "resetSecondFactorForSession(): MANAGE_USER_ROLES is OWNER only, and a reset "
                 "of one's own account is refused."},
    {"id": "sms-signature", "slide": "Enforced in the code",
     "claim": "Inbound text messages are checked against Twilio's request signature, which "
              "covers the sender, so a forged number is refused.",
     "files": ["lib/sms/twilio-signature.ts", "app/api/sms/inbound/route.ts"],
     "evidence": "twilioSignatureValid() is called by the inbound route; the signed payload "
                 "includes From."},
    {"id": "audit-gate", "slide": "Enforced in the code",
     "claim": "A known high or critical advisory in a production dependency fails the build.",
     "files": ["scripts/audit.mjs", ".github/workflows/ci.yml", "package.json"],
     "evidence": "pnpm audit:ci runs scripts/audit.mjs as its own CI job, with documented "
                 "exceptions and a stale-exception warning."},
    {"id": "dependabot", "slide": "Enforced in the code",
     "claim": "Dependabot checks weekly.",
     "files": [".github/dependabot.yml"],
     "evidence": "package-ecosystem npm, interval weekly."},
    {"id": "no-pentest", "slide": "Enforced in the code",
     "claim": "No penetration test has been done; what was done is a source-code review.",
     "files": [],
     "evidence": "Stated by the owner on 2026-11-11. The security work in PRs 37 to 41 was a "
                 "review of the source, not an exercise against a running system."},
]

# Not to be claimed anywhere in the deck until established, with the reason.
NOT_CLAIMED = [
    ("That the product is secure, hardened or penetration tested",
     "It has had a source-code review only."),
    ("Durability or disaster recovery",
     "Restore capacity is six hours of point-in-time restore on Neon's free plan, with the one "
     "manual snapshot already used."),
    ("Correct security response headers in production",
     "Correct in configuration, not yet confirmed on the live site."),
]

# Words the deck may not use, because what they claim has not been established.
FORBIDDEN = [
    (r"\bsecure\b|\bhardened\b", "Not established: it has had a source-code review only."),
    (r"penetration[- ]tested|\bpen[- ]?tested\b", "No penetration test has been done."),
    (r"disaster recovery|\bbackups?\b|backed up|\bdurab","Restore capacity does not support it."),
]

# What a slide must say for a figure of this kind to appear on it.
LABELS = {"demo": "illustrative", "indicative": "indicative"}
RANK = {"primary": 0, "product": 0, "demo": 1, "indicative": 1, "unsourced": 2}

# ---------------------------------------------------------------- reading a deck

# Page counters ("05 / 12"), section numbers ("07 · PERFORMANCE"), tier and
# door tags, and page references in a citation are furniture, not claims.
_FURNITURE = [
    re.compile(r"^\s*\d{1,2} / \d{1,2}\s*$"),
    re.compile(r"^\s*\d{1,2}\s+·\s"),
    re.compile(r"\b(?:tier|door)\s+\d{1,2}\b", re.I),
    re.compile(r"\bpp?\.\s*\d+(?:\s*[-–]\s*\d+)?(?:\s*(?:,|and)\s*\d+(?:\s*[-–]\s*\d+)?)*"),
]
_FIGURE = re.compile(r"R\d[\d,]*(?:\.\d+)?|\b\d{4}/\d{1,2}\b|(?<![\w.])\d[\d,]*(?:\.\d+)?%?\+?")


def figures_in(text):
    for pat in _FURNITURE[2:]:
        text = pat.sub(" ", text)
    return [f.rstrip(",.") for f in _FIGURE.findall(text)]


def _slides(prs):
    for n, sl in enumerate(prs.slides, 1):
        chunks = [sh.text_frame.text for sh in sl.shapes if sh.has_text_frame]
        chunks = [_FURNITURE[1].sub(" ", c) for c in chunks if not _FURNITURE[0].match(c)]
        yield n, chunks


def _figs(entry):
    f = entry["figure"]
    return f if isinstance(f, list) else [f]


def strength(entry, seen=()):
    if entry["kind"] != "derived":
        return entry["kind"]
    inputs = [strength(BY_ID[i], seen + (entry["id"],)) for i in entry["from"]]
    return max(inputs, key=lambda k: RANK[k])


BY_ID = {e["id"]: e for e in FIGURES}


def _well_formed():
    """Problems in the register itself, independent of any deck."""
    need = {"primary": ["source", "locator", "quote"], "product": ["evidence"],
            "demo": ["evidence"], "indicative": ["source"], "derived": ["from", "how"],
            "unsourced": ["needed"]}
    out = []
    for e in FIGURES:
        for field in need[e["kind"]] + ["claim"]:
            if not e.get(field):
                out.append(f"{e['id']}: a {e['kind']} entry needs '{field}'")
        if e.get("source") and e["source"] not in SOURCES:
            out.append(f"{e['id']}: unknown source '{e['source']}'")
        if "verify" in e:
            got = str(e["verify"]())
            if got not in _figs(e):
                out.append(f"{e['id']}: says {_figs(e)[0]}, but counting gives {got}")
    for c in CLAIMS:
        if not c.get("evidence"):
            out.append(f"{c['id']}: a claim needs 'evidence'")
        for f in c["files"]:
            if not os.path.exists(os.path.join(ROOT, f)):
                out.append(f"{c['id']}: cites {f}, which does not exist")
    return out


def check(prs, deck):
    """Return (errors, warnings) for one built presentation."""
    errors, warnings = _well_formed(), []
    used = set()
    for n, chunks in _slides(prs):
        slide_text = " ".join(chunks).replace("\n", " ")
        lower = slide_text.lower()
        for fig in figures_in(slide_text):
            match = [e for e in FIGURES if deck in e["decks"] and fig in _figs(e)
                     and e.get("where", "").lower() in lower]
            if not match:
                errors.append(f"slide {n}: '{fig}' has no entry in deck/sources.py")
                continue
            e = match[0]
            used.add(e["id"])
            label = LABELS.get(strength(e))
            if label and label not in lower:
                errors.append(f"slide {n}: '{fig}' is {strength(e)} ({e['id']}), "
                              f"so the slide must say '{label}'")
            if strength(e) == "unsourced":
                msg = f"slide {n}: '{fig}' is unsourced ({e['id']})"
                (errors if STRICT else warnings).append(msg)
    for n, chunks in _slides(prs):
        lower = " ".join(chunks).replace("\n", " ").lower()
        for pat, why in FORBIDDEN:
            if re.search(pat, lower):
                errors.append(f"slide {n}: says '{re.search(pat, lower).group(0)}'. {why}")
    whole = " ".join(" ".join(c) for _, c in _slides(prs)).lower()
    for c in CLAIMS:
        if c["slide"].lower() not in whole:
            warnings.append(f"claim {c['id']} is registered for a slide headed "
                            f"'{c['slide']}', which is not in the deck")
    for e in FIGURES:
        if deck in e["decks"] and e["id"] not in used:
            warnings.append(f"{e['id']} is registered for '{deck}' but no slide uses it")
    return errors, warnings


def enforce(prs, deck):
    errors, warnings = check(prs, deck)
    for w in warnings:
        print(f"  sources: warning: {w}", file=sys.stderr)
    if errors:
        for e in errors:
            print(f"  sources: {e}", file=sys.stderr)
        sys.exit(f"sources: {len(errors)} problem(s). See deck/sources.py; nothing was saved.")


# ---------------------------------------------------------------- the readable register

def _q(s):
    return s.replace("|", "\\|")


def markdown():
    kinds = [("primary", "Read in the primary source"),
             ("product", "Facts about Qumo, with evidence"),
             ("demo", "Demo data (slide must say illustrative)"),
             ("indicative", "Qumo's proposed prices (slide must say indicative)"),
             ("derived", "Arithmetic on the above"),
             ("unsourced", "Open gaps")]
    out = ["# Sources for every figure in the decks", "",
           "Generated from `deck/sources.py` by `python3 deck/sources.py`. Edit that file, "
           "not this one. Every build of `deck/build_deck.py` reads "
           "the figures back out of the finished deck and refuses to save it if one is not "
           "listed here. `--strict` also refuses the open gaps: use it for any copy that goes "
           "to a brand or an investor.", ""]
    gaps = [e for e in FIGURES if strength(e) == "unsourced"]
    if gaps:
        out += ["**Open gaps, which `--strict` refuses:** " +
                ", ".join(f"{', '.join(_figs(e))} ({e['claim'][0].lower() + e['claim'][1:]})" for e in gaps) + ".", ""]
    for kind, heading in kinds:
        rows = [e for e in FIGURES if e["kind"] == kind]
        if not rows:
            continue
        out += [f"## {heading}", ""]
        if kind == "primary":
            out += ["| Figure | Claim | Where | Exact words |", "|---|---|---|---|"]
            for e in rows:
                c = f" *Caution: {e['caution']}*" if e.get("caution") else ""
                out.append(f"| {', '.join(_figs(e))} | {_q(e['claim'])} | "
                           f"{e['source']}, {e['locator']} | \"{_q(e['quote'])}\"{_q(c)} |")
        elif kind == "derived":
            out += ["| Figure | Claim | How | As strong as |", "|---|---|---|---|"]
            for e in rows:
                out.append(f"| {', '.join(_figs(e))} | {_q(e['claim'])} | {_q(e['how'])} | "
                           f"{strength(e)} |")
        elif kind == "unsourced":
            out += ["| Figure | Claim | What would close it |", "|---|---|---|"]
            for e in rows:
                out.append(f"| {', '.join(_figs(e))} | {_q(e['claim'])} | {_q(e['needed'])} |")
        else:
            out += ["| Figure | Claim | Evidence |", "|---|---|---|"]
            for e in rows:
                ev = e.get("evidence") or f"{e['source']}, {e.get('locator', '')}"
                c = f" *Caution: {e['caution']}*" if e.get("caution") else ""
                out.append(f"| {', '.join(_figs(e))} | {_q(e['claim'])} | {_q(ev)}{_q(c)} |")
        out.append("")
    out += ["## Statements without figures", "",
            "Claims on slides that carry no number, so the figure check cannot see them. The "
            "build fails if a file cited here no longer exists.", "",
            "| Claim | Shown by | How |", "|---|---|---|"]
    for c in CLAIMS:
        files = ", ".join(f"`{f}`" for f in c["files"]) or "-"
        out.append(f"| {_q(c['claim'])} | {files} | {_q(c['evidence'])} |")
    out += ["", "## Not to be claimed", "",
            "The build refuses the words for the first two (see FORBIDDEN in "
            "`deck/sources.py`). The third has no single word to catch, so it rests on this list.",
            ""]
    for what, why in NOT_CLAIMED:
        out.append(f"- **{what}.** {why}")
    out += ["", "## The sources", ""]
    for key, s in SOURCES.items():
        out.append(f"- **{key}**: {s['title']}. {s['publisher']}"
                   + (f", {s['published']}" if s.get("published") else "")
                   + f". <{s['url']}>" if s["url"].startswith("http") else
                   f"- **{key}**: {s['title']}. {s['publisher']}. `{s['url']}`")
        extra = [x for x in (f"Read {s['read']}.", s.get("fingerprint"), s.get("note")) if x]
        out[-1] += " " + " ".join(x if x.endswith(".") else x + "." for x in extra)
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    problems = _well_formed()
    if problems:
        sys.exit("\n".join(problems))
    path = os.path.join(ROOT, "docs", "sources.md")
    with open(path, "w") as f:
        f.write(markdown())
    print(f"wrote {path}")
