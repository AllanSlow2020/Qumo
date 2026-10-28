"""
The Qumo pitch: eleven slides, to win a second meeting.

Not the product overview. That one answers "what does it do" and runs to
twenty-three slides; this one answers "why should a brand care, and what are
you asking me for", and is meant to be over in fifteen minutes.

    python3 deck/build_pitch.py [output.pptx]

── Three things it is built around ──────────────────────────────────────

The wedge is that brands already run on-pack promotions and get nothing
lasting from them. That is a far easier conversation than introducing a
category, so it leads.

The credibility problem is that Qumo is a new company with no customers.
The answer is the unusual thing it actually has: a working product a brand
manager can scan in the room. That gets its own slide and the close.

The ask is deliberately small. A free pilot on one product line removes
budget from the first meeting entirely, and what converts a brand is their
own numbers on the performance screen rather than anything said here.

Brands named in here are invented. Nothing implies a customer.
"""
import sys
import os
from style import *  # noqa: F403 - a deck is a drawing script, not a library
import style

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(style.HERE, "Qumo-pitch.pptx")
style.start("For brands", 11)


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
            "and the value you hand out buys a second purchase instead of a prize draw.",
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
               "The value lands on a balance they spend on the next one they buy"],
           M, Inches(3.35), Inches(10.4), size=12.5, gap=Inches(0.34))
    stats(s, [("0", "apps to download"), ("1", "scan to earn"), ("6", "digit sign-in"),
              ("You set it", "per pack, capped")], Inches(5.35))
    footer(s)


def p05():
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


def p06():
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


def p07():
    s = slide(); masthead(s); kicker(s, "Why this is not a slide deck")
    h1(s, "It is built, and you can scan one in this room")
    text(s, "Most things pitched at this stage are a concept with a timeline attached. This is a "
            "working product. Every screen in this deck is a photograph of it running, not a "
            "drawing of what it might look like.",
         M, Inches(2.5), Inches(10.6), Inches(1.0), size=13, colour=BODY, spacing=1.55)
    stats(s, [("625", "tests passing"), ("17", "screens, all real"), ("2", "ways to earn"),
              ("0", "lines of it imaginary")], Inches(3.85))
    text(s, "Ask for a code before you leave. It will be printed, it will work once, and the "
            "balance it creates will be sitting in the console when you check.",
         M, Inches(5.30), Inches(10.6), Inches(0.8), size=12.5, colour=MUTED, spacing=1.5)
    footer(s)


def p08():
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


def p09():
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
        {"tag": "Tier 03", "title": "PLATFORM", "sub": "National, all doors",
         "points": ["Scan, text and tap", "500,000+ scans a month",
                    "CRM integration and API", "Multi-brand and multi-market"],
         "foot_label": "Per month, indicative", "foot": "R60,000"},
    ], Inches(3.38), hgt=Inches(3.38))
    footer(s)


def p10():
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


def p11():
    s = slide(); masthead(s); kicker(s, "If somebody already runs your promotions")
    h1(s, "We are not asking you to cancel anything")
    text(s, "A brand running on-pack codes already has an agency or a promotions vendor, and they "
            "are good at what they do. This is where Qumo sits beside them rather than instead.",
         M, Inches(2.42), Inches(11.0), Inches(0.8), size=12.5, colour=BODY, spacing=1.55)
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
    ], Inches(3.30))
    footer(s)


for fn in [p01, p02, p03, p04, p05, p06, p07, p08, p09, p10, p11]:
    fn()

print(f"{style.save(OUT)} slides -> {OUT}")
