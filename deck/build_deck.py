"""
The Qumo deck.

Run it and a 24-slide pptx comes out. The point of it being code rather than
a file somebody drags boxes around in is that the deck is regenerated from
the product: every screenshot is a live render captured by capture.mjs, so
the deck cannot quietly drift from what the thing actually does.

    python3 deck/build_deck.py [output.pptx]

See README.md in this directory for the full sequence, including how the
screens are captured first.

── The house style ──────────────────────────────────────────────────────

Dark. Background #0D0E11, cards #16181C on #282B31 borders, one blue, and
a monospace for anything that labels rather than reads. The palette was
sampled from the original deck rather than guessed at, which is why the
values look arbitrary: they are measured, not chosen.

Light UI screenshots sit on light panels. Dropping a white screenshot
straight onto black reads as a hole in the slide.
"""
import sys
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from PIL import Image
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS, ART = os.path.join(HERE, "shots"), os.path.join(HERE, "art")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "Qumo.pptx")

BG     = RGBColor(0x0D, 0x0E, 0x11)
CARD   = RGBColor(0x16, 0x18, 0x1C)
LINE   = RGBColor(0x28, 0x2B, 0x31)
ACCENT = RGBColor(0x25, 0x63, 0xEB)
INK    = RGBColor(0xFF, 0xFF, 0xFF)
BODY   = RGBColor(0xC4, 0xCA, 0xD3)
MUTED  = RGBColor(0x8A, 0x90, 0x9B)
FOOT   = RGBColor(0x6A, 0x70, 0x80)
WARN   = RGBColor(0xFF, 0x6B, 0x7F)
PANEL  = RGBColor(0xF2, 0xF2, 0xF4)

SANS, MONO = "Arial", "Consolas"
W, H = Inches(13.333), Inches(7.5)
M = Inches(0.85)
RIGHT = Inches(12.49)
CONTENT = RIGHT - M
RULE_Y = Inches(6.90)
DECK = "Product overview"

prs = Presentation()
prs.slide_width, prs.slide_height = W, H
BLANK = prs.slide_layouts[6]
_page = {"n": 0}
TOTAL = 24


# ---------------- primitives ----------------

def slide():
    s = prs.slides.add_slide(BLANK)
    bg = s.shapes.add_shape(1, 0, 0, W, H)
    bg.fill.solid(); bg.fill.fore_color.rgb = BG
    bg.line.fill.background(); bg.shadow.inherit = False
    return s


def text(s, txt, x, y, w, h, size=13, bold=False, colour=BODY, font=SANS,
         align=PP_ALIGN.LEFT, spacing=1.5, spc=None, anchor=MSO_ANCHOR.TOP):
    tb = s.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    for i, line in enumerate(txt.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        r = p.add_run(); r.text = line
        r.font.size = Pt(size); r.font.bold = bold
        r.font.name = font; r.font.color.rgb = colour
        if spc:
            # Letter-spacing, which python-pptx does not expose. The tracked
            # out mono labels look wrong without it.
            r.font._rPr.set("spc", str(int(spc * 100)))
    return tb


def box(s, x, y, w, h, fill=CARD, border=LINE, radius=0.045):
    sh = s.shapes.add_shape(5, x, y, w, h)
    sh.fill.solid(); sh.fill.fore_color.rgb = fill
    if border is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = border; sh.line.width = Pt(1)
    sh.shadow.inherit = False
    sh.adjustments[0] = radius
    return sh


def hline(s, x, y, w, colour=LINE, thick=Emu(9525)):
    sh = s.shapes.add_shape(1, x, y, w, thick)
    sh.fill.solid(); sh.fill.fore_color.rgb = colour
    sh.line.fill.background(); sh.shadow.inherit = False


def logo(s, x, y, h, variant="white"):
    path = os.path.join(ART, f"qumo-{variant}.png")
    iw, ih = Image.open(path).size
    s.shapes.add_picture(path, x, y, height=h, width=Emu(int(h * iw / ih)))


def masthead(s):
    logo(s, M, Inches(0.40), Inches(0.21))
    text(s, DECK, M + Inches(0.68), Inches(0.41), Inches(4), Inches(0.24),
         size=10.5, colour=MUTED, spacing=1.0)


def footer(s):
    _page["n"] += 1
    hline(s, M, RULE_Y, CONTENT)
    text(s, "Qumo  ·  indicative, for discussion", M, RULE_Y + Inches(0.12),
         Inches(8), Inches(0.24), size=8, colour=FOOT, font=MONO, spacing=1.0)
    text(s, f"{_page['n']:02d} / {TOTAL}", RIGHT - Inches(2), RULE_Y + Inches(0.12),
         Inches(2), Inches(0.24), size=8, colour=FOOT, font=MONO,
         align=PP_ALIGN.RIGHT, spacing=1.0)


def kicker(s, label, colour=ACCENT, y=Inches(1.00)):
    hline(s, M, y + Inches(0.055), Inches(0.30), colour, Emu(19050))
    text(s, label.upper(), M + Inches(0.41), y - Inches(0.055), Inches(9), Inches(0.26),
         size=9, colour=colour, font=MONO, spacing=1.0, spc=1.6)


def est_lines(txt, size_pt, width_in):
    """
    How many lines a string will wrap to, near enough.

    Here because a heading placed at a fixed height is correct for one line
    and wrong for two: an early draft shipped nine slides with the second
    line of the heading printed through the paragraph under it. Arial Bold
    advances about 0.52 of the point size per character.
    """
    per_char = 0.52 * size_pt / 72
    per_line = max(1, int(width_in / per_char))
    lines, cur = 1, 0
    for word in txt.split():
        add = len(word) + (1 if cur else 0)
        if cur + add > per_line:
            lines += 1; cur = len(word)
        else:
            cur += add
    return lines


def h1(s, txt, y=Inches(1.46), size=29, w=None, colour=INK):
    lines = est_lines(txt, size, (w or CONTENT) / Inches(1))
    h = Inches(lines * size * 1.2 / 72)
    text(s, txt, M, y, w or CONTENT, h, size=size, bold=True, colour=colour, spacing=1.2)
    return y + h


def shot(s, name, x, y, max_w, max_h, panel=True, fallback=None):
    """
    A screenshot on a light panel, which is how light UI reads on black.

    `fallback` is for screens that only exist when capture.mjs was given the
    optional arguments: the deck still builds without them rather than
    dying on a missing file halfway through.
    """
    path = os.path.join(SHOTS, f"{name}.png")
    if not os.path.exists(path) and fallback:
        path = os.path.join(SHOTS, f"{fallback}.png")
    iw, ih = Image.open(path).size
    pad = Inches(0.09) if panel else Inches(0)
    scale = min((max_w - 2 * pad) / iw, (max_h - 2 * pad) / ih)
    w, h = Emu(int(iw * scale)), Emu(int(ih * scale))
    cx = x + Emu(int((max_w - w - 2 * pad) / 2)) + pad
    if panel:
        box(s, cx - pad, y, w + 2 * pad, h + 2 * pad, fill=PANEL, border=None, radius=0.03)
    s.shapes.add_picture(path, cx, y + pad, width=w, height=h)
    return h + 2 * pad


def stats(s, items, y, x=None, total_w=None, gap=Inches(0.16), hgt=Inches(0.95)):
    x = x if x is not None else M
    total_w = total_w if total_w is not None else CONTENT
    n = len(items)
    w = Emu(int((total_w - gap * (n - 1)) / n))
    for i, (value, label) in enumerate(items):
        cx = x + Emu(int((w + gap) * i))
        box(s, cx, y, w, hgt)
        text(s, value, cx + Inches(0.22), y + Inches(0.15), w - Inches(0.44), Inches(0.42),
             size=22, bold=True, colour=ACCENT if i == 0 else INK, spacing=1.0)
        text(s, label.upper(), cx + Inches(0.22), y + Inches(0.62), w - Inches(0.44), Inches(0.24),
             size=8, colour=MUTED, font=MONO, spacing=1.0, spc=1.2)


def dotted(s, items, x, y, w, size=11.5, gap=Inches(0.255), colour=BODY):
    for i, item in enumerate(items):
        top = y + Emu(int(gap * i))
        text(s, "·", x, top, Inches(0.16), gap, size=size, colour=MUTED, spacing=1.35)
        text(s, item, x + Inches(0.21), top, w - Inches(0.21), gap, size=size,
             colour=colour, spacing=1.35)
    return y + Emu(int(gap * len(items)))


def rows(s, pairs, y, label_w=Inches(3.3), gap=Inches(0.84), size=12):
    for i, (label, value) in enumerate(pairs):
        top = y + Emu(int(gap * i))
        hline(s, M, top, CONTENT)
        text(s, label, M, top + Inches(0.14), label_w, Inches(0.3), size=size,
             bold=True, colour=INK, spacing=1.35)
        text(s, value, M + label_w + Inches(0.1), top + Inches(0.14),
             CONTENT - label_w - Inches(0.1), gap - Inches(0.2), size=size,
             colour=BODY, spacing=1.45)


def tri_cards(s, cards, y, hgt=Inches(3.45), highlight=0):
    gap = Inches(0.22)
    w = Emu(int((CONTENT - gap * 2) / 3))
    for i, c in enumerate(cards):
        x = M + Emu(int((w + gap) * i))
        on = i == highlight
        box(s, x, y, w, hgt, border=ACCENT if on else LINE)
        px, pw = x + Inches(0.26), w - Inches(0.52)
        text(s, c["tag"].upper(), px, y + Inches(0.24), pw, Inches(0.24), size=8,
             colour=ACCENT if on else MUTED, font=MONO, spacing=1.0, spc=1.2)
        text(s, c["title"], px, y + Inches(0.54), pw, Inches(0.42), size=19, bold=True,
             colour=INK, spacing=1.1)
        text(s, c["sub"], px, y + Inches(1.02), pw, Inches(0.28), size=11, colour=BODY, spacing=1.2)
        # Tight enough that five points still clear the divider below them.
        dotted(s, c["points"], px, y + Inches(1.32), pw, size=10, gap=Inches(0.225))
        hline(s, px, y + hgt - Inches(0.92), pw)
        text(s, c["foot_label"].upper(), px, y + hgt - Inches(0.80), pw, Inches(0.24),
             size=8, colour=ACCENT if on else MUTED, font=MONO, spacing=1.0, spc=1.2)
        text(s, c["foot"], px, y + hgt - Inches(0.54), pw, Inches(0.3), size=14, bold=True,
             colour=ACCENT if on and c.get("foot_accent") else INK, spacing=1.15)
        if c.get("foot_note"):
            text(s, c["foot_note"], px, y + hgt - Inches(0.26), pw, Inches(0.24), size=9,
                 colour=MUTED, spacing=1.1)


def two_col(s, kick, title, paras, shot_name, shot_y=Inches(1.75), shot_h=Inches(4.3)):
    masthead(s); kicker(s, kick)
    y = h1(s, title, w=Inches(4.9))
    ty = y + Inches(0.22)
    for i, p in enumerate(paras):
        size = 13 if i == 0 else 12
        hh = Inches(est_lines(p, size, 4.6) * size * 1.55 / 72)
        text(s, p, M, ty, Inches(4.75), hh, size=size,
             colour=BODY if i == 0 else MUTED, spacing=1.55)
        ty += hh + Inches(0.26)
    shot(s, shot_name, Inches(6.06), shot_y, Inches(6.43), shot_h)
    footer(s)


def phones(s, items, y=Inches(1.70), h=Inches(3.85), x0=Inches(6.06), total=Inches(6.43)):
    gap = Inches(0.14)
    w = Emu(int((total - gap * (len(items) - 1)) / len(items)))
    for i, (name, cap, sub) in enumerate(items):
        x = x0 + Emu(int((w + gap) * i))
        used = shot(s, name, x, y, w, h, fallback="shopper-wallet")
        text(s, cap, x, y + used + Inches(0.16), w, Inches(0.26), size=12, bold=True,
             colour=INK, spacing=1.2)
        text(s, sub, x, y + used + Inches(0.44), w, Inches(0.26), size=10.5,
             colour=MUTED, spacing=1.2)


def part(kick, title, body):
    s = slide(); masthead(s)
    kicker(s, kick, y=Inches(2.56))
    h1(s, title, y=Inches(3.02), size=44)
    text(s, body, M, Inches(4.62), Inches(9.6), Inches(0.9), size=13, colour=BODY, spacing=1.55)
    footer(s)


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
    ], M, y + Inches(1.45), Inches(6.0), size=11.5, gap=Inches(0.42))
    text(s, "Nothing at all is kept about somebody refused. It records that you asked and that you "
            "refused when told no, which is what a promotion is expected to do. It is not identity "
            "verification, and the console says so above the tick box rather than letting a brand "
            "assume otherwise.",
         M, Inches(5.62), Inches(6.0), Inches(1.0), size=11, colour=MUTED, spacing=1.45)
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
    s = slide(); masthead(s); kicker(s, "The commercial architecture")
    h1(s, "Three gates, and you only commit to the next one")
    text(s, "Define before we build. Build before we scale. Scale what proves value. Which doors a "
            "pilot opens is one of the decisions DEFINE makes, and each is priced once its "
            "requirements are known rather than estimated now.",
         M, Inches(2.42), Inches(11.2), Inches(0.8), size=12.5, colour=BODY, spacing=1.55)
    tri_cards(s, [
        {"tag": "Stage 01", "title": "DEFINE", "sub": "Pilot blueprint",
         "points": ["Pilot architecture and cohort", "Consumer journey", "Connected packaging",
                    "Loyalty and reward logic", "Measurement and Stage 02 scope"],
         "foot_label": "Excl. VAT · fixed fee", "foot": "Quoted per brief", "foot_accent": True},
        {"tag": "Stage 02", "title": "BUILD", "sub": "Prototype and pilot",
         "points": ["Services against approved SOW", "Technology and specialist partners",
                    "Production and packaging", "Quoted, or passed through"],
         "foot_label": "After define", "foot": "Scoped"},
        {"tag": "Stage 03", "title": "SCALE", "sub": "Rollout and optimise",
         "points": ["Agreed against scale", "Platform and usage model",
                    "Production priced on volume", "Licence structure agreed"],
         "foot_label": "On pilot results", "foot": "Agreed"},
    ], Inches(3.30))
    footer(s)


def s23():
    s = slide(); masthead(s); kicker(s, "Stage 01 · what it covers")
    h1(s, "What a blueprint fee covers, and what it does not")
    gap = Inches(0.28)
    w = Emu(int((CONTENT - gap) / 2))
    for i, (tag, title, items, colour) in enumerate([
        ("Included", "Professional services",
         ["Innovation and system architecture", "Connected experience development",
          "Pilot architecture and commercialisation", "The pilot blueprint itself",
          "Indicative Stage 02 build budget"], ACCENT),
        ("Excluded until scoped", "Third-party costs",
         ["Technology development, platform and CRM fees", "SMS, USSD and messaging traffic",
          "Packaging and point-of-sale production, logistics", "Rewards, fulfilment and media",
          "Specialist technical partners and external research"], WARN),
    ]):
        x = M + Emu(int((w + gap) * i))
        box(s, x, Inches(2.42), w, Inches(2.75))
        text(s, tag.upper(), x + Inches(0.4), Inches(2.68), w - Inches(0.8), Inches(0.24),
             size=8, colour=colour, font=MONO, spacing=1.0, spc=1.2)
        text(s, title, x + Inches(0.4), Inches(2.98), w - Inches(0.8), Inches(0.36),
             size=17, bold=True, colour=INK, spacing=1.1)
        dotted(s, items, x + Inches(0.4), Inches(3.52), w - Inches(0.8), size=11, gap=Inches(0.29))
    text(s, "Splitting them this way keeps contingency out of the numbers: a cost nobody can size "
            "yet is named and quoted when it can be, rather than padded into a figure today. No "
            "blanket revenue share is assumed.",
         M, Inches(5.40), Inches(11.4), Inches(0.7), size=11.5, colour=MUTED, spacing=1.5)
    text(s, "THE WAY FORWARD", M, Inches(6.14), Inches(4), Inches(0.24), size=8, colour=ACCENT,
         font=MONO, spacing=1.0, spc=1.2)
    text(s, "Align scope   →   Confirm Stage 01   →   Issue SOW   →   Commence DEFINE",
         M, Inches(6.42), Inches(11.4), Inches(0.34), size=14, bold=True, colour=INK, spacing=1.1)
    footer(s)


def s24():
    s = slide(); masthead(s); kicker(s, "Indicative · for discussion")
    h1(s, "And what running it costs once it is live")
    text(s, "Directional only, to show the shape. The pilot is a project; the programme that "
            "follows it is a subscription. Brands pay for the scale they use, the tier decides which "
            "doors are open, and messaging is passed through at cost against an agreed ceiling.",
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
           s13, s14, s15, s16, s17, s18, s19, s20, s21, s22, s23, s24]:
    fn()

prs.save(OUT)
print(f"{_page['n']} slides -> {OUT}")
