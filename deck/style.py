"""
The Qumo house style, shared by every deck in this directory.

Palette, geometry and the drawing primitives. The palette and type are the
marketing site's dark theme, taken from its stylesheet rather than chosen:
background #0C0D10, cards #121418 and #1A1D22 on #22262D hairlines, three
greys of text, one blue (lifted to #5B9BFF where it is text), Instrument
Sans to read and Martian Mono for anything that labels or counts. Headings
end with a full stop, as the site's do.

The fonts are in fonts/ (SIL Open Font License). PowerPoint cannot embed
them, so present from the PDF, which carries them; or install the files in
fonts/ on the machine that opens the .pptx.

A deck imports this, calls `start(title, total)`, defines its slides, and
calls `save(path)`. Nothing in here knows what any particular deck says.
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS, ART = os.path.join(HERE, "shots"), os.path.join(HERE, "art")

FONTS = os.path.join(HERE, "fonts")

BG     = RGBColor(0x0C, 0x0D, 0x10)   # --bg
CARD   = RGBColor(0x12, 0x14, 0x18)   # --surface
RAISED = RGBColor(0x1A, 0x1D, 0x22)   # --raised
LINE   = RGBColor(0x22, 0x26, 0x2D)   # --hair
STRONG = RGBColor(0x2D, 0x32, 0x3A)   # --hair-strong
ACCENT = RGBColor(0x25, 0x63, 0xEB)   # --accent, for fills and rules
ACCENT_TEXT = RGBColor(0x5B, 0x9B, 0xFF)  # --accent-text, for accent as text
INK    = RGBColor(0xF7, 0xF8, 0xF8)   # --text-1
BODY   = RGBColor(0xC4, 0xCA, 0xD3)   # --text-2
MUTED  = RGBColor(0x9A, 0xA1, 0xAB)   # --text-3
FOOT   = RGBColor(0x7C, 0x82, 0x8C)
WARN   = RGBColor(0xFB, 0x71, 0x85)   # --negative
PANEL  = RGBColor(0xF2, 0xF2, 0xF4)

SANS = "Instrument Sans"
HEAD = "Instrument Sans SemiBold"   # the site's display weight is 560
MONO = "Martian Mono SemiExpanded"

# For measuring text with the real glyphs, so a heading's height is known
# rather than guessed. Keyed by (font, bold).
_TTF = {
    (SANS, False): "instrument-sans-latin-400-normal.ttf",
    (SANS, True): "instrument-sans-latin-700-normal.ttf",
    (HEAD, False): "instrument-sans-latin-600-normal.ttf",
    (HEAD, True): "instrument-sans-latin-700-normal.ttf",
    (MONO, False): "martian-mono-latin-400-normal.ttf",
    (MONO, True): "martian-mono-latin-700-normal.ttf",
}
W, H = Inches(13.333), Inches(7.5)
M = Inches(0.85)
RIGHT = Inches(12.49)
CONTENT = RIGHT - M
RULE_Y = Inches(6.90)

# Set by start(). A deck is a sequence of side effects on one presentation,
# so this is module state rather than an object nobody would subclass.
prs = None
BLANK = None
_page = {"n": 0}
TOTAL = 0
DECK = ""


def start(deck_title, total):
    """Open a presentation. `deck_title` sits beside the mark on every slide."""
    global prs, BLANK, TOTAL, DECK
    prs = Presentation()
    prs.slide_width, prs.slide_height = W, H
    BLANK = prs.slide_layouts[6]
    _page["n"] = 0
    TOTAL = total
    DECK = deck_title
    return prs


def save(path, deck):
    """Check every figure against deck/sources.py, then write. Exits without
    writing if a figure has no source, so a deck that fails is never left on disk."""
    import sources
    sources.enforce(prs, deck)
    prs.save(path)
    return _page["n"]


# ---------------- primitives ----------------

def slide():
    s = prs.slides.add_slide(BLANK)
    bg = s.shapes.add_shape(1, 0, 0, W, H)
    bg.fill.solid(); bg.fill.fore_color.rgb = BG
    bg.line.fill.background(); bg.shadow.inherit = False
    return s


def _ground_png():
    """
    The site's hero ground, drawn once: the 64px grid guides at 4% white,
    fading out down the slide, under two soft blue glows placed where the
    site places them (78%/30% and 12%/12%). An image rather than shapes,
    because PowerPoint cannot fade a line or blur a fill.
    """
    from PIL import ImageDraw, ImageFilter
    path = os.path.join(ART, "ground.png")
    if os.path.exists(path):
        return path
    pw, ph = 2400, 1350
    img = Image.new("RGBA", (pw, ph), (12, 13, 16, 255))
    glow = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for cx, cy, rx, ry, a in [(0.78, 0.30, 0.52, 0.46, 0.22), (0.12, 0.12, 0.44, 0.40, 0.11)]:
        gd.ellipse([(cx - rx * 0.7) * pw, (cy - ry * 0.7) * ph,
                    (cx + rx * 0.7) * pw, (cy + ry * 0.7) * ph], fill=(91, 155, 255, int(255 * a)))
    glow = glow.filter(ImageFilter.GaussianBlur(220))
    img.alpha_composite(glow)
    grid = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    d = ImageDraw.Draw(grid)
    step = int(pw * 0.6 / 13.333)
    for x in range(0, pw, step):
        d.line([(x, 0), (x, ph)], fill=(247, 248, 248, 12), width=2)
    for y in range(0, ph, step):
        d.line([(0, y), (pw, y)], fill=(247, 248, 248, 12), width=2)
    fade = Image.linear_gradient("L").resize((pw, ph)).point(lambda v: 255 - v)
    grid.putalpha(Image.composite(grid.getchannel("A"), Image.new("L", (pw, ph), 0), fade))
    img.alpha_composite(grid)
    img.convert("RGB").save(path, optimize=True)
    return path


def ground(s, marks=(Inches(0.62), Inches(1.15), RIGHT - Inches(0.25), Inches(6.25))):
    """The hero treatment: grid, glow, and registration crosshairs at the corners."""
    s.shapes.add_picture(_ground_png(), 0, 0, width=W, height=H)
    x0, y0, x1, y1 = marks
    arm = Inches(0.075)
    for cx, cy in [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]:
        hline(s, cx - arm, cy, arm * 2, STRONG)
        sh = s.shapes.add_shape(1, cx, cy - arm, Emu(9525), arm * 2)
        sh.fill.solid(); sh.fill.fore_color.rgb = STRONG
        sh.line.fill.background(); sh.shadow.inherit = False


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
    logo(s, M, Inches(0.40), Inches(0.21), variant="blue-white")
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


def cite(s, txt, y, w=None):
    """The source line under a slide's evidence: small, quiet, always present, one line."""
    w = w or CONTENT
    size = 7
    if text_width(txt, size, MONO) > w / Inches(1):
        raise ValueError(f"cite: too long for one line, shorten it: {txt[:60]}")
    text(s, txt, M, y, w, Inches(0.22), size=size, colour=FOOT, font=MONO, spacing=1.0)


def kicker(s, label, colour=MUTED, y=Inches(1.00)):
    """The site's eyebrow: mono, upper case, tracked, in the quiet grey, after a short blue rule."""
    hline(s, M, y + Inches(0.06), Inches(0.30), ACCENT, Emu(19050))
    text(s, label.upper(), M + Inches(0.41), y - Inches(0.03), Inches(10), Inches(0.24),
         size=8, colour=colour, font=MONO, spacing=1.0, spc=0.5)


def _font(font, bold, size):
    from PIL import ImageFont
    return ImageFont.truetype(os.path.join(FONTS, _TTF[(font, bold)]), int(size * 10))


def text_width(txt, size, font=SANS, bold=False):
    """Width of one line in inches, from the real font's advance widths."""
    return _font(font, bold, size).getlength(txt) / 10 / 72


def est_lines(txt, size_pt, width_in, font=HEAD, bold=False):
    """
    How many lines a string will wrap to, measured with the real font.

    Here because a heading placed at a fixed height is correct for one line
    and wrong for two: an early draft shipped nine slides with the second
    line of the heading printed through the paragraph under it.

    A newline in the string is a line the author asked for, and each side
    of it wraps on its own.
    """
    f = _font(font, bold, size_pt)
    limit = width_in * 72 * 10 * 0.97   # a little slack for the renderer's own rounding
    lines = 0
    for segment in txt.split("\n"):
        lines += 1
        cur = ""
        for word in segment.split():
            trial = f"{cur} {word}" if cur else word
            if cur and f.getlength(trial) > limit:
                lines += 1; cur = word
            else:
                cur = trial
    return lines


# Instrument Sans's line box is about 1.21 times the point size before any
# line spacing multiple is applied (ascent 0.97, descent 0.24).
LINE_BOX = 1.21


def sentence(txt):
    """Headings are sentences of the story, so they end like one."""
    return txt if txt.rstrip()[-1:] in ".?:" else txt.rstrip() + "."


def h1(s, txt, y=Inches(1.46), size=29, w=None, colour=INK, lead=1.08):
    txt = sentence(txt)
    lines = est_lines(txt, size, (w or CONTENT) / Inches(1))
    h = Inches(lines * size * lead * LINE_BOX / 72)
    text(s, txt, M, y, w or CONTENT, h, size=size, colour=colour, font=HEAD, spacing=lead,
         spc=-0.012 * size)
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
    """Figures in tabular mono, as the site sets anything it counts."""
    x = x if x is not None else M
    total_w = total_w if total_w is not None else CONTENT
    n = len(items)
    w = Emu(int((total_w - gap * (n - 1)) / n))
    for i, (value, label) in enumerate(items):
        cx = x + Emu(int((w + gap) * i))
        box(s, cx, y, w, hgt)
        is_figure = any(ch.isdigit() for ch in value)
        text(s, value, cx + Inches(0.22), y + Inches(0.17), w - Inches(0.44), Inches(0.42),
             size=19 if is_figure else 20, font=MONO if is_figure else HEAD,
             bold=is_figure, colour=ACCENT_TEXT if i == 0 else INK, spacing=1.0,
             spc=-0.02 * 19 if is_figure else None)
        text(s, label.upper(), cx + Inches(0.22), y + Inches(0.63), w - Inches(0.44), Inches(0.24),
             size=6.5, colour=MUTED, font=MONO, spacing=1.0, spc=0.4)


def pill(s, label, x, y, on=False):
    """The site's plan pill: mono, upper case, a hairline ring, fully rounded."""
    label = label.upper()
    size = 6.5
    w = Inches(text_width(label, size, MONO) + 0.04 * len(label) * size / 72 + 0.24)
    h = Inches(0.24)
    sh = box(s, x, y, w, h, fill=CARD, border=ACCENT if on else STRONG, radius=0.5)
    sh.line.width = Pt(0.75)
    text(s, label, x, y + Inches(0.05), w, h, size=size, colour=INK if on else BODY, font=MONO,
         align=PP_ALIGN.CENTER, spacing=1.0, spc=0.4)
    return w


def band(s, x, y, w, h):
    """A callout as the site's pricing band: a card with one accent rule down its left edge."""
    box(s, x, y, w, h)
    sh = s.shapes.add_shape(5, x, y + Inches(0.16), Pt(3), h - Inches(0.32))
    sh.fill.solid(); sh.fill.fore_color.rgb = ACCENT
    sh.line.fill.background(); sh.shadow.inherit = False
    sh.adjustments[0] = 0.5


def steps(s, items, y, x=None, total_w=None, hgt=Inches(1.05), size=12.5):
    """
    The site's row of rules: numbered columns, each opened by a hairline on
    its left, the number in mono above the words.
    """
    x = x if x is not None else M
    total_w = total_w if total_w is not None else CONTENT
    n = len(items)
    w = Emu(int(total_w / n))
    hline(s, x, y, total_w)
    hline(s, x, y + hgt, total_w)
    for i, item in enumerate(items):
        cx = x + Emu(int(w * i))
        if i:
            sh = s.shapes.add_shape(1, cx, y, Emu(9525), hgt)
            sh.fill.solid(); sh.fill.fore_color.rgb = LINE
            sh.line.fill.background(); sh.shadow.inherit = False
        pad = Inches(0.2) if i else 0
        text(s, f"{i + 1:02d}", cx + pad, y + Inches(0.16), w - pad, Inches(0.2), size=7,
             colour=MUTED, font=MONO, spacing=1.0)
        text(s, item, cx + pad, y + Inches(0.42), w - pad - Inches(0.2), hgt - Inches(0.5),
             size=size, colour=BODY, spacing=1.35)


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
             font=HEAD, colour=INK, spacing=1.35)
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
        pill(s, c["tag"], px, y + Inches(0.24), on)
        title = c["title"].capitalize() if c["title"].isupper() else c["title"]
        text(s, title, px, y + Inches(0.62), pw, Inches(0.42), size=18, font=HEAD,
             colour=INK, spacing=1.1, spc=-0.01 * 18)
        text(s, c["sub"], px, y + Inches(1.02), pw, Inches(0.28), size=11, colour=MUTED, spacing=1.2)
        points_y, points_gap = y + Inches(1.32), Inches(0.225)
        divider = y + hgt - Inches(0.92)
        bottom = points_y + Emu(int(points_gap * len(c["points"])))
        if bottom > divider:
            # The footer block hangs off the bottom edge so all three cards
            # line their prices up, which means a card that is too short for
            # its own bullets prints them through the divider. That defect is
            # invisible in the code and obvious on the page, so fail here.
            short = (bottom - divider) / Inches(1)
            raise ValueError(
                f"tri_cards: card {i} ({c['title']}) needs about "
                f"{short + 0.05:.2f}in more height for {len(c['points'])} points"
            )
        dotted(s, c["points"], px, points_y, pw, size=10, gap=points_gap)
        hline(s, px, divider, pw)
        text(s, c["foot_label"].upper(), px, y + hgt - Inches(0.78), pw, Inches(0.24),
             size=6.5, colour=MUTED, font=MONO, spacing=1.0, spc=0.4)
        foot_is_figure = any(ch.isdigit() for ch in c["foot"])
        text(s, c["foot"], px, y + hgt - Inches(0.54), pw, Inches(0.3), size=14,
             font=MONO if foot_is_figure else HEAD, bold=foot_is_figure,
             colour=ACCENT_TEXT if on and c.get("foot_accent") else INK, spacing=1.15)
        if c.get("foot_note"):
            text(s, c["foot_note"], px, y + hgt - Inches(0.26), pw, Inches(0.24), size=9,
                 colour=MUTED, spacing=1.1)


def two_col(s, kick, title, paras, shot_name, shot_y=Inches(1.75), shot_h=Inches(4.3)):
    masthead(s); kicker(s, kick)
    y = h1(s, title, w=Inches(4.9))
    ty = y + Inches(0.22)
    for i, p in enumerate(paras):
        size = 13 if i == 0 else 12
        hh = Inches(est_lines(p, size, 4.75, font=SANS) * size * 1.55 * LINE_BOX / 72)
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
        text(s, cap, x, y + used + Inches(0.16), w, Inches(0.26), size=12, font=HEAD,
             colour=INK, spacing=1.2)
        text(s, sub, x, y + used + Inches(0.44), w, Inches(0.26), size=10.5,
             colour=MUTED, spacing=1.2)


def part(kick, title, body):
    s = slide(); ground(s); masthead(s)
    kicker(s, kick, y=Inches(2.56))
    h1(s, title, y=Inches(3.02), size=44)
    text(s, body, M, Inches(4.62), Inches(9.6), Inches(0.9), size=13, colour=BODY, spacing=1.55)
    footer(s)
