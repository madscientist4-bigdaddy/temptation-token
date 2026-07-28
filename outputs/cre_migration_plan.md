# Chainlink Automation → CRE — research + migration plan (2026-07-28)

**Research + plan only. No mainnet writes were made.** The one deliverable built this
round is `outputs/manual_settle_fallback.mjs` (tested read-only against mainnet).

---

## ⛔ HEADLINE CORRECTION — our upkeep is NOT on a sunsetting registry

The premise "our upkeep is on registry v2.3 (Base) which is deprecated/sunsetting July 31"
is **not supported by the docs or the chain.** Verified two ways:

- **On-chain:** `typeAndVersion()` on our registry `0xf4bAb6A129164aBa9B113cB96BA4266dF49f8743`
  returns **`"AutomationRegistry 2.3.0"`** — the *newest* Automation registry — and our
  upkeep `113446…5208` lives on it (getMinBalance = 2.4 LINK). *(cast call, Base mainnet.)*
- **Docs:** Base Mainnet lists exactly this one registry, unmarked as deprecated
  ([supported-networks](https://docs.chain.link/chainlink-automation/overview/supported-networks)).
  The published sunsets are **v1.x → June 30 2026** and **v2.1 → July 31 2026** — **v2.3 has
  NO published sunset date**
  ([manage-upkeeps](https://docs.chain.link/chainlink-automation/guides/manage-upkeeps),
  [cla-migration-go](https://docs.chain.link/cre/reference/cla-migration-go)).

**What the "Deprecated" badge means:** per the docs, the badge appears on **pre-v2.1**
upkeeps, and for those "Unmigrated upkeeps on registries earlier than v2.1 will not be
performed anymore" ([release-notes](https://docs.chain.link/chainlink-automation/overview/automation-release-notes));
hovering it "displays a link you can click to begin the migration process"
([llms-full.txt](https://docs.chain.link/chainlink-automation/llms-full.txt)). A v2.3 upkeep
**should not** show a Deprecated badge and should keep firing. **If you are genuinely seeing
one on ours, that contradicts the docs** — resolve it before assuming a deadline (Step J1).

**Bottom line:** nothing forces a migration by July 31. Our settlement automation keeps
running. The real risk this week is a *VRF stall* (Round 4), not automation sunset — which is
exactly why the fallback script below matters regardless of CRE.

---

## Findings (cited)

**Q1 — Timeline / badge.** v1.x sunsets 2026-06-30; v2.1 sunsets 2026-07-31 (testnet 06-24);
v2.0-and-earlier registrars already deprecated & no longer performed. v2.3 = current, no
sunset. Badge = pre-v2.1 EOL marker with an in-app migrate link. *(release-notes,
manage-upkeeps, llms-full.txt — VERIFIED.)*

**Q2 — Custom-logic path.** You CANNOT point CRE directly at `Keeper3.performUpkeep`. The
official path (Automation-Migration starter, "Bridge" pattern): author a CRE **workflow**
(Cron trigger for time-based, EVM-Log trigger for log-based) that replicates your checkUpkeep
condition, and deploy a template **`AutomationReceiver.sol`** wired to the CRE
**KeystoneForwarder**; the workflow submits a signed report to the receiver, which "calls the
original `performUpkeep` function on your target contract." Steps: `cre init
--template=automation-migration-go …` → deploy `AutomationReceiver` → `setCallAllowed()` →
author + `cre workflow simulate` → `cre workflow deploy`. **Keeper3 itself is unchanged** — the
receiver becomes its new caller (replace `s_forwarder` with the receiver). *(cla-migration-go —
VERIFIED. Effort estimate: not published.)*

**Q3 — CRE funding model.** **Not publicly specified.** Docs state only "ETH for gas (registry
ops)" to register a workflow on the onchain Workflow Registry
([deploying-workflows](https://docs.chain.link/cre/guides/operations/deploying-workflows)); the
launch blog mentions x402 as *one* payment path
([blog](https://chain.link/blog/chainlink-runtime-environment-now-live)). There is **no
documented LINK-balance / per-perform billing equivalent** to the old per-upkeep model yet.
*(UNCERTAIN — treat CRE billing as TBD.)*

**Q4 — Mechanics / deadline.** Migration is **manual** (no auto-migration); v1.2+ can migrate
in-app or via block scanner, but moving to **CRE is a separate manual rebuild**. Supported
upkeeps keep running until their registry's sunset; only pre-v2.1 have stopped. Our v2.3 upkeep
runs normally with **no hard deadline**. *(manage-upkeeps, llms-full.txt — VERIFIED.)*

**Q5 — Base + LINK recovery.** Base **is** a supported CRE network (CLI/Go v1.0.0+, TS v1.0.1+),
but CRE overall is **Early Access / gated onboarding**
([cre](https://docs.chain.link/cre), [supported-networks-ts](https://docs.chain.link/cre/supported-networks-ts),
blog). **LINK withdrawal:** you must **cancel first**, then wait a **network-dependent block
delay** before withdrawing (llms-full.txt cites "50 blocks" but manage-upkeeps says it "varies
by network" — treat 50 as indicative for Base, confirm live). A **0.1 LINK cancellation fee**
applies if lifetime fees < 0.1 LINK
([automation-economics](https://docs.chain.link/chainlink-automation/overview/automation-economics)).
*(Base-exact block delay + CRE forwarder address on Base: NOT FOUND — confirm in-app.)*

---

## THE PLAN — split by owner

### Priority 0 — Guarantee Sunday Aug 2 (DONE / ready, independent of CRE)
- **[CLAUDE ✅ done]** Built + tested `outputs/manual_settle_fallback.mjs`. Default run is a
  read-only pre-flight (verified against mainnet: Keeper3.owner == Bank, checkUpkeep decoded,
  current state = Round 4 vrfPending → correctly routed to the VRF runbook, NOT to --execute).
- **[JIM — only if the upkeep doesn't fire Sunday night]** With the Bank key:
  `node --env-file=.env outputs/manual_settle_fallback.mjs` (see what's due), then
  `… --execute --wait` (settle → wait for VRF → start next round). One command. The script
  refuses to act if nothing is due and aborts a SETTLE if VRF is already pending (that's the
  stall case → `outputs/round4_vrf_recovery_runbook.md`).

### Priority 1 — Resolve the Deprecated-badge discrepancy (do this FIRST, ~5 min)
- **[JIM — J1]** In automation.chain.link, open upkeep `113446…5208`, **hover the "Deprecated"
  badge**, and note (a) exactly where the migrate link points and (b) the registry version the
  app shows for the upkeep. Screenshot it. Per docs a v2.3 upkeep shouldn't show this.
- **[CLAUDE]** Update `CLAUDE.md` (it currently implies the Base registry/upkeep is on a
  sunsetting version) to record: registry = AutomationRegistry 2.3.0, current, no sunset.
- **Decision gate:** if the badge is a UI artifact / points at nothing actionable → **no
  migration needed now**; keep the v2.3 upkeep funded and stop here. If it genuinely flags EOL
  → proceed to Priority 2.

### Priority 2 — CRE migration (ONLY when Jim decides / if the badge is real; not urgent)
- **[JIM — J2]** Request/confirm CRE deployment access for the project (Early Access is gated).
- **[CLAUDE — C1]** Scaffold `cre init --template=automation-migration-go`; author the workflow
  replicating `checkUpkeep` (Cron trigger on the weekly settle target; reads V3d round state),
  and prepare `AutomationReceiver.sol` targeting Keeper3.performUpkeep. `cre workflow simulate`.
- **[CLAUDE — C2]** Draft the cutover runbook (gated, no execution): deploy AutomationReceiver
  wired to the Base KeystoneForwarder → `setCallAllowed(Keeper3, performUpkeep-selector)` →
  `cre workflow deploy`.
- **[JIM — J3]** Fund/authorize per CRE's model (TBD — confirm at that time) and, from Bank,
  `Keeper3.setForwarder(<AutomationReceiver>)` so CRE becomes the caller. Verify one live
  settle+start cycle end-to-end on the new path **before** touching the old upkeep.

### Priority 3 — Reclaim the ~43.98 LINK (ONLY after Priority 2 is proven live)
- **[JIM — J4]** In automation.chain.link, **Cancel** upkeep `113446…5208` (admin = upkeep
  admin). Note: a **0.1 LINK** min-fee may apply.
- **[JIM — J5]** Wait the post-cancel block delay (network-dependent; ~50 blocks indicative on
  Base ≈ a couple of minutes), then **Withdraw** the ~43.98 LINK to a wallet you control.
- **[CLAUDE]** Verify on-chain that the upkeep is cancelled and Keeper3's `s_forwarder` points
  at the new receiver; update CLAUDE.md.

**Do NOT do Priority 3 until Priority 2's new automation has completed a real settle+start.**
Cancelling the old upkeep before CRE is proven would leave settlement with only the manual
fallback.
