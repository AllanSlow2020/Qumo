from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule
from openpyxl.utils import get_column_letter

# Where the spreadsheet goes. Defaults to the tracked copy beside
# docs/open-items.md, so running this with no arguments regenerates the file
# the repository actually ships.
#
# This script lived in a session scratchpad until 16 November, which meant
# the only way to rebuild a tracked binary file was a directory that gets
# cleared without warning. docs/state-of-play.md had a line telling the next
# person to say so rather than hand-edit the spreadsheet, which was the
# right advice and the wrong fix.
#
# Needs /usr/bin/python3.13: python3 is 3.11 here and openpyxl is installed
# for 3.13.
#
# After regenerating, the totals row holds formulas that openpyxl writes but
# does not evaluate, so a reader that trusts the cached value sees nothing
# there. Run the sandbox's recalculator over it:
#
#   /usr/bin/python3.13 -I scripts/open-items-xlsx.py
#   /usr/bin/python3.13 /mnt/skills/public/xlsx/scripts/recalc.py docs/open-items.xlsx
#
# That second step is why a regenerated file is a few kilobytes smaller than
# the tracked one until it has been run.
import sys
from pathlib import Path

OUT = sys.argv[1] if len(sys.argv) > 1 else str(Path(__file__).resolve().parent.parent / "docs" / "open-items.xlsx")

ARIAL = "Arial"
INK = "1F2430"
HEAD_FILL = PatternFill("solid", fgColor="1F2430")
BAND_FILL = PatternFill("solid", fgColor="F2F4F7")
WARN_FILL = PatternFill("solid", fgColor="FDE2E1")
DONE_FILL = PatternFill("solid", fgColor="DDF2E3")
PROG_FILL = PatternFill("solid", fgColor="FFF3D6")
PARK_FILL = PatternFill("solid", fgColor="ECECEC")
THIN = Side(style="thin", color="D5D9E0")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

A, L, C = "Allan", "Lawyer", "Claude"
AL, LC, AC = "Allan + lawyer", "Lawyer + Claude", "Allan + Claude"

# section, id, item, owner, blocks pilot, status, reference, detail, warning
ROWS = [
("1. Gates a pilot with real shoppers","1.1","Confirm or overturn the responsible-party split",L,"Yes","Not started","docs/popia.md",
 "The code implements \"both, for different purposes\" and the shopper notice now says so. If a lawyer lands elsewhere, the notice changes and every brand needs its own consent captured at join, which is a product change rather than a wording one.",""),
("1. Gates a pilot with real shoppers","1.2","Get the shopper copy reviewed",L,"Yes","Not started","docs/legal-draft-for-review.md",
 "Written and ready to send, with the three points worth reading first and its queries marked. docs/consent-copy.md is the generated current copy beside it.",""),
("1. Gates a pilot with real shoppers","1.3","Appoint an Information Officer and register with the Information Regulator",A,"Yes","Not started","",
 "Only if the responsible-party split is confirmed. Calendar time, not build time.",""),
("1. Gates a pilot with real shoppers","1.4","A shopper can reach Qumo",C,"Yes","Done","docs/popia.md",
 "A contact page at /legal/contact says which questions are the brand's and which are ours, the privacy notice and the terms both carry the address, and the footer links to it from every shopper screen. Both documents are signed by QUMO-APP (PTY) LTD and its registration number rather than by a product name. The notice is web-v6 and the terms are terms-v2, so anyone already signed in re-affirms at their next sign-in.",""),
("1. Gates a pilot with real shoppers","1.4a","help@qumo.co.za delivers",A,"Yes","Done","docs/deploying.md",
 "The domain had no MX record at all until 9 November, which is why the first tests neither arrived nor bounced quickly. Two MX records now point at ImprovMX, forwarding help@ and access@ to a personal inbox, and both were confirmed by sending from an unrelated account and watching the messages arrive. The address was published before it worked, which is the sequence to avoid rather than repeat.",""),
("5. Operations","5.6","Both domains are locked",A,"No","Done","",
 "qumo.co.za was off and is now on; qumo-app.com was already on and was left alone. Transfers out are possible from 14 November for qumo.co.za and 25 December for qumo-app.com; unlocking first is the deliberate extra step.",""),
("5. Operations","5.7","The dead qumo.co.za entries are off the Vercel project",A,"No","Done","docs/deploying.md",
 "All three, qumo.co.za, www.qumo.co.za and *.qumo.co.za, had sat at Invalid Configuration since they were added, because the DNS points at Lovable and Vercel was never going to validate them. Every qumo-app.com entry was confirmed untouched and still Valid afterwards.",""),
("5. Operations","5.8","The demo brands named after real companies are gone",A,"No","Done","",
 "Two of them, not one. The early demo data used real names and the habit was corrected later, so the invented brands sat beside two that were not. Both deleted from production by id, after a snapshot. One had a single membership and no ledger rows, the other was empty on every count. Copper Kettle was untouched and Person was unchanged before and after, since Person carries no brandId and is shared across brands.",
 "The lesson is about demo data: a realistic demo name is a trade mark somebody else owns, and the slug is what carries the risk, because slug.qumo-app.com resolves through the wildcard. Invent them."),
("1. Gates a pilot with real shoppers","1.5","Write down the breach process (POPIA section 22)",AL,"Yes","Not started","",
 "Who decides, how fast, who signs the notification.",""),
("1. Gates a pilot with real shoppers","1.6","Review the brand agreement",L,"Yes","Not started","docs/brand-agreement-draft.md",
 "Drafted, not reviewed. The operator clause and the section 21 obligation are in it and depend on item 1.1. Three clauses are the review: 7 says plainly that a reward code is issued and cannot be marked redeemed, 9 carries the responsible-party split, and 13 has to match the cancellation behaviour exactly because the product will do that whatever the contract says.",""),

("2. Legal questions already written down","2.1","CPA section 35: loyalty credits as a medium of exchange",L,"No","Not started","docs/terms-brief.md",
 "Loyalty credits are a legal medium of exchange \"despite any provision in any law, agreement or notice to the contrary\". The terms currently say balances are not. Also: issuing value while redemption is closed, against the prohibition on offering a programme without the intention of providing the award.",""),
("2. Legal questions already written down","2.2","CPA section 63: the three-year life of a prepaid credit",L,"No","Not started","docs/terms-brief.md",
 "A prepaid credit or voucher lives three years. Our terms give 60 days after a brand closes a programme. Whether section 63 reaches earned credits is the highest-value question in the list.",""),
("2. Legal questions already written down","2.3","POPIA section 57: prior authorisation for unique identifiers",L,"No","Not started","docs/terms-brief.md",
 "Prior authorisation for linking unique identifiers across responsible parties. One phone number identifying one account across many brands is exactly the shape of the worked example, and authorisation has to come before the processing, not after.",""),
("2. Legal questions already written down","2.4","POPIA sections 18 and 72: the database is in the United States",L,"No","Not started","docs/terms-brief.md",
 "The notice says nothing about it and probably has to. See also the Neon region item under Operations.",""),
("2. Legal questions already written down","2.5","Children: no minimum age means nothing stops a child joining",LC,"No","Not started","docs/terms-brief.md",
 "A brand that sets no minimum age is never asked one. A product fix, not a drafting one.",""),
("2. Legal questions already written down","2.6","Taking payment online",L,"No","Not started","docs/terms-brief.md",
 "Only if self-serve signup happens: CPA on cancellation and refunds, ECTA on electronic transactions.",""),

("2. Legal questions already written down","2.7","Register Qumo as a trade mark",AL,"No","Not started","docs/legal-engagement.md",
 "There is none. A CIPC company registration and two domains stop somebody registering the identical company name; they do not stop somebody trading as Qumo. Classes 9 (software), 35 (advertising, business, loyalty schemes) and 42 (software as a service).",
 "Search before filing and before any further spend on the brand. There may be an existing Qumo in consumer electronics elsewhere, and a collision is far cheaper to find now than after a brand guide, a site and a print run."),
("2. Legal questions already written down","2.8","Assign the IP to the company",AL,"No","Not started","docs/nda-and-assignment-draft.md",
 "The work was done by the founder personally and QUMO-APP (PTY) LTD is a different legal person, so copyright may sit in the wrong place. Harmless until a raise, a sale or a disagreement. Drafted, needs review. Do this one first: it gets more awkward the longer the company trades on work it may not own.",""),
("2. Legal questions already written down","2.9","Who owns AI-authored code",L,"No","Not started","docs/legal-engagement.md",
 "Most of the repository was written by Claude under direction: 97 commits to 38. Anthropic's terms assign output ownership to the customer, and South Africa is one of the few jurisdictions whose Copyright Act addresses computer-generated works directly. Probably a clean answer, which is why it is worth confirming rather than assuming. Same question for the Lovable-built site.",""),
("2. Legal questions already written down","2.10","A short mutual NDA for brand meetings",L,"No","Not started","docs/nda-and-assignment-draft.md",
 "Worth having, and worth knowing that large brands and their agencies often refuse to sign one from a small supplier. The pitch deck is written to survive travelling, and the engine, the ledger and the proof tiers are not in it.",""),
("3. Decisions only you can take","3.1","Self-serve signup and payment",A,"No","Not started","See the Self-serve signup tab",
 "Under consideration. The subscription state machine already exists; what is missing is taking money and issuing the invite automatically.",""),
("3. Decisions only you can take","3.2","The dormancy window",A,"No","Not started","docs/popia.md item 4",
 "QUMO_DORMANT_ERASE_AFTER_DAYS is unset. POPIA section 14 and CPA sections 35 and 63 pull in opposite directions on it.",
 "Do not set QUMO_DORMANT_ERASE_AFTER_DAYS without reading item 4 of docs/popia.md first. The sweep would erase unspent balances along with the dormant account."),
("3. Decisions only you can take","3.3","Pick a slip reader, or decide not to yet",A,"No","Not started","docs/photo-capture.md",
 "The photograph tier is built and disabled. docs/photo-capture.md has the four things to weigh. A reader running in our own process avoids the whole problem in the warning column.",
 "A cloud reader makes that vendor a POPIA operator and, if it is offshore, a section 72 transborder flow the shopper notice has to disclose."),
("3. Decisions only you can take","3.4","Brands whose door is the till",A,"No","Not started","docs/seattle-coffee-review.md",
 "A coffee chain identifies a shopper at the point of sale and hands the reward over at the same counter. Qumo has no till door and no point of sale integration, and both sit behind items 4.1 and 4.2. Worth costing only if brands of that shape are a target.",""),
("3. Decisions only you can take","3.5","USSD, or not",A,"No","Not started","docs/competitive-position.md",
 "The competitor sells it hard to feature-phone and data-off shoppers and we are simply absent from that market. A strategy question, not a backlog item.",""),
("3. Decisions only you can take","3.6","Language",A,"No","Not started","",
 "English only today. Mass-market reach here is language-dependent.",""),

("4. Product gaps","4.1","A coupon can be redeemed, once",C,"No","Done","docs/seattle-coffee-review.md",
 "lib/coupons/manage.ts moves a coupon out of ISSUED, a console screen under Redeem takes the code at the counter, and the shopper wallet now lists their codes so there is something to show. A conditional update on status settles two counters trying the same coupon in the same second, and every refusal writes a CouponFraudEvent, mistyped codes included. No migration: every column was already in the schema.",
 ""),
("4. Product gaps","4.1a","Decide on a per-store staff role",A,"No","Not started","",
 "Redeeming is open to owner, admin and marketing, because a single-site brand runs it from the console logins it already has. A barista at a franchise wants a login that can take a coupon and cannot change the earn rate. The first brand whose counters run this decides the shape.",""),
("4. Product gaps","4.2","A stamp card can be earned from a till slip",C,"No","Done","docs/seattle-coffee-review.md",
 "A flat rule has nothing to multiply, and lib/campaigns/slip-earning.ts now decides what a slip can satisfy for both the engine and the console. A coffee shop with a till and no printed pack codes can run buy ten get one free, which it could not before. Two promotions a slip could both satisfy are refused at activation, and an overlap that predates the rule is named on the Overview rather than resolved in silence.",
 ""),
("4. Product gaps","4.3","Spending a rand balance at a till",C,"No","Not started","",
 "REDEMPTION_AVAILABLE is still false, and this is now the only half of redemption that is shut: confirmWalletSpend has an engine and a test suite and no caller, because the two-phase flow assumes every till has a staffed Qumo login. A question for the first brand whose counters would run it. CPA section 35 has views about it.",""),
("4. Product gaps","4.4","Correct-the-read",C,"No","Not started","docs/photo-capture.md",
 "Proposed and not built: let a shopper fix a misread slip in the moment, identity fields only, never the amount. It is what makes photo capture defensible without storing anybody's photograph.",""),
("4. Product gaps","4.5","A reader implementation, once one is chosen",C,"No","Not started","docs/photo-capture.md",
 "Plus the capture screen and published accuracy standards. Blocked on item 3.3.",""),
("4. Product gaps","4.6","Referral",C,"No","Not started","",
 "Once there are shoppers to refer anybody.",""),
("4. Product gaps","4.7","WhatsApp",C,"No","Not started","",
 "Planned, not built. Needs its own consent copy and version.",""),
("4. Product gaps","4.8","SMS re-consent has no path",C,"No","Not started","lib/consumer/consent.ts",
 "A web shopper on an old consent version re-affirms at next sign-in. An SMS joiner has no next sign-in, so nobody who joined under sms-v1 will ever be shown sms-v2. Costs nothing while no aggregator is connected.",""),

("5. Operations","5.1","DIRECT_DATABASE_URL is set for Preview",A,"No","Done","",
 "It was Production only, so scripts/preflight.mjs stopped every Preview build before it reached the migration it would have failed on. Proved fixed on 9 November by the Preview build of pull request 28, which got past preflight: that check is a hard refusal, not a warning, so a build reaching Next at all is the evidence.",
 ""),
("5. Operations","5.1a","Decide whether Preview should have its own database",A,"No","Not started","",
 "The build runs prisma migrate deploy on every deployment, Preview included. If Preview and Production share one DATABASE_URL, a Preview build of any branch carrying a migration applies it to the production database before anybody has reviewed the pull request. A Neon branch database for Preview is the real answer, and it is a bigger job than item 5.1.",
 "Nothing has been harmed yet only because no branch in flight carries a migration."),
("5. Operations","5.2","Twilio sends, on a scoped API key",A,"No","Done","docs/deploying.md",
 "On 3 November a real passcode reached a real handset and a shopper signed in, the first time that has happened. DEMO_LOGIN_PHONES and DEMO_LOGIN_CODE are deleted. Production authenticates with the Standard key qumo-live, and the preflight's auth-token warning is gone from the build log, which is the confirmation that the scoped key is the one in use. The fix was copying the key SID and its secret off a single Twilio creation screen in one action.",""),
("5. Operations","5.2a","Delete TWILIO_AUTH_TOKEN from Vercel",A,"No","Not started","docs/deploying.md",
 "Dormant now, because resolveTwilioCredentials prefers the key pair when both halves are present. Delete it and redeploy.",
 "Until it is deleted, the master credential for the whole Twilio account sits in the environment: it can buy numbers, spend money and read every message ever sent, and it cannot be scoped or rotated on its own."),
("5. Operations","5.2b","Delete the surplus Twilio API keys",A,"No","Not started","",
 "Six exist for one integration. Keep qumo-live and delete the rest. That surplus is most of why the afternoon of 3 November went the way it did.",""),
("5. Operations","5.2c","An inbound SMS gets a reply",C,"No","Done","docs/deploying.md",
 "/api/sms/inbound answered in plain text, which Twilio reads as an application error: it logs a schema warning and sends the shopper nothing, so the channel looked like it worked from our side and was silence from theirs. It answers in TwiML now.",""),
("5. Operations","5.2d","The Twilio number answers",A,"No","Done","docs/deploying.md",
 "SMS_WEBHOOK_SECRET is set in Vercel and the number's A message comes in webhook points at /api/sms/inbound. Proved on 9 November by texting BALANCE from a real handset and getting a real answer back from production, which exercises the whole chain: carrier, Twilio, Vercel, the secret comparison, the handler, the TwiML envelope and the reply.",""),
("5. Operations","5.2e","Twilio answers HELP instead of us, and owns STOP",A,"No","Not started","",
 "JOIN is fine: YES reached handleJoin on 9 November and got our reply, so the SMS join flow can record consent. HELP never reaches us, so the one message whose job is to explain the service does not. STOP is Twilio's, which is mostly good because carrier-grade opt-out beats ours, except that handleStop never runs so our own record of who opted out is never written. The fix for all three is a Messaging Service, which allows the built-in keyword handling to be configured.",
 "Untested edge: a shopper who texts STOP is blocked at Twilio, and a later YES is likely consumed by Twilio as its own opt-in keyword, unblocking them without ever rejoining them at Qumo."),
("5. Operations","5.3","Vercel plan",A,"No","Not started","docs/deploying.md",
 "Hobby is licensed for non-commercial personal use only and Vercel reads that broadly.",""),
("5. Operations","5.4","Neon region",A,"No","Not started","",
 "The database is in us-east-2. Relevant to the POPIA section 72 question in item 2.4.",""),
("5. Operations","5.5","ERROR_WEBHOOK_URL is unset",A,"No","Not started","",
 "Nothing is alerting anywhere. This stopped being theoretical on 3 November: every failed passcode wrote sms send rejected with Twilio's own error code from 16:18 onwards, and nothing said so, which cost an afternoon.",""),
("5. Operations","5.6","Attach a reward to Copper Kettle's live Rounds card",A,"No","Not started","",
 "It completes at 10 and names nothing, so shoppers would collect forever and be handed nothing.",""),

("6. Brand and acquisition","6.1","Brand guide",A,"No","In progress","docs/brand-context.md",
 "Context file written and handed over for the brand guide.",""),
("6. Brand and acquisition","6.2","The acquisition site on qumo.co.za",A,"No","In progress","docs/website-brief.md",
 "Live and audited against the product. Copy corrections applied.",""),
("6. Brand and acquisition","6.3","Domains",AC,"No","Done","docs/website-brief.md",
 "Settled: site on qumo.co.za, product stays on qumo-app.com, the old apex redirects to the site. No migration, and standing the site up cannot affect anything running.",""),
("6. Brand and acquisition","6.4","The call to action",AC,"No","Waiting on someone","",
 "Depends on the signup decision in item 3.1. Until then it is \"request access\".",""),

("7. Housekeeping","7.1","Delete ?ui=stacked and the stacked branch with it",C,"No","Not started","",
 "Once the drawer has survived a real brand. Carrying two layouts is how one of them rots.",""),
("7. Housekeeping","7.2","Drop PurchaseScan.wasSigned",C,"No","Not started","",
 "Once nothing reads it. proofTier replaced it and both are written from one decision so they cannot disagree, but two columns meaning one thing is a trap for whoever reads them next.",""),
("7. Housekeeping","7.3","Rename the theme cookie",C,"No","Not started","",
 "Still cios_theme, from before the product was called Qumo.",""),
("7. Housekeeping","7.4","\"5% back\" is named for something it does not do",C,"No","Not started","",
 "It pays a flat R5 a scan. Demo data, but it is the first thing anybody sees.",""),
("7. Housekeeping","7.5","couponExpiryDate and codePrefix have no console field",C,"No","Not started","",
 "They can only be set in the database.",""),
("7. Housekeeping","7.6","Add QUMO_SLIP_READER to .env.example",C,"No","Not started","",
 "So the switch is discoverable before somebody needs it.",""),

("8. Parked","8.1","NFC tags",A,"No","Parked","",
 "A tag that opens <brand>.qumo-app.com/s/<code> works today with no code change, because a tag is just another way to carry a code. The catch is that every code earns once, ever, so a tag mounted permanently on a table or shelf would award once and then be dead. Permanent placements want the poster link, which deliberately awards nothing. Awarding NFC therefore means one tag per item, like an on-pack code, and the question is cost per tag rather than anything in the software.",""),
("8. Parked","8.2","Competitions and prize draws",A,"No","Parked","",
 "A different business with its own regulatory surface. If one is ever layered on Qumo codes, the terms need a competitions section first.",""),
("8. Parked","8.3","Marketing site for shoppers",A,"No","Parked","",
 "There isn't one and there shouldn't be; shoppers arrive from a poster or a pack.",""),
]

HEADERS = ["ID","Section","Item","Owner","Gates a pilot","Status","Target date","Warning","Detail","Reference","Your notes"]
WIDTHS  = [7, 32, 46, 16, 13, 19, 12, 42, 70, 30, 34]

wb = Workbook()

# ---------------------------------------------------------------- Open items
ws = wb.active
ws.title = "Open items"

ws["A1"] = "Qumo: what is still open"
ws["A1"].font = Font(name=ARIAL, size=16, bold=True, color=INK)
ws["A2"] = ("Status, Target date and Your notes are yours to edit. Everything else is generated from "
            "docs/open-items.md, so a change there is not a change here. Two red warnings below are "
            "load-bearing: read them before acting on items 3.2 and 3.3.")
ws["A2"].font = Font(name=ARIAL, size=10, italic=True, color="5A6472")
ws.merge_cells("A2:K2")
ws["A2"].alignment = Alignment(wrap_text=True, vertical="top")
ws.row_dimensions[2].height = 30

HROW = 4
for i, h in enumerate(HEADERS, start=1):
    c = ws.cell(row=HROW, column=i, value=h)
    c.font = Font(name=ARIAL, size=10, bold=True, color="FFFFFF")
    c.fill = HEAD_FILL
    c.alignment = Alignment(wrap_text=True, vertical="center")
    c.border = BOX
ws.row_dimensions[HROW].height = 26

for i, w in enumerate(WIDTHS, start=1):
    ws.column_dimensions[get_column_letter(i)].width = w

r = HROW + 1
first_data = r
section_of_row = {}
for (sec, iid, item, owner, gates, status, ref, detail, warn) in ROWS:
    vals = [iid, sec, item, owner, gates, status, None, warn, detail, ref, None]
    for i, v in enumerate(vals, start=1):
        c = ws.cell(row=r, column=i, value=v)
        c.font = Font(name=ARIAL, size=10, color=INK)
        c.alignment = Alignment(wrap_text=True, vertical="top")
        c.border = BOX
    ws.cell(row=r, column=1).font = Font(name=ARIAL, size=10, bold=True, color=INK)
    ws.cell(row=r, column=1).alignment = Alignment(horizontal="center", vertical="top")
    ws.cell(row=r, column=5).alignment = Alignment(horizontal="center", vertical="top")
    ws.cell(row=r, column=7).number_format = "yyyy-mm-dd"
    if warn:
        wc = ws.cell(row=r, column=8)
        wc.fill = WARN_FILL
        wc.font = Font(name=ARIAL, size=10, bold=True, color="9B1C1C")
    if gates == "Yes":
        gc = ws.cell(row=r, column=5)
        gc.font = Font(name=ARIAL, size=10, bold=True, color="9B1C1C")
    section_of_row[iid] = r
    r += 1
last_data = r - 1

ws.auto_filter.ref = f"A{HROW}:K{last_data}"
ws.freeze_panes = f"C{HROW+1}"

STATUSES = ["Not started","In progress","Waiting on someone","Blocked","Done","Parked"]
dv = DataValidation(type="list", formula1='"' + ",".join(STATUSES) + '"', allow_blank=True, showDropDown=False)
dv.error = "Pick one of the listed statuses."
dv.prompt = "Not started, In progress, Waiting on someone, Blocked, Done, Parked"
ws.add_data_validation(dv)
dv.add(f"F{first_data}:F{last_data}")

dvo = DataValidation(type="list", formula1='"Allan,Lawyer,Claude,Allan + lawyer,Lawyer + Claude,Allan + Claude"',
                     allow_blank=True, showDropDown=False)
ws.add_data_validation(dvo)
dvo.add(f"D{first_data}:D{last_data}")

rng = f"F{first_data}:F{last_data}"
ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"Done"'], fill=DONE_FILL))
ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"In progress"'], fill=PROG_FILL))
ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"Parked"'], fill=PARK_FILL))
ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"Blocked"'], fill=WARN_FILL))

# ------------------------------------------------------------------- Summary
sm = wb.create_sheet("Summary")
sm["A1"] = "Where things stand"
sm["A1"].font = Font(name=ARIAL, size=16, bold=True, color=INK)
sm["A2"] = "Every number here counts the Open items tab. Change a status there and these move."
sm["A2"].font = Font(name=ARIAL, size=10, italic=True, color="5A6472")

SECTIONS = []
for row in ROWS:
    if row[0] not in SECTIONS:
        SECTIONS.append(row[0])

def head(cell, text):
    sm[cell] = text
    sm[cell].font = Font(name=ARIAL, size=10, bold=True, color="FFFFFF")
    sm[cell].fill = HEAD_FILL
    sm[cell].alignment = Alignment(wrap_text=True, vertical="center")
    sm[cell].border = BOX

r0 = 4
head(f"A{r0}", "Section")
for i, s in enumerate(STATUSES):
    head(f"{get_column_letter(2+i)}{r0}", s)
head(f"{get_column_letter(2+len(STATUSES))}{r0}", "Items")
sm.row_dimensions[r0].height = 30

data = f"'Open items'!$B${first_data}:$B${last_data}"
stat = f"'Open items'!$F${first_data}:$F${last_data}"

r = r0 + 1
for s in SECTIONS:
    sm.cell(row=r, column=1, value=s).font = Font(name=ARIAL, size=10, color=INK)
    sm.cell(row=r, column=1).border = BOX
    for i, st in enumerate(STATUSES):
        col = 2 + i
        c = sm.cell(row=r, column=col, value=f'=COUNTIFS({data},$A{r},{stat},{get_column_letter(col)}${r0})')
        c.font = Font(name=ARIAL, size=10, color=INK)
        c.alignment = Alignment(horizontal="center")
        c.border = BOX
    tot = sm.cell(row=r, column=2+len(STATUSES), value=f'=SUM(B{r}:{get_column_letter(1+len(STATUSES))}{r})')
    tot.font = Font(name=ARIAL, size=10, bold=True, color=INK)
    tot.alignment = Alignment(horizontal="center")
    tot.border = BOX
    r += 1

sm.cell(row=r, column=1, value="All sections").font = Font(name=ARIAL, size=10, bold=True, color=INK)
sm.cell(row=r, column=1).fill = BAND_FILL
sm.cell(row=r, column=1).border = BOX
for i in range(len(STATUSES) + 1):
    col = 2 + i
    cl = get_column_letter(col)
    c = sm.cell(row=r, column=col, value=f"=SUM({cl}{r0+1}:{cl}{r-1})")
    c.font = Font(name=ARIAL, size=10, bold=True, color=INK)
    c.alignment = Alignment(horizontal="center")
    c.fill = BAND_FILL
    c.border = BOX
total_row = r

r += 3
sm.cell(row=r, column=1, value="Still open, by owner").font = Font(name=ARIAL, size=12, bold=True, color=INK)
r += 1
head(f"A{r}", "Owner")
head(f"B{r}", "Not done")
head(f"C{r}", "Of those, gates a pilot")
owner_head = r
owners = f"'Open items'!$D${first_data}:$D${last_data}"
gates = f"'Open items'!$E${first_data}:$E${last_data}"
r += 1
for o in ["Allan","Lawyer","Claude","Allan + lawyer","Lawyer + Claude","Allan + Claude"]:
    sm.cell(row=r, column=1, value=o).font = Font(name=ARIAL, size=10, color=INK)
    sm.cell(row=r, column=1).border = BOX
    b = sm.cell(row=r, column=2, value=f'=COUNTIFS({owners},$A{r},{stat},"<>Done",{stat},"<>Parked")')
    g = sm.cell(row=r, column=3, value=f'=COUNTIFS({owners},$A{r},{stat},"<>Done",{stat},"<>Parked",{gates},"Yes")')
    for c in (b, g):
        c.font = Font(name=ARIAL, size=10, color=INK)
        c.alignment = Alignment(horizontal="center")
        c.border = BOX
    r += 1

r += 2
sm.cell(row=r, column=1, value="Gates a pilot and not yet done")
sm.cell(row=r, column=1).font = Font(name=ARIAL, size=12, bold=True, color=INK)
sm.cell(row=r, column=2, value=f'=COUNTIFS({gates},"Yes",{stat},"<>Done")')
sm.cell(row=r, column=2).font = Font(name=ARIAL, size=14, bold=True, color="9B1C1C")
sm.cell(row=r, column=2).alignment = Alignment(horizontal="center")
r += 1
sm.cell(row=r, column=1, value="Nothing under section 1 is optional before a real shopper signs up.")
sm.cell(row=r, column=1).font = Font(name=ARIAL, size=10, italic=True, color="5A6472")

sm.column_dimensions["A"].width = 36
for i in range(2, 10):
    sm.column_dimensions[get_column_letter(i)].width = 16

# -------------------------------------------------------- Self-serve signup
ss = wb.create_sheet("Self-serve signup")
ss["A1"] = "On self-serve signup, since it is being weighed"
ss["A1"].font = Font(name=ARIAL, size=16, bold=True, color=INK)
ss["A2"] = ("Three pieces of very different size. It is less \"build self-service signup\" than \"replace "
            "the human gate with a payment gate\", and what is on the other side stays an invite.")
ss["A2"].font = Font(name=ARIAL, size=10, italic=True, color="5A6472")
ss.merge_cells("A2:C2")
ss["A2"].alignment = Alignment(wrap_text=True, vertical="top")
ss.row_dimensions[2].height = 30

head_cells = ["Piece", "State", "What it is"]
for i, h in enumerate(head_cells, start=1):
    c = ss.cell(row=4, column=i, value=h)
    c.font = Font(name=ARIAL, size=10, bold=True, color="FFFFFF")
    c.fill = HEAD_FILL
    c.border = BOX
    c.alignment = Alignment(vertical="center")
ss.row_dimensions[4].height = 24

PIECES = [
 ("1. Subscription state","Done",
  "Per-brand TRIALING / ACTIVE / CANCELLED / CLOSED, cancel, resume, period end, and a nightly job that closes elapsed programmes. Already load-bearing: it decides whether scans earn, and the 60-day honour window hangs off it."),
 ("2. Taking money","Nothing exists",
  "No provider wired at all. A provider, a webhook, a return URL."),
 ("3. Issuing the invite","Partly there",
  "The provision route and setup key are already an invite mechanism. What is missing is generating a one-time link rather than handing a key over by hand."),
]
r = 5
for p, st, d in PIECES:
    for i, v in enumerate((p, st, d), start=1):
        c = ss.cell(row=r, column=i, value=v)
        c.font = Font(name=ARIAL, size=10, color=INK)
        c.alignment = Alignment(wrap_text=True, vertical="top")
        c.border = BOX
    ss.cell(row=r, column=1).font = Font(name=ARIAL, size=10, bold=True, color=INK)
    if st == "Done":
        ss.cell(row=r, column=2).fill = DONE_FILL
    elif st == "Nothing exists":
        ss.cell(row=r, column=2).fill = WARN_FILL
    else:
        ss.cell(row=r, column=2).fill = PROG_FILL
    r += 1
ss.column_dimensions["A"].width = 24
ss.column_dimensions["B"].width = 18
ss.column_dimensions["C"].width = 92

# ------------------------------------------------------------------ Read me
rm = wb.create_sheet("Read me")
rm["A1"] = "Read me"
rm["A1"].font = Font(name=ARIAL, size=16, bold=True, color=INK)

LINES = [
 ("Two warnings first", "head"),
 ("Do not set QUMO_DORMANT_ERASE_AFTER_DAYS without reading item 4 of docs/popia.md. The dormancy sweep "
  "would erase unspent balances along with the dormant account, and POPIA section 14 pulls against CPA "
  "sections 35 and 63 on exactly that point. Item 3.2.", "warn"),
 ("A cloud slip reader makes that vendor a POPIA operator and, if it is offshore, a section 72 transborder "
  "flow the shopper notice has to disclose. A reader running in our own process avoids all of it. Item 3.3.", "warn"),
 ("", "gap"),
 ("What the tabs are", "head"),
 ("Open items: one row per item, grouped by section, filterable. Edit Status, Target date and Your notes. "
  "Leave ID, Section, Item, Owner, Gates a pilot, Warning, Detail and Reference alone, because they are "
  "generated and will be overwritten if this file is rebuilt.", "body"),
 ("Summary: counts, all by formula off the Open items tab. Change a status there and these move.", "body"),
 ("Self-serve signup: the three pieces, since the decision is being weighed.", "body"),
 ("", "gap"),
 ("Owners", "head"),
 ("Allan: yours. Lawyer: needs a lawyer and therefore calendar time. Claude: can be built. "
  "A pair means both are needed.", "body"),
 ("", "gap"),
 ("Statuses", "head"),
 ("Not started, In progress, Waiting on someone, Blocked, Done, Parked. Done and Parked both drop out of "
  "the by-owner counts on the Summary tab; Blocked does not, on purpose.", "body"),
 ("", "gap"),
 ("Where this came from", "head"),
 ("Generated from docs/open-items.md on 28 October 2026. That file is the narrative version, with the "
  "reasoning in prose, and it is the one to hand to a lawyer. This file is the tracker. If you keep status "
  "here, status lives here, and the markdown stays a description of the work rather than a record of it.", "body"),
 ("", "gap"),
 ("Documents referenced", "head"),
 ("docs/popia.md, docs/terms-brief.md, docs/legal-draft-for-review.md, docs/consent-copy.md, "
  "docs/photo-capture.md, docs/competitive-position.md, docs/vaultbook-review.md, docs/brand-context.md, "
  "docs/website-brief.md, docs/deploying.md, lib/consumer/consent.ts", "body"),
]
r = 3
for text, kind in LINES:
    if kind == "gap":
        r += 1
        continue
    c = rm.cell(row=r, column=1, value=text)
    if kind == "head":
        c.font = Font(name=ARIAL, size=12, bold=True, color=INK)
    elif kind == "warn":
        c.font = Font(name=ARIAL, size=10, bold=True, color="9B1C1C")
        c.fill = WARN_FILL
        c.border = BOX
    else:
        c.font = Font(name=ARIAL, size=10, color=INK)
    c.alignment = Alignment(wrap_text=True, vertical="top")
    r += 1
rm.column_dimensions["A"].width = 118

ws.page_setup.orientation = "landscape"
ws.page_setup.fitToWidth = 1
ws.page_setup.fitToHeight = 0
ws.sheet_properties.pageSetUpPr.fitToPage = True
ws.print_title_rows = f"{HROW}:{HROW}"

order = ["Read me", "Open items", "Summary", "Self-serve signup"]
wb._sheets = [wb[name] for name in order]
wb.active = order.index("Open items")
wb.save(OUT)
print("rows", len(ROWS), "data", first_data, last_data, "total_row", total_row)
