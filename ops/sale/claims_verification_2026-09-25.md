# Strengths + Scripts — claim-by-claim verification
**2026-09-25.** Every line in the v2 workbook's Strengths and Scripts tabs, checked against
the chain, the production database and the live app. Verdicts: **HOLDS** / **NEEDS CAVEAT**
/ **STRUCK**.

The workbook itself has been annotated — struck rows are prefixed `[STRUCK 2026-09-25]` and
a `Verified 2026-09-25` column carries the verdict and the corrected wording. Nothing was
silently rewritten.

---

## STRUCK — six claims that do not hold

### 1. "APK live now" (Google Play row) — **STRUCK**
There is no APK. No `.apk` file in the repo, no route serving one, and
`app.temptationtoken.io/download` returns the **SPA catch-all** — an 8.8 KB app shell with
the ordinary app `<title>`, not a download page. A buyer clicking "Android app" today gets
the web app.
**Corrected:** "Android build is code-complete and builds via EAS; no APK is published yet
and no Play Console app exists."

### 2. "The TestFlight build transfers for a buyer who wants a native route" — **STRUCK**
`mobile/eas.json` still contains three literal placeholders — `REPLACE_WITH_APPLE_ID_EMAIL`,
`REPLACE_WITH_APP_STORE_CONNECT_APP_ID`, `REPLACE_WITH_APPLE_TEAM_ID`. A TestFlight build
cannot exist without an Apple Developer account, and there isn't one.
**Corrected:** "The iOS project is configured for TestFlight (privacy manifests, purpose
strings, encryption declaration all done in-repo) and needs only an Apple Developer
account to submit."

### 3. "self-serve club program — any venue can run its own weekly fan vote from a phone" (call opener) and "your club can join from a phone in about two minutes" (club visit) — **STRUCK**
Club registration is **admin-only**. `api/set-club-wallet.js` calls `requireAdmin` on every
write path, and its own comment says "Approval is the one human gate." `pending_clubs` has
**0 rows**; `club_partners` has **0 rows**. There are no club partners and no self-serve
path. `temptationtoken.io/clubs` returns **404**, so "[Scan the /clubs QR together]" points
at a dead URL.
**Corrected:** "A club partner program is built and wired on-chain — a club code links to a
wallet and its 10% share pays automatically on settlement. Registration is currently
approved by us rather than self-serve."

### 4. "AI Models division: always-on demo content plus a clearly labeled AI category" — **STRUCK**
Not built. Zero AI-generated profiles exist, no badge or filter ships in any client, and
`ops/sale/rotation_log.csv` (cited as proof) does not exist. The database columns landed
2026-09-25; nothing else has. Blocked on `IMAGE_API_KEY`.
**Corrected:** "Schema and constraints for a labelled AI-model category are deployed;
generation and display are not built yet." Do not offer board screenshots or a rotation
log as proof — neither exists.

### 5. "Runs on automation: settlement autopilot, Social Composer, daily digest, **weekly AI rotation**" — **STRUCK (in part)**
Settlement autopilot: real and proven. Social Composer: real. Daily digest: built and
scheduled, but **has never sent** — no Proton Bridge credentials on the machine. Weekly AI
rotation: **does not exist.**
**Corrected:** "Runs on automation: settlement autopilot (proven over four consecutive
rounds), Social Composer, and a daily operations digest."

### 6. "Legal review complete … Counsel sign-off letter" — **STRUCK**
`outputs/legal/` contains **self-drafted** material: a risk memo, privacy policy, terms,
DMCA policy, trademark guide, a cease-and-desist template. There is **no counsel sign-off
letter** and no evidence of external review. Offering one as proof invites a buyer to ask
for it.
Also in the same row: "free first vote built in" — **no such feature exists.** The real
mechanism is a 500 TTS signup bonus, which does let someone vote without buying (minimum
vote is 5 TTS).
**Corrected:** "Policies drafted in-house (terms, privacy, DMCA, trademark) and a written
risk memo. No external counsel opinion yet. New players receive 500 $TTS free on signup,
enough for 100 minimum votes, so nobody has to buy in to play."

---

## NEEDS CAVEAT — two

### 7. "No blacklist — provably: the contract has no function that can ever freeze an address"
**The blacklist half is true and verified** — the `blacklisted` mapping is read on every
transfer and **no function anywhere writes to it**. No address can ever be blacklisted.

But `pause()` exists. `PAUSER_ROLE` currently has **no holders** (verified: neither the Safe
nor the Bank holds it, and `paused()` is false), yet the Safe holds `DEFAULT_ADMIN_ROLE` and
can grant it. A pause freezes **every** transfer, not one address. A buyer's auditor will
raise this, so say it first.
**Corrected:** "No address can ever be blacklisted — the mapping exists but has no setter,
provably. A global pause function does exist; PAUSER_ROLE has no holders today and the
multisig would have to grant it, which the proposed 48-hour timelock would make a public,
delayed action."

### 8. "the buyer is paying for a proven machine at below replacement cost"
Rests on the replacement-cost sheet, which is being built from git history
(`outputs/sale/data_room/replacement_cost.md`). Hold the phrase until that sheet exists,
then quote its number rather than the adjective.

---

## HOLDS — verified, use freely

| Claim | Evidence |
|---|---|
| "23 players, 3 votes to date" | production database, 2026-09-25 |
| "Rounds 9–12 each settled unattended within 30 minutes of close — four in a row" | **holds, and tighter than claimed: 19.6, 22.4, 17.3 and 18.3 minutes.** From `admin_audit_log` SETTLE rows cross-checked against `getRound()` end times |
| "Immutable token — nobody can change its code; any audit the buyer commissions stays valid permanently" | `proxiableUUID()` returns instead of reverting; EIP-1967 slot is zero; 20,747 B of code. Sound reasoning, and a genuine strength |
| "Empty EIP-1967 slot; bytecode on Basescan" | slot read as zero; **both the token and V3d show "Contract Source Code Verified" on BaseScan** |
| "Supply is governed by a 2-of-2 multisig: expansion needs both signatures" | executed on a mainnet fork — granted MINTER, minted 1B, 69B → 70B |
| "Only a transfer of exactly zero tokens is affected. Normal transfers, swaps and the new liquidity route all passed fork tests" | fork transcript; a 100 TTS taxed transfer delivered 99 TTS correctly |
| "card buys up to $1,000 at 3.26% impact ($500 at 1.92%) … funded with 0.0101% of the Safe's TTS" | fork-measured, `outputs/sale/liquidity_forktest.md`. Add "once Safe tx #1 executes" every time — it is not true yet |
| "no Apple review gate and no 30% commission" | correct for a web app |
| "48-hour timelock package ready to install at close" | true once item 2 lands; it is built and fork-tested, not executed |

---

## Two other things to fix in the Scripts tab

**Email 2's example placeholder reads "audit underway".** No audit is underway — the
SolidProof contact is quote-only by decision. Using that example risks someone pasting it.
Replace the example list with things that are actually true in the week they are sent:
"card purchases live, deeper liquidity, Round 14 settled."

**Email 2 claims the data room covers "monthly running cost … and the transfer runbook."**
The cost sheet needs Jim's real invoice figures and the transfer runbook is a draft. Either
finish both before Oct 6 or drop them from the sentence.

---

## One thing that is better than the workbook claims

Three of the four SETTLE rows in `admin_audit_log` are recorded `status:"no_state_change",
moved:false` — yet the chain shows every one of those rounds settled and the next round
opened. The runner re-reads state too quickly after sending, so it under-reports its own
successes. That is why `keeper-status.lastSettlement` still names round 11.

**Consequence for the sale:** always prove the settlement record **from the chain**
(`round_history.csv`), never from our audit table, which makes the autopilot look worse
than it is. **Consequence for operations:** the 24-hour runaway cap counts rows in that same
table, so it is miscounting. Logged as a bug to fix, not a blocker.
