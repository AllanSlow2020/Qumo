# The decks

Two of them, generated rather than drawn.

| | | |
|---|---|---|
| `build_deck.py` | 23 slides | the product overview: what it does, every screen |
| `build_pitch.py` | 10 slides | the pitch: why a brand should care, and the ask |

The point of them being code is that they are regenerated from the running
product. Their central claim is that every screen in them is a live render,
not a mockup.

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
| `build_deck.py` | the product overview |
| `build_pitch.py` | the pitch |
| `capture.mjs` | photographs the running product into `shots/` |
| `art/` | the Qumo mark, rendered from `public/qumo.svg` in three colours |
| `shots/` | the screenshots, committed so the deck builds from a clone |
| `requirements.txt` | the two Python packages the build needs |

The built `.pptx` files and any rendered PDF are build output and are not tracked.

## Building it

The capture step needs a running app with seeded demo data, because it
drives the real console and the real shopper surface.

```bash
# 1. a database with a story in it
pnpm bootstrap
pnpm demo

# 2. a build, served on 3000, with the production root domain compiled in
NEXT_PUBLIC_QUMO_ROOT_DOMAIN=qumo.co.za \
NEXT_PUBLIC_QUMO_CONSOLE_SUBDOMAIN=app \
  pnpm exec next build
NEXT_PUBLIC_QUMO_ROOT_DOMAIN=qumo.co.za \
NEXT_PUBLIC_QUMO_CONSOLE_SUBDOMAIN=app \
DEMO_LOGIN_PHONES='+27821000037' DEMO_LOGIN_CODE='424242' \
  pnpm exec next start -p 3000
```

The shopper surface sets secure cookies, so the browser has to see https.
Put any TLS terminator on 443 in front of 3000 and point the capture
browser's host resolver at it. `capture.mjs` already maps `*.qumo.co.za`
and the apex to 127.0.0.1.

```bash
# 3. the screens, then the deck
#    playwright is already a devDependency; the browsers ship with the image
CHROMIUM_PATH=/path/to/chromium \
  node deck/capture.mjs copper-kettle <batch-id> <provision-secret> <unscanned-code>

python3 -m pip install -r deck/requirements.txt
python3 deck/build_deck.py deck/Qumo.pptx
python3 deck/build_pitch.py deck/Qumo-pitch.pptx
```

The last argument is optional and is a pack code that will be burned to
photograph the award screen. Mint one for the purpose rather than taking it
out of a live print run. Without it the deck still builds and that one
slide falls back to the wallet.

Building the decks alone, with the screens already in the repo, is just the
last three lines.

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
libreoffice --headless --convert-to pdf --outdir deck deck/Qumo-pitch.pptx
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
