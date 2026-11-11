"""
The Qumo deck: one presentation, a twelve-slide pitch and an appendix behind it.

    python3 deck/build_deck.py [output.pptx] [--strict]

The pitch is the first twelve slides, meant to be over in fifteen minutes. It
answers "why should a brand care, and what are you asking me for". Everything
after the close is appendix: what the brand sees, what the customer sees, and
the questions that come next. It is there to be turned to when somebody asks,
and to leave behind afterwards, not to be presented.

── Three things the pitch is built around ───────────────────────────────

The wedge is that brands already run on-pack promotions and get nothing
lasting from them. That is a far easier conversation than introducing a
category, so it leads.

The credibility problem is that Qumo is a new company with no customers.
The answer is the unusual thing it actually has: a working product a brand
manager can scan in the room. That gets its own slide and the close, and
the appendix is every screen of it.

The ask is deliberately small. A free pilot on one product line removes
budget from the first meeting entirely, and what converts a brand is their
own numbers on the performance screen rather than anything said here.

Brands named in here are invented. Nothing implies a customer. Every figure
is checked against deck/sources.py when the deck is built.
"""
import sys
import os
from style import *  # noqa: F403 - a deck is a drawing script, not a library
import style

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
OUT = ARGS[0] if ARGS else os.path.join(style.HERE, "Qumo.pptx")


def p01():
    s = slide()
    logo(s, M, Inches(2.05), Inches(0.62))
    text(s, "You have never met\nthe people who buy you", M, Inches(3.05), Inches(10.5),
         Inches(1.7), size=50, bold=True, colour=INK, spacing=1.12)
    text(s, "Qumo turns a code under the pack into a customer you can reach, under your own name,\n"
            "without an app and without a loyalty card.",
         M, Inches(5.12), Inches(9.8), Inches(0.9), size=13, colour=BODY, spacing=1.55)
    text(s, "PURCHASE LOYALTY        FOR BRANDS SOLD THROUGH SOMEBODY ELSE'S SHELF",
         M, Inches(6.12), Inches(10), Inches(0.3), size=9, colour=MUTED, font=MONO,
         spacing=1.0, spc=1.2)
    footer(s)


def p02():
    s = slide(); masthead(s); kicker(s, "The problem")
    h1(s, "Your product is bought by a stranger")
    text(s, "They pick it off a shelf in a shop you do not own and pay at a till you cannot see. "
            "No name, no number, no second conversation. The retailer knows who they are. You do not.",
         M, Inches(2.55), Inches(10.2), Inches(1.0), size=13, colour=BODY, spacing=1.55)
    text(s, "78% say their loyalty programme significantly influences where they buy groceries.",
         M, Inches(3.42), Inches(11.0), Inches(0.4), size=13, bold=True, colour=INK, spacing=1.3)
    cards = [
        ("The retailer keeps them", "Clicks, Pick n Pay and Checkers run the loyalty card. What "
         "it learns about your buyer stays with them."),
        ("A draw collects entries", "One act, by one person, on one day. It does not tell you who "
         "buys twice, and it does not move anybody to."),
        ("An app is a second ask", "Nobody downloads one to claim five rand, and the data costs "
         "money before the reward arrives."),
    ]
    gap = Inches(0.24)
    w = Emu(int((CONTENT - gap * 2) / 3))
    for i, (t, b) in enumerate(cards):
        x = M + Emu(int((w + gap) * i))
        box(s, x, Inches(4.05), w, Inches(2.1))
        text(s, t, x + Inches(0.3), Inches(4.32), w - Inches(0.6), Inches(0.34), size=14,
             bold=True, colour=INK, spacing=1.15)
        text(s, b, x + Inches(0.3), Inches(4.80), w - Inches(0.6), Inches(1.1), size=11.5,
             colour=MUTED, spacing=1.35)
    cite(s, "Truth and BrandMapp Loyalty Whitepaper 2025/6, p. 24. Economically active: household "
            "income of R10,000 a month or more.", Inches(6.40))
    footer(s)


def p03():
    s = slide(); masthead(s); kicker(s, "The opening")
    h1(s, "You are already paying for this, and getting nothing back")
    text(s, "A managed on-pack promotion in this market starts around R40,000. Codes under caps, a "
            "short code to text, a draw at the end of the quarter. Run two a year and that is "
            "R80,000 of print and prize money spent on finding out nothing.",
         M, Inches(2.55), Inches(10.6), Inches(1.0), size=13, colour=BODY, spacing=1.55)
    box(s, M, Inches(3.95), CONTENT, Inches(1.5), border=ACCENT)
    text(s, "And then the campaign ends and you have a spreadsheet of entrants you will never "
            "speak to again.",
         M + Inches(0.42), Inches(4.30), CONTENT - Inches(0.84), Inches(0.8), size=20, bold=True,
         colour=INK, spacing=1.25)
    text(s, "Qumo is the same print run, the same code under the pack, and the same budget. What "
            "changes is that the code opens your own page, the person is recognised the next time, "
            "and the value you hand out stays on a balance with your brand instead of going to a "
            "prize draw.",
         M, Inches(5.75), Inches(11.2), Inches(0.8), size=12.5, colour=MUTED, spacing=1.5)
    footer(s)


def p04():
    s = slide(); masthead(s); kicker(s, "The mechanic")
    h1(s, "Buy it. Scan the code under it. Earn.")
    text(s, "No app to install. No card to carry. No password to forget. A phone camera and a "
            "mobile number, which is what every customer already has in their hand while they are "
            "still holding the pack.",
         M, Inches(2.55), Inches(9.6), Inches(1.0), size=13, colour=BODY, spacing=1.55)
    dotted(s, ["They buy the pack in whatever shop they already buy it in",
               "They scan the code printed under the cap, the label or the lid",
               "A mobile number and a texted code, once, and never again after that",
               "The value lands on a balance with your brand, from the first scan"],
           M, Inches(3.35), Inches(10.4), size=12.5, gap=Inches(0.34))
    stats(s, [("0", "apps to download"), ("1", "scan to earn"), ("6", "digit sign-in"),
              ("You set it", "per pack, capped")], Inches(5.35))
    footer(s)


def p05():
    s = slide(); masthead(s); kicker(s, "Whether anybody will bother")
    h1(s, "Nobody here needs an eleventh loyalty card")
    # Every figure on this slide is read from the whitepaper itself, not from coverage of it:
    # 85% on p. 9, 10.4 and 4.6 on pp. 12-13. Sources and exact sentences are in
    # docs/competitive-position.md, section 8. Do not add a figure here that is not in it.
    text(s, "Loyalty is not a new idea to a South African shopper. The 2025/6 Truth and BrandMapp "
            "whitepaper finds 85% of economically active South Africans in a programme, using "
            "more than ten each. Signing people up stopped being the hard part some time ago.",
         M, Inches(2.42), Inches(11.4), Inches(1.0), size=13, colour=BODY, spacing=1.55)
    stats(s, [
        ("85%", "already in a programme"),
        ("10.4", "programmes per person"),
        ("4.6", "the same figure in 2015"),
    ], Inches(3.58))
    box(s, M, Inches(4.78), CONTENT, Inches(1.02), border=ACCENT)
    text(s, "The contest is not whether somebody joins. It is whether they are still using it "
            "three months later.",
         M + Inches(0.42), Inches(5.00), CONTENT - Inches(0.84), Inches(0.6), size=16, bold=True,
         colour=INK, spacing=1.3)
    text(s, "Which argues for this rather than against it. A Qumo account is not an eleventh "
            "programme: it is one account across every brand on the platform, so somebody joining "
            "your promotion may already have it.",
         M, Inches(5.98), Inches(11.4), Inches(0.6), size=12, colour=MUTED, spacing=1.45)
    cite(s, "Truth and BrandMapp Loyalty Whitepaper 2025/6, pp. 9 and 12-13. Economically "
            "active: household income of R10,000 a month or more.", Inches(6.56))
    footer(s)


def p05b():
    s = slide(); masthead(s); kicker(s, "What shoppers say they want")
    h1(s, "Cash, straight away, and nothing to work out")
    text(s, "Asked what they would most enjoy from a loyalty programme, South Africans have put real "
            "cashback first since the study began. Close behind it is a reward that arrives at "
            "once, rather than after a threshold.",
         M, Inches(2.42), Inches(11.4), Inches(1.0), size=13, colour=BODY, spacing=1.55)
    stats(s, [
        ("45%", "name real cashback, the top answer"),
        ("40%", "want rewarding instantly"),
        ("37%", "want points usable as cash"),
    ], Inches(3.58))
    box(s, M, Inches(4.78), CONTENT, Inches(1.02), border=ACCENT)
    text(s, "A Qumo reward is credited the moment the code is scanned, from the first pack.",
         M + Inches(0.42), Inches(5.00), CONTENT - Inches(0.84), Inches(0.6), size=16, bold=True,
         colour=INK, spacing=1.3)
    text(s, "Not built yet: spending that balance at a till. A pilot is where a brand decides how "
            "its customers redeem.",
         M, Inches(5.98), Inches(11.4), Inches(0.6), size=12, colour=MUTED, spacing=1.45)
    cite(s, "Truth and BrandMapp Loyalty Whitepaper 2025/6, pp. 22, 58 and 60. Economically active: "
            "household income of R10,000 a month or more. Several answers allowed.", Inches(6.56))
    footer(s)


def p06():
    s = slide(); masthead(s); kicker(s, "Whose programme it is")
    y = h1(s, "It is your brand\non the page, not ours", w=Inches(4.9))
    text(s, "Your name at the top, your colour on the button, your address in the bar. Qumo is one "
            "line in the footer, which is there so a customer knows who is holding their number.",
         M, y + Inches(0.3), Inches(4.75), Inches(1.4), size=13, colour=BODY, spacing=1.55)
    text(s, "Your customers are yours. No other brand sees them, and there is no cross-brand list "
            "for anybody to buy. How POPIA responsibility splits between you and us is in the "
            "agreement.",
         M, y + Inches(1.9), Inches(4.75), Inches(1.3), size=12, colour=MUTED, spacing=1.55)
    phones(s, [("shopper-join", "Poster", "Explains, signs up, pays nothing."),
               ("shopper-login", "Sign in", "A number and a texted code."),
               ("shopper-scan", "Earned", "Worth, then balance.")])
    footer(s)


def p07():
    s = slide(); masthead(s); kicker(s, "What you get back")
    h1(s, "Who came back, what it cost, and what you still owe")
    stats(s, [("52%", "came back"), ("R12.97", "per person reached"), ("137", "people earned"),
              ("R3,155", "still owed")], Inches(2.35))
    text(s, "FIGURES ILLUSTRATIVE  ·  THE SCREEN BELOW IS A PHOTOGRAPH OF THE CONSOLE",
         M, Inches(3.42), Inches(9), Inches(0.22), size=8, colour=FOOT, font=MONO,
         spacing=1.0, spc=1.2)
    shot(s, "console-performance", M, Inches(3.70), Inches(6.5), Inches(2.95))
    text(s, "Not impressions and not entries. The repeat rate splits once from four-or-more, "
            "because the average of one scan and five says nothing about either group.",
         Inches(7.55), Inches(3.80), Inches(4.94), Inches(1.1), size=12, colour=BODY, spacing=1.55)
    text(s, "The first figure on the first screen is what the programme owes your customers, so "
            "your finance director has an answer before they ask for one. Every promotion carries "
            "a ceiling, and the engine enforces it at the moment of the scan.",
         Inches(7.55), Inches(5.20), Inches(4.94), Inches(1.3), size=12, colour=MUTED, spacing=1.55)
    footer(s)


def p08():
    s = slide(); masthead(s); kicker(s, "Why this is not a slide deck")
    h1(s, "It is built, and you can scan one in this room")
    text(s, "Most things pitched at this stage are a concept with a timeline attached. This is a "
            "working product. Every screen in this deck is a photograph of it running, not a "
            "drawing of what it might look like.",
         M, Inches(2.5), Inches(10.6), Inches(1.0), size=13, colour=BODY, spacing=1.55)
    stats(s, [("800+", "tests passing"), ("17", "screens, all real"), ("2", "ways to earn"),
              ("0", "lines of it imaginary")], Inches(3.85))
    text(s, "Ask for a code before you leave. It will be printed, it will work once, and the "
            "balance it creates will be sitting in the console when you check.",
         M, Inches(5.30), Inches(10.6), Inches(0.8), size=12.5, colour=MUTED, spacing=1.5)
    footer(s)


def p09():
    s = slide(); masthead(s); kicker(s, "The ask")
    h1(s, "One product line, one print run, no invoice")
    text(s, "The fastest way to find out whether this works for you is to run it, so the first one "
            "is free. We are not asking for budget in this meeting.",
         M, Inches(2.42), Inches(11.0), Inches(0.8), size=12.5, colour=BODY, spacing=1.55)
    tri_cards(s, [
        {"tag": "We cover", "title": "THE PLATFORM", "sub": "Everything but the paper",
         "points": ["The codes, generated and single-use", "Your branded pages and console",
                    "Setting up the promotion with you", "Reading the numbers back with you"],
         "foot_label": "Your cost", "foot": "Nothing", "foot_accent": True},
        {"tag": "You cover", "title": "THE PRINT", "sub": "What you already print",
         "points": ["Codes onto one product line", "Your existing print run and vendor",
                    "The reward you choose to give", "One person we can ask questions"],
         "foot_label": "Your commitment", "foot": "One line"},
        {"tag": "You get", "title": "THE ANSWER", "sub": "Your own numbers",
         "points": ["How many scanned, and how many twice", "What it cost per person reached",
                    "What it would cost at full range", "The data, yours to keep either way"],
         "foot_label": "Time to a number", "foot": "One print cycle"},
    ], Inches(3.38), hgt=Inches(3.38))
    footer(s)


def p10():
    s = slide(); masthead(s); kicker(s, "Indicative · for discussion")
    h1(s, "And what it costs if you keep it")
    text(s, "Two managed promotions a year costs about R80,000 and ends twice. Launch is R90,000 a "
            "year and does not end. Directional figures, to show the shape: a subscription rather "
            "than a project, because a programme has no closing date.",
         M, Inches(2.42), Inches(11.0), Inches(0.8), size=12.5, colour=BODY, spacing=1.55)
    tri_cards(s, [
        {"tag": "Tier 01", "title": "LAUNCH", "sub": "One campaign, one door",
         "points": ["Scan door", "Up to 10,000 scans a month",
                    "Console, analytics, pack codes", "One brand, one campaign"],
         "foot_label": "Per month, indicative", "foot": "R7,500", "foot_accent": True},
        {"tag": "Tier 02", "title": "PROGRAMME", "sub": "Always-on, two doors",
         "points": ["Scan and text doors", "Up to 100,000 scans a month",
                    "Campaigns and stores unlimited", "Till slips and store attribution"],
         "foot_label": "Per month, indicative", "foot": "R25,000"},
        {"tag": "Tier 03", "title": "PLATFORM", "sub": "National, every door",
         "points": ["Scan, text and tap", "500,000+ scans a month",
                    "Photographed slips, when switched on", "Several brands on one account"],
         "foot_label": "Per month, indicative", "foot": "R60,000",
         "foot_note": "CRM and API are on the roadmap"},
    ], Inches(3.38), hgt=Inches(3.38))
    footer(s)


def p11():
    s = slide()
    logo(s, M, Inches(2.2), Inches(0.62))
    text(s, "Give us one line and\none print run", M, Inches(3.15), Inches(10.4),
         Inches(1.5), size=46, bold=True, colour=INK, spacing=1.14)
    text(s, "We will have your first real numbers inside one print cycle, and you will not have "
            "spent anything to find out.",
         M, Inches(5.08), Inches(9.4), Inches(0.9), size=14.5, colour=BODY, spacing=1.45)
    text(s, "qumo.co.za", M, Inches(6.02), Inches(6), Inches(0.36), size=15, bold=True,
         colour=ACCENT, font=MONO, spacing=1.0)
    footer(s)


def p12():
    s = slide(); masthead(s); kicker(s, "If somebody already runs your promotions")
    h1(s, "We are not asking you to cancel anything")
    text(s, "A brand running on-pack codes already has an agency, and shoppers like draws: the mass "
            "market ranks competition entries third of what it would most enjoy, at 38%. Qumo sits "
            "beside that, not instead of it.",
         M, Inches(2.42), Inches(11.0), Inches(1.0), size=12.5, colour=BODY, spacing=1.55)
    rows(s, [
        ("What they do well",
         "The mechanic, the prize fulfilment, the winner admin and the paperwork a draw needs."),
        ("What ends with it",
         "The list. An entry is somebody who wanted a car, on one day, in one month. Next quarter "
         "starts from nothing again."),
        ("Where we sit",
         "Under the same print run. The code opens your page instead of a draw entry, and the "
         "person is still there in six months."),
        ("Run both if you like",
         "One code can carry a draw and a balance. We would rather be the half that keeps the "
         "customer than the half that picks a winner."),
    ], Inches(3.40), gap=Inches(0.78))
    cite(s, "Truth and BrandMapp Loyalty Whitepaper 2025/6, p. 59. Mass market: household income "
            "under R10,000 a month. Several answers allowed.", Inches(6.56))
    footer(s)


def p13():
    s = slide(); masthead(s); kicker(s, "If somebody asks about cards")
    h1(s, "Most South Africans still reach for a card")
    stats(s, [("64%", "card, economically active"), ("33%", "phone number, same group"),
              ("72%", "card, mass market"), ("32%", "phone number, same group")], Inches(2.35))
    rows(s, [
        ("Why", "The whitepaper's own reading is \"ongoing challenges with data access, cellphone "
         "reception and data costs\". A card works when the data does not."),
        ("What we ask for", "A cellphone number. In the mass market it is the second most named "
         "way into a programme, ahead of an app at 27%."),
        ("What it still needs", "A camera and data, to scan. The text door, for a phone without "
         "data, is built and needs a short code before it is live."),
        ("What we will not do", "Issue a card. A card per brand is the eleventh card nobody "
         "needs."),
    ], Inches(3.55), gap=Inches(0.74))
    cite(s, "Truth and BrandMapp Loyalty Whitepaper 2025/6, pp. 64-67. The question: how South "
            "Africans prefer to make use of a loyalty programme. Several answers allowed.",
         Inches(6.56))
    footer(s)


# ---------------- appendix ----------------
# Turned to when somebody asks, and left behind afterwards. Not presented.

def a_brand():
    part("Appendix · Part one", "What the brand sees",
         "The console is Qumo's own tool and looks like it. Staff set the programme up, order the "
         "codes that go on the packs, and read what it is costing.")


def a_customer():
    part("Appendix · Part two", "What the customer sees",
         "Every screen from here is the brand's. Their logo at the top, their colour on the button, "
         "their name on the address. Qumo appears once, in the footer, as a trust cue.")


def a_questions():
    part("Appendix · Part three", "The questions that come next",
         "What stops a code paying twice, how shoppers' data is protected, how somebody without "
         "data takes part, why there is no card, where a draw fits, and what a pilot involves "
         "week by week.")


def a03():
    s = slide(); masthead(s); kicker(s, "The decision that makes it safe")
    h1(s, "Two kinds of QR, and only one of them pays")
    gap = Inches(0.28)
    w = Emu(int((CONTENT - gap) / 2))
    for i, (tag, title, points, verdict, colour) in enumerate([
        ("Poster, table talker, shelf tag", "One static code",
         ["Anyone who walks past can scan it", "Proves nothing about a purchase",
          "Explains the promotion, takes a sign-up"], "Awards nothing, ever.", WARN),
        ("Printed under the pack", "Unique, single-use code",
         ["One code per unit, and it works exactly once", "Possession of the pack is the proof",
          "Burned inside a serialisable transaction"], "This is what pays.", ACCENT),
    ]):
        x = M + Emu(int((w + gap) * i))
        box(s, x, Inches(2.42), w, Inches(3.0), border=ACCENT if i else LINE)
        text(s, tag.upper(), x + Inches(0.4), Inches(2.70), w - Inches(0.8), Inches(0.24),
             size=8, colour=MUTED, font=MONO, spacing=1.0, spc=1.2)
        text(s, title, x + Inches(0.4), Inches(3.02), w - Inches(0.8), Inches(0.36),
             size=18, bold=True, colour=INK, spacing=1.1)
        dotted(s, points, x + Inches(0.4), Inches(3.62), w - Inches(0.8), size=11.5, gap=Inches(0.32))
        text(s, verdict, x + Inches(0.4), Inches(4.86), w - Inches(0.8), Inches(0.3),
             size=13, bold=True, colour=colour, spacing=1.2)
    text(s, "A poster that awards value awards it to everybody who walks past it. Keeping the two "
            "jobs apart is what lets a brand print the poster anywhere.",
         M, Inches(5.68), Inches(11.2), Inches(0.6), size=12, colour=MUTED, spacing=1.5)
    footer(s)


def a05():
    s = slide(); masthead(s); kicker(s, "01 · Getting in")
    y = h1(s, "Invited, never self-signed", w=Inches(4.9))
    text(s, "There is no open sign-up. The subdomain a customer will trust is handed out "
            "deliberately, not claimed by whoever types the name in first.",
         M, y + Inches(0.24), Inches(4.75), Inches(1.1), size=13, colour=BODY, spacing=1.55)
    text(s, "Staff and shoppers are separate accounts, separate tables, separate cookies, on "
            "separate hostnames. Neither can reach the other's screens.",
         M, y + Inches(1.5), Inches(4.75), Inches(1.1), size=12, colour=MUTED, spacing=1.55)
    gap = Inches(0.16)
    w = Emu(int((Inches(6.43) - gap) / 2))
    shot(s, "console-provision", Inches(6.06), Inches(2.05), w, Inches(3.4))
    shot(s, "console-login", Inches(6.06) + w + gap, Inches(2.05), w, Inches(3.4))
    footer(s)


def a06():
    two_col(slide(), "02 · Branding", "The console will not open until it is theirs",
            ["One forced step. Pick a button colour, and the console unlocks. It is the step that "
             "decides what every customer sees for the life of the programme.",
             "What a brand cannot change is type, background and the rules, so a programme can "
             "never end up unreadable on a phone in the sun."],
            "console-settings")


def a07():
    two_col(slide(), "03 · The opening screen", "It opens on what the programme owes",
            ["Not scans. Not sign-ups. The first figure is what the programme still owes its "
             "customers, derived from the ledger rather than stored, so it can never drift from "
             "the rows behind it.",
             "The warnings underneath are unprompted. A live promotion with no ceiling can issue "
             "value until somebody notices, and the console says so rather than waiting to be asked."],
            "console-overview")


def a08():
    two_col(slide(), "04 · Promotions", "Several running, each with a ceiling",
            ["What a scan is worth, what it has issued so far, and how much of its budget is gone. "
             "Below them sits the poster QR, which signs people up and awards nothing.",
             "Per person per day, per promotion, and in total. All three are enforced in the engine "
             "at the moment of the scan, not in the interface."],
            "console-promotions")


def a09():
    two_col(slide(), "05 · The print run", "Codes ordered, then sent to the printer",
            ["A run is generated against a promotion. Every code is single-use and cannot be "
             "regenerated once printed, so a brand orders what it will actually print.",
             "The CSV carries the code, how it should be set in type, the URL to turn into a QR, "
             "and whether it has been claimed. The URL already carries the brand's own address."],
            "console-codes")


def a10():
    two_col(slide(), "06 · Proofing", "A sheet you can print and scan today",
            ["For a short run or a proof, the codes come out as a printable sheet. Scan one with "
             "your own phone before the artwork goes anywhere near a press.",
             "The readable code under each QR is not decoration. It is what a customer reads out "
             "when the label is scuffed, and what they text in when they have no data."],
            "console-labels")


def a12():
    two_col(slide(), "07 · Stores and exposure", "Where it is running, and what is at risk",
            ["Every till that can put a code on a slip, and whether it can sign one. A store that "
             "cannot is flagged, because an unsigned till is a till where the customer controls "
             "what the slip says."],
            "console-stores")


def a13():
    s = slide(); masthead(s); kicker(s, "08 · Both themes")
    h1(s, "Light at a desk, dark at eleven at night")
    text(s, "Both are first-class and both are one click apart in the masthead. The same geometry, "
            "the same figures, the chart colours lifted to suit the ground.",
         M, Inches(2.42), Inches(10.4), Inches(0.7), size=13, colour=BODY, spacing=1.55)
    gap = Inches(0.2)
    w = Emu(int((CONTENT - gap) / 2))
    shot(s, "console-overview-dark", M, Inches(3.30), w, Inches(3.3))
    shot(s, "console-performance-dark", M + w + gap, Inches(3.30), w, Inches(3.3))
    footer(s)


def a15():
    s = slide(); masthead(s); kicker(s, "09 · The scan")
    y = h1(s, "Camera, number, earned", w=Inches(4.9))
    text(s, "The QR goes straight to the brand's own address. A first-timer gives a mobile number "
            "and a six-digit code, and the scan survives that detour so they land back on the code "
            "they scanned.",
         M, y + Inches(0.3), Inches(4.75), Inches(1.4), size=13, colour=BODY, spacing=1.55)
    text(s, "That last part matters: a pack code works once, so “just scan it again” is "
            "not available to them.",
         M, y + Inches(1.85), Inches(4.75), Inches(0.8), size=12, colour=MUTED, spacing=1.55)
    phones(s, [("shopper-login", "Number", "Consent taken here."),
               ("shopper-otp", "Six digits", "Nothing to reset."),
               ("shopper-scan", "Earned", "Worth, then balance.")])
    footer(s)


def a16():
    s = slide(); masthead(s); kicker(s, "10 · The balance")
    y = h1(s, "The brand's balance,\nnot a Qumo one", w=Inches(4.9))
    text(s, "A new customer has one line. Somebody four months in has a history: every scan, what "
            "it was worth, and where it came from.",
         M, y + Inches(0.3), Inches(4.75), Inches(1.2), size=13, colour=BODY, spacing=1.55)
    text(s, "They only ever see this brand here, even if the same phone scans another brand's code "
            "tomorrow. No brand sees across, and there is no cross-brand view for anyone to buy.",
         M, y + Inches(1.65), Inches(4.75), Inches(1.2), size=12, colour=MUTED, spacing=1.55)
    phones(s, [("shopper-wallet", "By day", "Every earn, in order."),
               ("shopper-wallet-dark", "At night", "Their colour, lifted.")],
           x0=Inches(6.9), total=Inches(5.59))
    footer(s)


def a17():
    s = slide(); masthead(s); kicker(s, "11 · The poster path")
    y = h1(s, "The same programme,\nfrom a table-talker", w=Inches(4.9))
    text(s, "It explains what is running and takes a sign-up. It awards nothing at all, which is "
            "exactly why it can be printed anywhere anybody can see it.",
         M, y + Inches(0.3), Inches(4.75), Inches(1.2), size=13, colour=BODY, spacing=1.55)
    text(s, "Earning starts at the next code that came off something bought.",
         M, y + Inches(1.65), Inches(4.75), Inches(0.5), size=12, colour=MUTED, spacing=1.55)
    phones(s, [("shopper-join", "Poster QR", "Joins, explains, never pays.")],
           x0=Inches(8.3), total=Inches(2.6))
    footer(s)


def a18():
    s = slide(); masthead(s); kicker(s, "12 · Age restricted brands")
    y = h1(s, "Asked once, before anything is earned", w=Inches(6.2))
    text(s, "A tick box in the console, for anything that cannot be sold to everyone. Off by "
            "default, and a brand that leaves it off never sees any of it.",
         M, y + Inches(0.26), Inches(6.0), Inches(0.9), size=13, colour=BODY, spacing=1.55)
    dotted(s, [
        "Asked after the mobile number and before anything reaches the balance",
        "Anyone under the threshold is turned away, and their code is not used up",
        "Refused in the engine, not on the screen, so no earn path can forget it",
        "The answer is kept. The date of birth is not",
    ], M, y + Inches(1.35), Inches(6.0), size=11.5, gap=Inches(0.38))
    text(s, "Nothing at all is kept about somebody refused. It records that you asked and that you "
            "refused when told no, which is what a promotion is expected to do. It is not identity "
            "verification, and the console says so above the tick box rather than letting a brand "
            "assume otherwise.",
         M, Inches(5.64), Inches(6.0), Inches(1.0), size=11, colour=MUTED, spacing=1.45)
    phones(s, [("shopper-login", "The step", "Neutral, and asked once.")],
           y=Inches(1.85), h=Inches(3.6), x0=Inches(8.6), total=Inches(2.6))
    footer(s)


def a19():
    s = slide(); masthead(s); kicker(s, "What the engine guarantees")
    h1(s, "The parts a finance director asks about")
    rows(s, [
        ("The ledger is immutable", "A balance is always the sum of its rows. No stored total "
         "exists anywhere that could disagree with the history behind it."),
        ("Every code works once", "Enforced in the database under a serialisable transaction, so "
         "two scans of one code landing together cannot both pay."),
        ("Caps are engine-level", "Per person per day, per promotion, and in total. The interface "
         "cannot talk the engine out of them."),
        ("Liability is always visible", "What the programme owes is the first figure on the first "
         "screen, and an uncapped promotion is flagged before it costs anything."),
        ("A customer can leave", "Opting out stops earning immediately, and their details can be "
         "erased on request, which is what the privacy notice actually promises."),
    ], Inches(2.42))
    footer(s)


def a_security():
    # Every statement here is registered, with the file that shows it, in CLAIMS in
    # deck/sources.py. Deliberately absent: any word like secure or hardened, restore
    # capacity, and response headers. None of those is established. See the CLAIMS note.
    s = slide(); masthead(s); kicker(s, "If procurement asks how shoppers' data is protected")
    h1(s, "Enforced in the code, not left to convention")
    text(s, "What has been done is a review of the source code, not yet a test against the "
            "running system.",
         M, Inches(2.42), Inches(11.2), Inches(0.7), size=12.5, colour=BODY, spacing=1.55)
    rows(s, [
        ("Two-factor sign-in", "Required for owner and admin accounts, and checked on every "
         "server action as well as every page. An owner cannot switch their own off, and nobody "
         "can reset their own: another owner resets a lost phone."),
        ("Inbound text messages", "Each one is checked against Twilio's request signature, which "
         "covers the sender, so a message with a forged number is refused."),
        ("Dependencies", "A known high or critical advisory in a production dependency fails the "
         "build. 8 are accepted with written reasons, all in tooling the deployed app does not "
         "load. Dependabot checks weekly."),
        ("Not done yet", "An independent penetration test against the running system, before a "
         "national brand signs. It finds different things from a code review."),
    ], Inches(3.05), gap=Inches(0.88))
    footer(s)


def a21():
    s = slide(); masthead(s); kicker(s, "The participation model")
    h1(s, "Three doors into the same programme")
    text(s, "Not three products. One engine, reached three ways, and each door added reaches people "
            "the one before it left out. In this market that is the whole argument: the barrier is "
            "not the phone, it is the data on it.",
         M, Inches(2.42), Inches(11.2), Inches(0.8), size=12.5, colour=BODY, spacing=1.55)
    tri_cards(s, [
        {"tag": "Door 01", "title": "SCAN", "sub": "Smartphone, with data",
         "points": ["Unique QR printed under the pack", "Camera opens it, the page awards it",
                    "Poster QR joins without awarding"],
         "foot_label": "Running today", "foot": "Nothing per scan",
         "foot_note": "A printed QR costs nothing to use"},
        {"tag": "Door 02", "title": "TEXT", "sub": "Any phone, no data",
         "points": ["The readable code already under the QR", "Texted to a short code instead",
                    "Same engine call, same single use"],
         "foot_label": "Engine built, needs a short code", "foot": "Cost per message",
         "foot_note": "Rises as the campaign works"},
        {"tag": "Door 03", "title": "TAP", "sub": "No camera, no typing",
         "points": ["An NFC tag holds the same address", "Tap opens it, the page awards it",
                    "One tag per item, like a pack code"],
         "foot_label": "Works today, needs tags", "foot": "Cost per tag",
         "foot_note": "Fixed at production, whatever engagement does"},
    ], Inches(3.30), hgt=Inches(3.22))
    cite(s, "Truth and BrandMapp Loyalty Whitepaper 2025/6, pp. 65-67: 72% of the mass market name "
            "a card, 27% an app, and the report blames data costs.", Inches(6.58))
    footer(s)


def a22():
    s = slide(); masthead(s); kicker(s, "How a pilot runs")
    h1(s, "One product line, free, and your own numbers at the end")
    text(s, "There is no scoping exercise to buy first. The product is built, so a pilot is a "
            "print run and a reward you choose. What a brand is really deciding at the end is "
            "whether their own repeat rate is worth paying for.",
         M, Inches(2.42), Inches(11.2), Inches(0.8), size=12.5, colour=BODY, spacing=1.55)
    tri_cards(s, [
        {"tag": "Before the print run", "title": "SET UP", "sub": "A week, mostly yours",
         "points": ["Your pages, your colour, your address",
                    "You choose the reward and the cap",
                    "We generate the codes as a print file",
                    "Your vendor prints what they already print"],
         "foot_label": "What it costs you", "foot": "Nothing", "foot_accent": True},
        {"tag": "In market", "title": "RUNNING", "sub": "One product line",
         "points": ["Customers scan the code under the pack",
                    "A number and a texted code, once",
                    "Every scan lands on the console as it happens",
                    "The cap is enforced at the scan, not after"],
         "foot_label": "Your commitment", "foot": "One line"},
        {"tag": "At the end", "title": "THE READ-BACK", "sub": "Your own numbers",
         "points": ["How many scanned, and how many came back",
                    "What it cost per person reached",
                    "What the same thing costs across the range",
                    "The data stays yours either way"],
         "foot_label": "Time to a number", "foot": "One print cycle"},
    ], Inches(3.30))
    footer(s)


PITCH = [p01, p02, p03, p04, p05, p05b, p06, p07, p08, p09, p10, p11]
APPENDIX = [a_brand, a05, a06, a07, a08, a09, a10, a12, a13,
            a_customer, a15, a16, a17, a18,
            a_questions, a03, a19, a_security, a21, p13, p12, a22]

style.start("For brands", len(PITCH) + len(APPENDIX))
for fn in PITCH + APPENDIX:
    fn()

print(f"{style.save(OUT, 'qumo')} slides -> {OUT}")
