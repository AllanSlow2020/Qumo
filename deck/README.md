# The deck

One presentation, generated rather than drawn: `build_deck.py` writes
`Qumo.pptx`.

| Slides | Part | What it is for |
|---|---|---|
| 1-13 | The pitch | Presented. One story, told by the headlines alone: the problem, the cost of staying put, the turn, one customer's journey, the objections, the proof, their own numbers, the ask |
| 14-37 | Appendix | Not presented. What the brand sees, what the customer sees, and the questions that come next: turned to when somebody asks, and left behind afterwards |
| 38 | Thank you | The last page: the ask once more, and where to find us |

There used to be a separate product overview. It was folded in as the
appendix because the two kept drifting apart: the same mechanic, pricing
and status slides lived in both, and their figures disagreed.

The point of it being code is that it is regenerated from the running
product. Its central claim is that every screen in it is a live render,
not a mockup. Every one of the 17 screenshots appears somewhere in it.

This directory lives in the repo because it has already been lost twice to
an ephemeral working directory, each time costing a full rebuild.

**The screenshots are committed, and that is a trade.** It means the deck
builds from a fresh clone with no database and no running app, which is the
whole reason this is in git. It also means they go stale silently as the UI
moves. So: re-run `capture.mjs` before the deck goes to anybody. A screen in
this directory is a photograph of a particular build, not a fact about the
product.

## What is here

| | |
|---|---|
| `style.py` | the house style: palette, geometry, and every drawing primitive |
| `build_deck.py` | the deck: the pitch, then the appendix |
| `capture.mjs` | photographs the running product into `shots/` |
| `art/` | the Qumo mark, rendered from `public/qumo.svg` in three colours |
| `shots/` | the screenshots, committed so the deck builds from a clone |
| `fonts/` | Instrument Sans and Martian Mono, with their licences |
| `requirements.txt` | the two Python packages the build needs |

The built `.pptx` files and any rendered PDF are build output and are not tracked.

## Fonts, and why to present from the PDF

The deck is set in the marketing site's two faces: Instrument Sans to read,
Martian Mono for labels and figures. Both are in `fonts/` under the SIL
Open Font License. PowerPoint and Keynote cannot embed them in a .pptx, so a
machine without them silently substitutes. Either present from the PDF,
which carries them, or install the files in `fonts/` before opening the
.pptx.

The cover, the closing slide and the section dividers carry the site's
hero ground (grid guides, blue glow, registration crosshairs). It is drawn
once into `art/ground.png` by `style.py`; delete that file to redraw it.

## Every figure has a source

`sources.py` lists every figure that appears on a slide: where it came from,
the exact words for anything read in a document, and the evidence for
anything about Qumo itself. Each build reads the text back out of the
finished deck and refuses to save it if a figure is not listed, or if demo
figures or proposed prices sit on a slide that does not say illustrative or
indicative. The overview deck's screen count is counted from `shots/`
rather than trusted.

```bash
python3 deck/build_deck.py --strict
```

`--strict` also refuses known gaps (entries marked `unsourced`). Use it for
any copy that leaves the building. `python3 deck/sources.py` rewrites the
readable register at `docs/sources.md`.

## Building it

The capture step needs a running app with seeded demo data, because it
drives the real console and the real shopper surface.

```bash
# 1. a database with a story in it
pnpm bootstrap
pnpm demo

# 2. a build, served on 3000, with the production root domain compiled in
NEXT_PUBLIC_QUMO_ROOT_DOMAIN=qumo-app.com \
NEXT_PUBLIC_QUMO_CONSOLE_SUBDOMAIN=app \
  pnpm exec next build
NEXT_PUBLIC_QUMO_ROOT_DOMAIN=qumo-app.com \
NEXT_PUBLIC_QUMO_CONSOLE_SUBDOMAIN=app \
DEMO_LOGIN_PHONES='+27821000037' DEMO_LOGIN_CODE='424242' \
  pnpm exec next start -p 3000
```

The shopper surface sets secure cookies, so the browser has to see https.
`tls-front.mjs` is a throwaway HTTPS front on 443 for exactly this; it
needs a self-signed pair first (the command is at the top of the file, and
both files are git-ignored). `capture.mjs` already maps `*.qumo-app.com`
and the apex to 127.0.0.1.

```bash
openssl req -x509 -newkey rsa:2048 -nodes -keyout deck/tls-key.pem \
  -out deck/tls-cert.pem -days 2 -subj "/CN=*.qumo-app.com"
node deck/tls-front.mjs
```

**Two-factor sign-in.** The demo owner is an owner, and an owner may not
use the console on a password alone. The first capture enrols the demo
account through the real security screen and keeps its authenticator
secret in `deck/.capture-totp` (git-ignored, readable only by you); later
runs sign in with it. If the file is lost, re-seed and delete nothing else.

**The figures on "what you would see" are read off the performance
screen.** `pnpm demo` is random, so after every capture read the four
numbers off `shots/console-performance.png` and update them, and their
date, in `sources.py`.

```bash
# 3. the screens, then the deck
#    playwright is already a devDependency; the browsers ship with the image
CHROMIUM_PATH=/path/to/chromium \
  node deck/capture.mjs copper-kettle <batch-id> - <unscanned-code>
# "-" reads the provision secret from PROVISION_SECRET instead of the command line

python3 -m pip install -r deck/requirements.txt
python3 deck/build_deck.py deck/Qumo.pptx
```

The last argument is optional and is a pack code that will be burned to
photograph the award screen. Mint one for the purpose rather than taking it
out of a live print run. Without it the deck still builds and that one
slide falls back to the wallet.

Building the deck alone, with the screens already in the repo, is just the
last two lines.

**Install with `python3 -m pip`, not bare `pip`.** On more than one image
`pip` belongs to a different interpreter than `python3`, and the install
succeeds while the import fails.

## Checking it before it goes anywhere

Rendering is not optional. Every layout bug this deck has had was invisible
in the code and obvious on the page: headings printing through the
paragraph beneath them, card text running past its own divider, a footnote
across the footer rule.

```bash
libreoffice --headless --convert-to pdf --outdir deck deck/Qumo.pptx
```

Then look at every page, and grep the extracted text for anything that
should not be in a client-facing deck: a real brand's name, an em dash.

`style.py` fails the build rather than drawing a card whose bullets would
run through its own divider, because that defect is invisible in the code.
It cannot catch everything, which is why the render still gets looked at.

## House rules

- **No client is named.** The demo brands are invented. Nothing in here
  implies a customer who has not signed.
- **No em dashes**, anywhere.
- **Figures carry their own caveat.** Prices are marked indicative on the
  slide and in the footer of every page, and any invented performance
  figure says on the slide that it is illustrative.
- **Screens are never edited.** If a screen looks wrong in the deck, fix
  the product and re-capture.
