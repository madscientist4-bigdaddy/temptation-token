# Chainlink Automation outage on Base — investigation, 2026-08-21

**Verdict: Chainlink Automation has stopped performing upkeeps on Base entirely. Our upkeep
is correctly configured and fully funded, and it will never fire again on this registry.
Round settlement is currently a manual weekly Bank transaction.**

Session was READ-ONLY for mainnet. Every finding below is from on-chain reads. No transaction
was sent.

---

## How this surfaced

CLAUDE.md's open watch item was "round 7 settles 2026-08-17 — confirm `Trophy.totalSupply()`
goes 0 → 3." It did (see below). But `scripts/verify-round-settlement.mjs` also reported
**🚨 ACTION NEEDED: Chainlink has not performed this upkeep in 18.6 days**, and the keeper's
event log showed round 7 had been closed by hand:

```
2026-08-17T23:33:17Z ManualExecuted action=3 (SETTLE)      caller 0xb1e991bf… (Bank)
2026-08-17T23:33:33Z ManualExecuted action=1 (START_ROUND) caller 0xb1e991bf… (Bank)
```

Round 7 closed at 04:59 UTC. It was rescued **18.5 hours late**. Round 6 was the same story:
closed 2026-08-10 04:59 UTC, rescued by hand at 22:43 UTC, **17.7 hours late**.

## The upkeep is not the problem

Every conventional health signal reads green (verified 2026-08-21):

| Signal | Value | Verdict |
|---|---|---|
| `getUpkeep().balance` | 43.97 LINK (min 2.17) | funded ~20× over |
| `paused` | `false` | active |
| `maxValidBlocknumber` | `2^32-1` | not cancelled |
| `target` | Keeper3 `0x363Ce496…` | correct |
| `performGas` | 500,000 | vs a **132,736** gas real settle — 3.8× headroom |
| registry `getForwarder` | `0x1aF4b228…` | **==** `Keeper3.s_forwarder` ✓ |
| `Keeper3.checkUpkeep()` | returned `true` for ~18h | work was visibly due |
| registry `typeAndVersion()` | **`AutomationRegistry 2.3.0`** | current version |
| registry `getState().paused` | `false`, 191 upkeeps, 10 transmitters | registry live |

Gas was the obvious suspect and it is ruled out: the manual `manualExecute(3)` settle used
132,736 gas and `manualExecute(1)` used 92,016, both far under the 500k cap. The last
successful automated perform (2026-08-03) used 271,633 including registry overhead.

## The registry stopped serving everyone

Contiguous `UpkeepPerformed` scan of registry `0xf4bAb6A129164aBa9B113cB96BA4266dF49f8743`,
10k-block windows, retry-on-failure with explicit gap accounting:

| Block range | Wall-clock | Performs | Distinct upkeeps |
|---|---|---|---|
| 49,460,000 → 49,700,000 | → 2026-08-05 | **278** | 32 |
| 49,700,000 → 50,274,317 | 2026-08-05 → 2026-08-21 | **0** | 0 |

The second scan covered **58 of 58 windows with zero RPC failures** — this is a real absence,
not a gap in the data. Last perform registry-wide: **2026-08-05 13:35:07 UTC**. Sixteen days
of total silence across all 191 registered upkeeps.

The only registry activity since is other teams evacuating — sampled recent windows contain
`UpkeepCanceled` events and fund withdrawals, and nothing else:

```
2026-08-19T21:20:55Z UpkeepCanceled id 8975043369…
2026-08-16T19:07:23Z UpkeepCanceled id 1013418939…
2026-08-13T15:44:57Z UpkeepCanceled id 8112255665…
```

Our own upkeep's last perform (2026-08-03) predates the registry-wide stop only because our
upkeep has work exactly twice a week; the registry died two days later.

## Why no version check would have caught this

The 2026-07-28 CRE research concluded no migration was needed, on solid evidence: the
published sunsets are **v1.x → 2026-06-30** and **v2.1 → 2026-07-31**, and `typeAndVersion()`
returns **2.3.0**, which has no published sunset. That is still literally true today. The
service stopped anyway. Chainlink's Automation docs now carry a banner reading *"Migrate to
the Chainlink Runtime Environment (CRE), which does everything and more … migrate before
these dates to avoid service disruption."*

**Lesson: for a scheduled-execution dependency, liveness is the only health check that
counts.** Funding, pause state, version, forwarder wiring and `checkUpkeep()` were all green
through sixteen days of doing nothing.

## Round 7 result (the watch item — closed)

- `Trophy.totalSupply()` **0 → 3**, exactly as designed (winner / top voter / house)
- token #1 owner `0xE15D72310aE15874cDBD3D79D3f9cE35730551c5`
- token #1 `tokenURI` resolves **HTTP 200** — it will actually render in a wallet
- 5 TTS of votes across 18 profiles
- rollover to round 8 correct, `endTime` on the Monday 04:59 UTC calendar pin

## What was changed this session (off-chain only)

- `scripts/launchd/io.temptationtoken.round-audit.plist` — was a **single** Monday 06:00 ET
  fire, i.e. a post-mortem, and **had never actually run** (installed 2026-08-17 15:38 ET,
  after that week's fire time). Now three fires: **Sun 20:00 ET** (~5h before close, warns
  while there is still time to prepare), **Mon 02:00 ET** (~1h after the 00:59 ET close,
  catches a stall the same night instead of 18h later), **Mon 06:00 ET** (backstop /
  sleep catch-up). Reinstalled and verified loaded.
- `outputs/cre_migration_plan.md` — headline corrected; its "nothing forces a migration"
  decision gate now resolves to MIGRATE.
- `CLAUDE.md` — re-anchored to 2026-08-21.

`scripts/verify-round-settlement.mjs` needed no change: it already ages the last perform
against an 8-day threshold and probes registry-wide liveness, and it correctly reported
`🚨 ACTION NEEDED` with exit 1 on every run.

## What needs Jim (all chain transactions)

1. **Before Monday 2026-08-24 04:59 UTC** — round 8 will not settle itself:
   `node --env-file=.env outputs/manual_settle_fallback.mjs --execute --wait`
   Read-only pre-flight re-verified today; mid-round it correctly reports "nothing due".
2. **CRE migration** (`outputs/cre_migration_plan.md` Priority 2) — the only route back to
   unattended settlement. CRE access is gated Early Access, so step one is requesting it.
   Cutover ends with `Keeper3.setForwarder(<AutomationReceiver>)` from Bank. Keeper3 and V3d
   are unchanged by this; only the caller changes.
3. **Reclaim 43.97 LINK** (Priority 3) — only after CRE is proven live. Cancel, wait the
   post-cancel block delay, withdraw.
