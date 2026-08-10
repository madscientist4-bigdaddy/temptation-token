# Round automation — decision memo after the second DON stall

**Written:** 2026-08-10, immediately after manually settling Round 6.
**Decision needed from:** Jim. One option, this week.

---

## What just happened, verified

| Fact | Evidence |
|---|---|
| Round 6 ended 2026-08-10 04:59 UTC | `getRound(6).endTime = 1786337940` |
| It was still unsettled ~14h later | `settled=false, vrfPending=false` at 18:2x UTC |
| **The contract was signalling correctly** | `Keeper3.checkUpkeep()` → `upkeepNeeded=true, action=3 (SETTLE)` |
| VRF was funded and wired | sub balance 32.77 LINK; V3d is a registered consumer |
| Manual settle worked first try | tx `0xe2bf8ad5…d805937`, then `0xe724e228…58a2a7ca6` |
| Round 6 was zero-vote | `totalTickets=0`, `totalRawVotes=0`, V3d TTS balance 0 — no payout, no burn, no NFT mint (Trophy `totalSupply()` still 0) |
| Round 7 started correctly | `currentRoundId=7`, `endTime=1786942740` = Sun 2026-08-16 23:59 ET ✓ |
| VRF fulfilled promptly once requested | settled within the wait loop, no stall |

**This is the important line:** `checkUpkeep()` returned `true`, and the DON did not call
`performUpkeep` for fourteen hours. Our contract logic, our VRF subscription and our
`s_nextSettleTarget` arithmetic are all fine. **The failure is entirely on the Chainlink
Automation execution side.** This is the second occurrence (Round 4, 2026-07-20, was the
first — that one compounded into an unfulfilled VRF and blocked Round 5).

Two stalls in three weeks is not an incident, it is the baseline. Plan for it.

---

## The options

### (a) Re-register the upkeep on the current registry
Cancel upkeep `1134463145…455208` and register a fresh one against the same
`TTSKeeper3` target on registry `0xf4bAb6A1…f8743`.

- **Cost:** ~15 minutes, plus re-funding LINK. Cancellation has a withdrawal delay.
- **Fixes it if** the cause is a corrupted/stale upkeep registration — a real failure mode,
  and cheap to rule out.
- **Does not fix it if** the cause is DON-side capacity or a gas-price ceiling, in which
  case you will be back here in a fortnight with a third stall and less patience.
- **Unknown:** I could not read the upkeep's `lastPerformedBlockNumber`, LINK balance or
  paused flag — the registry's `getUpkeep` ABI on this version does not match the shape I
  had. **Check the Chainlink Automation UI before choosing this**: if it shows the upkeep
  underfunded or paused, this option becomes the obvious answer and the diagnosis is done.

### (b) Migrate to Chainlink CRE
- **Cost:** days of work, new integration surface, new failure modes, and a rewrite of the
  keeper wiring that is currently correct and proven.
- **Buys you:** a more modern runtime — but the same operator set and the same trust
  assumption that someone else's infrastructure calls your function on time.
- **Verdict:** this is a migration project dressed as a fix. You have two data points, both
  consistent with "Automation is unreliable for us," and none pointing at a defect CRE
  specifically solves. Do not spend the week on it now.

### (c) Weekly manual cadence + alerts
Keep Chainlink as the primary trigger. Add a monitor that checks `checkUpkeep()` a few
hours after each scheduled boundary and alerts if `upkeepNeeded` has been true for too
long; settle with the fallback script when it fires.

- **Cost:** ~2 hours. The mechanism already exists and is proven — `manual_settle_fallback.mjs`
  worked today with correct guards (chainId check, Bank-signer check, owner check,
  refuses when `checkUpkeep` says nothing is due).
- **Buys you:** the outcome you actually care about — rounds never stall for 14 hours
  again — without betting on a vendor fix.
- **Weakness:** it is a human-in-the-loop system. It degrades the moment you are on a plane.
  Mitigate by alerting to a channel someone else watches, not only your Mac.

---

## Recommendation — (c), plus the cheap half of (a)

Do **(c)** as the load-bearing fix, this week. It is the only option that makes the outcome
independent of Chainlink behaving, and it costs an afternoon.

Do the **diagnostic half of (a)** first because it is nearly free: open the Automation UI,
read the upkeep's balance, paused flag and last-performed time. If it is underfunded or
paused, you have your root cause and re-registering is the right fix — but you still want
(c), because the point of (c) is that you find out in an hour instead of a day.

Do **not** do (b) now. Revisit only if (c)'s alerting shows Chainlink missing boundaries
repeatedly *after* the upkeep is confirmed healthy — at that point you have evidence that
the platform is the problem, which is the premise CRE migration needs and you do not yet have.

### Concretely, for (c)

1. Cron at `Mon 06:00 UTC` and `Mon 09:00 UTC` (1h and 4h past the 04:59 boundary): call
   `Keeper3.checkUpkeep()`; if `upkeepNeeded == true`, alert.
2. Alert to the Telegram admin chat (`-5273368658`) via `@TTSBroadcastBot` — infrastructure
   that already exists — not to email.
3. Runbook line: `node --env-file=.env outputs/manual_settle_fallback.mjs` to inspect, add
   `--execute --wait` to act. The script refuses to write when nothing is due, so a false
   alarm is harmless.
4. Add the same check to `api/scheduler.js` only if you want it serverless — note the
   12-function Vercel ceiling; this fits inside the existing `scheduler.js`, do not add a
   13th function for it.

### Also worth fixing while you are here

**Round rollover does not carry profiles.** Round 7 started with `profileCount=0` while 18
approved profiles existed — the play screen would have been empty all week. I fixed it by
calling `profiles?action=sync` (tx `0x0ec58195…d29dc72`, 18 added). Nothing in the settle
path does this automatically. Whatever cadence you choose, **`?action=sync` must run after
every round start**, or the game is live with nothing to vote on. Fold it into the same
cron as the checkUpkeep alert.
