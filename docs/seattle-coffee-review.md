# Seattle Coffee Company: a working reference for the stamp card

**Source:** https://www.seattlecoffeecompany.co.za/?faqs=loyalty-program
**Reviewed:** 28 October 2026
**Purpose:** Context, like `docs/vaultbook-review.md`, but a different kind.
Vaultbook is a competitor for the same buyer. This is not a competitor at
all. It is a South African brand running, in public and at scale, the exact
promotion shape a Qumo brand would want to run, and reading it tells us
what that shape actually needs.

> **Method note.** Their site is blocked by this session's network policy,
> so nothing here comes from fetching it. Everything under "What they do"
> is read off a screenshot of their loyalty FAQ supplied by Allan, plus his
> description of using it in store. Everything under "What it exposes" is
> my own reading of our code, and every claim about Qumo in this document
> was checked against the repository rather than remembered.

---

## 1. What they do

| | |
|---|---|
| **Joining** | Online or in store. |
| **Identifying** | The shopper keys a loyalty number into a keypad at the till, each time they pay. |
| **Earning** | One beverage is one point. Per drink, not per transaction and not per rand. |
| **The reward** | Ten points, and the eleventh beverage is free. Anything on the menu, extras included. |
| **Completion** | "Points go up to 10, and then return to 0, and then 1 free coffee is added." |
| **Seeing it** | Printed at the foot of the till slip as `Points [x] Coffees [y]`, or in a web portal. |
| **Expiry** | None stated. Free beverages can be saved up and used at any time. |
| **Privacy** | "Your number is private and ONLY used to accrue loyalty points." No marketing at all. The barista cannot see the number on the point of sale. |
| **When the line is down** | The number still keys in and points still accrue. Redemption stops and the tally does not print. |

## 2. How it maps onto what we have

Closely, and that is the useful part. Their mechanic is not exotic.

| Theirs | Ours |
|---|---|
| One beverage, one point | `EarnRule.unit = STAMPS`, `amount = 1` |
| Ten points, then free | `EarnRule.completesAt = 10`, with a `Reward` behind it |
| Points return to zero and a coffee is added | `applyAccrual` writes a ledger row of `-completesAt` and issues a coupon. The balance stays the sum of its rows, so the shopper's history says where the stamps went |
| Saved up, no expiry | Our stamps do not expire either |

So the ledger model needs nothing. What follows is everything that is not
the ledger.

## 3. What it exposes

Four gaps, largest first. Each one was verified in the code.

### 3.1 A completed card earns a coupon nobody can accept

`applyAccrual` issues a real coupon on completion. Nothing anywhere can
mark it used. `REDEEMED` appears in `prisma/schema.prisma` and in no
TypeScript file in this repository.

Worse, the schema says otherwise. The comment on `Coupon.status` reads
"REDEEMED/CANCELLED are now reachable via manual staff action
(lib/coupons/manage.ts)". That file does not exist.

This is not the `REDEMPTION_AVAILABLE` flag already on the open items
list. That flag gates spending a **cash balance** at a till and a stamp
card never touches it. This is a separate hole: the coupon is issued,
shown to the shopper, and permanently `ISSUED`.

Two consequences:

- **The loop does not close.** For an on-pack brand, earning without
  redeeming is survivable for a while. For a coffee shop the free
  eleventh coffee being handed over *is* the product.
- **A coupon code is a screenshot.** With no way to mark one used,
  `CouponFraudEvent.ALREADY_REDEEMED` can never fire, because nothing ever
  sets the status it would check. The same code works at every counter,
  every time. A brand honouring coupons by eye today has no defence at
  all.

### 3.2 A stamp card cannot be earned from a till slip

The two doors are partitioned by rule type, and the partition is total:

- `lib/packs/scan.ts` refuses a pack code whose campaign is
  `PERCENT_OF_SPEND`.
- `lib/stores/receipt.ts` resolves a slip through `findSpendCampaign`,
  whose only filter is `earnRule: { type: "PERCENT_OF_SPEND" }`, and that
  function has exactly one caller.

So a slip can only ever earn a share of the basket. The only way to get
stamps out of a till slip is to configure a `PERCENT_OF_SPEND` rule with
`unit = STAMPS`, which multiplies stamps by rands: at the form's own
default of 500 basis points, a R100 basket awards 500 stamps.

That combination is in the demo data, and it is not somebody being silly.
It is somebody reaching for the only lever that produces stamps from a
slip. The console let them, and nothing refuses it.

A Seattle-shaped promotion therefore cannot be built on Qumo today at all,
whatever the console says, because a coffee has no pack code.

### 3.3 Per beverage, not per visit

Three coffees for the office earns three points from them and would earn
one stamp from us, because our unit of proof is the slip. Matching it
needs line items, which only the point of sale has.

Worth knowing rather than fixing: one stamp per visit is a defensible
programme, it is simply a different one, and a brand should be told which
it is buying.

### 3.4 The till is their whole interface

Three touchpoints, and we have none of them: keying in at the till, the
running tally printed at the foot of the slip, and the barista handing the
coffee over. Theirs also accrues with the line down, which in South Africa
is not a footnote for a chain. Every Qumo door needs a live call.

## 4. Their privacy position, and what it means for the pitch

"Your number is private and ONLY used to accrue loyalty points. You will
never receive unwanted communication from us. We do not believe our
customers are a commodity to be advertised to. The barista also cannot see
your number on their POS."

That is close to word for word the guarantee on `qumo.co.za`: a brand never
sees a mobile number, and the console has no screen showing an individual
shopper. A real South African programme arrived at the same answer
independently, which is worth having in the room.

The difference is what each pays for it. They buy the promise by giving up
marketing entirely. Our pitch to brands is reach, and our answer is that
reach runs through Qumo without the brand ever holding the number. That is
a better position than either of the two obvious ones, but the deck has to
make it carefully, because stated carelessly it sounds exactly like the
thing they are defining themselves against.

## 5. What I would do about it

In this order, and the order is the point.

1. **Make a coupon redeemable.** Until that exists, every stamp card we
   sell is a promise we cannot keep, and the fraud model assumes a
   redemption check that cannot run.
2. **Let a till slip award a flat amount.** One stamp per slip. This is
   the smallest change that makes a coffee shop possible, and it removes
   the only reason anybody would configure stamps as a share of spend.
3. **Refuse a share of spend in stamps**, once nobody needs it.
4. **Then the console**, which is where this started: name the promotion
   shapes a brand recognises instead of asking for a rule type, a ledger
   unit and a figure in basis points.

A till door and a point of sale integration sit behind all four, and they
only become worth costing if brands of this shape are a target. That is a
strategy question, not a backlog item, and it belongs beside the USSD
question in `docs/open-items.md`.
