"""
The Qumo product overview: 23 slides, generated rather than drawn.

Run it and a pptx comes out. The point of it being code is that the deck is
regenerated from the product: every screenshot is a live render captured by
capture.mjs, so the deck cannot quietly drift from what the thing does.

    python3 deck/build_deck.py [output.pptx]

The palette, geometry and drawing primitives live in style.py, shared with
the other decks here. See README.md for the full sequence.
"""
import sys
import os
from style import *  # noqa: F403 - a deck is a drawing script, not a library
import style

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(style.HERE, "Qumo.pptx")
style.start("Product overview", 23)

# ---------------- slides ----------------

def s01():
    s = slide()
    logo(s, M, Inches(2.05), Inches(0.62))
    text(s, "Purchase loyalty, under\nthe brand's own name", M, Inches(3.05), Inches(10.5),
         Inches(1.7), size=50, bold=True, colour=INK, spacing=1.12)
    text(s, "A unique code under the pack turns a purchase into a reward, and a reward into a\n"
            "reason to come back. Built, running, and shown here as real screens rather than mockups.",
         M, Inches(5.12), Inches(9.4), Inches(0.9), size=13, colour=BODY, spacing=1.55)
    text(s, "MECHANIC  On-pack code        CHANNELS  Scan, text, tap        STATUS  Built and tested",
         M, Inches(6.12), Inches(10), Inches(0.3), size=9, colour=MUTED, font=MONO,
         spacing=1.0, spc=1.2)
    footer(s)


def s02():
    s = slide(); masthead(s); kicker(s, "The mechanic")
    h1(s, "Buy it. Scan the code under it. Earn.")
    text(s, "No app to install. No card to carry. No password to forget. A phone camera and a mobile "
            "number, which is what every customer already has in their hand while they are still "
            "holding the pack.",
         M, Inches(2.55), Inches(9.6), Inches(1.0), size=13, colour=BODY, spacing=1.55)
    stats(s, [("0", "apps to download"), ("1", "scan to earn"), ("6", "digit sign-in"),
              ("R5.00", "per pack, capped")], Inches(4.35))
    footer(s)


def s03():
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


def s04():
    part("Part one", "What the brand sees",
         "The console is Qumo's own tool and looks like it. Staff set the programme up, order the "
         "codes that go on the packs, and read what it is costing.")


def s05():
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


def s06():
    two_col(slide(), "02 · Branding", "The console will not open until it is theirs",
            ["One forced step. Pick a button colour, and the console unlocks. It is the step that "
             "decides what every customer sees for the life of the programme.",
             "What a brand cannot change is type, background and the rules, so a programme can "
             "never end up unreadable on a phone in the sun."],
            "console-settings")


def s07():
    two_col(slide(), "03 · The opening screen", "It opens on what the programme owes",
            ["Not scans. Not sign-ups. The first figure is what the programme still owes its "
             "customers, derived from the ledger rather than stored, so it can never drift from "
             "the rows behind it.",
             "The warnings underneath are unprompted. A live promotion with no ceiling can issue "
             "value until somebody notices, and the console says so rather than waiting to be asked."],
            "console-overview")


def s08():
    two_col(slide(), "04 · Promotions", "Several running, each with a ceiling",
            ["What a scan is worth, what it has issued so far, and how much of its budget is gone. "
             "Below them sits the poster QR, which signs people up and awards nothing.",
             "Per person per day, per promotion, and in total. All three are enforced in the engine "
             "at the moment of the scan, not in the interface."],
            "console-promotions")


def s09():
    two_col(slide(), "05 · The print run", "Codes ordered, then sent to the printer",
            ["A run is generated against a promotion. Every code is single-use and cannot be "
             "regenerated once printed, so a brand orders what it will actually print.",
             "The CSV carries the code, how it should be set in type, the URL to turn into a QR, "
             "and whether it has been claimed. The URL already carries the brand's own address."],
            "console-codes")


def s10():
    two_col(slide(), "06 · Proofing", "A sheet you can print and scan today",
            ["For a short run or a proof, the codes come out as a printable sheet. Scan one with "
             "your own phone before the artwork goes anywhere near a press.",
             "The readable code under each QR is not decoration. It is what a customer reads out "
             "when the label is scuffed, and what they text in when they have no data."],
            "console-labels")


def s11():
    s = slide(); masthead(s); kicker(s, "07 · Performance")
    h1(s, "The screen the programme gets judged on")
    stats(s, [("143", "scans, 30 days"), ("52%", "came back"), ("R12.97", "per person reached"),
              ("137", "people earned"), ("103", "joined this window")], Inches(2.35))
    shot(s, "console-performance", M, Inches(3.55), Inches(6.5), Inches(3.2))
    text(s, "The repeat bar splits once, twice-or-thrice and four-or-more, because the average of "
            "one scan and five scans says nothing about either group.",
         Inches(7.55), Inches(3.65), Inches(4.94), Inches(1.0), size=12, colour=BODY, spacing=1.55)
    text(s, "Both mechanics run on one engine and one ledger, so a brand can start on-pack and add "
            "the till later without changing anything a customer sees.",
         Inches(7.55), Inches(4.95), Inches(4.94), Inches(1.1), size=12, colour=MUTED, spacing=1.55)
    footer(s)


def s12():
    two_col(slide(), "08 · Stores and exposure", "Where it is running, and what is at risk",
            ["Every till that can put a code on a slip, and whether it can sign one. A store that "
             "cannot is flagged, because an unsigned till is a till where the customer controls "
             "what the slip says."],
            "console-stores")


def s13():
    s = slide(); masthead(s); kicker(s, "09 · Both themes")
    h1(s, "Light at a desk, dark at eleven at night")
    text(s, "Both are first-class and both are one click apart in the masthead. The same geometry, "
            "the same figures, the chart colours lifted to suit the ground.",
         M, Inches(2.42), Inches(10.4), Inches(0.7), size=13, colour=BODY, spacing=1.55)
    gap = Inches(0.2)
    w = Emu(int((CONTENT - gap) / 2))
    shot(s, "console-overview-dark", M, Inches(3.30), w, Inches(3.3))
    shot(s, "console-performance-dark", M + w + gap, Inches(3.30), w, Inches(3.3))
    footer(s)


def s14():
    part("Part two", "What the customer sees",
         "Every screen from here is the brand's. Their logo at the top, their colour on the button, "
         "their name on the address. Qumo appears once, in the footer, as a trust cue.")


def s15():
    s = slide(); masthead(s); kicker(s, "10 · The scan")
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


def s16():
    s = slide(); masthead(s); kicker(s, "11 · The balance")
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


def s17():
    s = slide(); masthead(s); kicker(s, "12 · The poster path")
    y = h1(s, "The same programme,\nfrom a table-talker", w=Inches(4.9))
    text(s, "It explains what is running and takes a sign-up. It awards nothing at all, which is "
            "exactly why it can be printed anywhere anybody can see it.",
         M, y + Inches(0.3), Inches(4.75), Inches(1.2), size=13, colour=BODY, spacing=1.55)
    text(s, "Earning starts at the next code that came off something bought.",
         M, y + Inches(1.65), Inches(4.75), Inches(0.5), size=12, colour=MUTED, spacing=1.55)
    phones(s, [("shopper-join", "Poster QR", "Joins, explains, never pays.")],
           x0=Inches(8.3), total=Inches(2.6))
    footer(s)


def s18():
    s = slide(); masthead(s); kicker(s, "13 · Age restricted brands")
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


def s19():
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


def s20():
    s = slide(); masthead(s); kicker(s, "Where it stands")
    h1(s, "Built, running, ready to pilot")
    text(s, "Every screen in this deck was photographed from a running build against a real "
            "database, not drawn for the occasion.",
         M, Inches(2.45), Inches(10.4), Inches(0.7), size=13, colour=BODY, spacing=1.55)
    stats(s, [("19", "screens, all real"), ("625", "tests passing"), ("84", "days of data"),
              ("5", "stores live")], Inches(3.45))
    text(s, "Which changes what a first engagement is buying. The engine is not the risk any more, "
            "so the work ahead is the decisions that are specific to one brand rather than the "
            "machinery underneath them.",
         M, Inches(4.85), Inches(10.6), Inches(1.0), size=12.5, colour=BODY, spacing=1.55)
    footer(s)


def s21():
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
                    "For premium packs or the counter"],
         "foot_label": "Works today, needs tags", "foot": "Cost per tag",
         "foot_note": "Fixed at production, whatever engagement does"},
    ], Inches(3.30))
    footer(s)


def s22():
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


def s23():
    s = slide(); masthead(s); kicker(s, "Indicative · for discussion")
    h1(s, "And what it costs if you keep it")
    text(s, "Directional only, to show the shape. The pilot is free; what follows it is a "
            "subscription, because a programme does not end the way a campaign does. Brands pay "
            "for the scale they use, and messaging is passed through at cost against a ceiling.",
         M, Inches(2.42), Inches(11.2), Inches(0.8), size=12.5, colour=BODY, spacing=1.55)
    tri_cards(s, [
        {"tag": "Tier 01", "title": "LAUNCH", "sub": "One campaign, one door",
         "points": ["Scan door", "Up to 10,000 scans a month", "Console, analytics, pack codes",
                    "One brand, one campaign"],
         "foot_label": "Per month, indicative", "foot": "R7,500", "foot_accent": True},
        {"tag": "Tier 02", "title": "PROGRAMME", "sub": "Always-on, two doors",
         "points": ["Scan and text doors", "Up to 100,000 scans a month",
                    "Campaigns and stores unlimited", "Till slips and store attribution"],
         "foot_label": "Per month, indicative", "foot": "R25,000"},
        {"tag": "Tier 03", "title": "PLATFORM", "sub": "National, all doors",
         "points": ["Scan, text and tap", "500,000+ scans a month", "CRM integration and API",
                    "Multi-brand and multi-market"],
         "foot_label": "Per month, indicative", "foot": "R60,000"},
    ], Inches(3.20))
    footer(s)


for fn in [s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12,
           s13, s14, s15, s16, s17, s18, s19, s20, s21, s22, s23]:
    fn()

print(f"{style.save(OUT)} slides -> {OUT}")
