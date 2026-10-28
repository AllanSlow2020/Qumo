# Photographing a till slip: what is built, and the decision left

Built on 27 October 2026. The tier exists end to end except for the one
piece that has to be chosen rather than written.

---

## What a brand can do today

Every promotion now says how much proof it insists on, chosen on step two
of the setup flow:

| Setting | What it still guarantees | What it gives up |
|---|---|---|
| Only slips signed by the till | The total cannot be edited between the till and the scan | Every store needs a signing secret printed on the slip |
| Any slip carrying a Qumo code | Each slip earns once, and only if recent, both enforced by the database | A shopper who edits their own receipt will be believed |
| A photograph of any till slip | Nothing has to change at the till | No signature, and the once-only guarantee holds only as well as the read does |

The default is the middle one, which is exactly what the code did before
the setting existed. No promotion changed behaviour when this shipped.

A scan weaker than the promotion asks for is refused, awards nothing, and
does not burn the slip number, so the same slip still works if the brand
lowers the floor later. The shopper is told what the promotion does take,
rather than that their evidence was rejected.

## What is recorded

`PurchaseScan.proofTier` records what each scan actually proved, on the
scale `wasSigned` was the two-value version of. The migration backfills it
from `wasSigned` rather than letting the column default, because the
default would have marked 223 historically signed scans as unsigned, and
that column exists precisely so a store that signs today cannot rewrite
what was true of a slip scanned last month.

Both columns are written from one decision so they cannot disagree.
`wasSigned` should be dropped once nothing reads it; until then
`proofTier` is the one to trust.

---

## What is not built, and why

**There is no reader.** `lib/slips/read.ts` holds the contract and no
implementation, and the photograph option is disabled in the console with
"not switched on yet" until `QUMO_SLIP_READER` names one. A typo in that
variable is a startup error rather than a silent fall back to no reader,
because a feature that quietly turns itself off while the console still
offers it to brands is worse than one that refuses to start.

Also not built: the shopper-facing camera screen and the endpoint behind
it. Both are small once a reader exists and neither can be tested without
one.

### The decision, and it is not only about accuracy

Four things to weigh, and the third is the one that is easy to miss:

1. **Accuracy on South African thermal slips**, measured rather than
   claimed. The contract has a confidence floor of 0.85 and refuses
   anything below it, but a reader that is confidently wrong clears that
   floor, so the number that matters is how often it misreads a total
   while reporting high confidence.
2. **Which retailers' layouts it handles.** A reader that cannot find the
   slip number on a Spar till roll cannot be used at Spar, however good it
   is elsewhere, because the slip number is the entire replay guard.
3. **Where the photograph goes.** We do not store it: the image is read
   and discarded inside one request, and nothing writes it to disk, the
   database or a bucket. A cloud reader breaks that. Sending a shopper's
   slip to an external service makes that service an operator under POPIA,
   requires an operator agreement under section 21, and if it sits outside
   South Africa it is a transborder flow under section 72 and has to be
   disclosed in the notice under section 18. None of that is in
   `docs/popia.md` today and all of it would have to be, before a pilot.
   **A reader that runs in our own process avoids every line of that
   paragraph**, and that is worth real accuracy to buy.
4. **Cost per read**, against a promotion whose ceilings are already the
   only thing bounding a weak tier.

### What has to happen before any brand is offered it

- Implement `SlipReader` and name it in `slipReader()`.
- Measure the accuracy, on real slips from the retailers a pilot will use.
- Build the capture screen and the endpoint.
- Publish the standards: accuracy, retailers covered, what happens when a
  read fails. `docs/competitive-position.md` argues this is the whole
  opportunity, because the competitor publishes none of it.

### The cost of not storing the image, stated plainly

A shopper whose slip is misread cannot have a human look at the picture
afterwards, because we no longer have it. There is no appeal of that kind
and there should not pretend to be one. The failure messages are specific
for that reason: they name the part that could not be read while the
person is still holding the slip, so they can retake it or use the
printed code instead of arguing about it later.

---

## Files

- `lib/proof/tier.ts` - the scale, the comparison, and the copy a brand
  reads before choosing.
- `lib/slips/read.ts` - what a reader must return, when a read is too thin
  to use, and the reason the image is never kept.
- `lib/stores/receipt.ts` - the tier is decided where the signature is
  checked and enforced after the rule is found.
- `prisma/migrations/20261027185729_proof_tiers` - the columns and the
  backfill.
- `tests/proof-tier.test.ts`, `tests/slip-read.test.ts`,
  `tests/proof-tier-enforcement.test.ts`.
