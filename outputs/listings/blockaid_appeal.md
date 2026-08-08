# Blockaid re-appeal — ticket #1263614

**Send to:** the existing thread on ticket **#1263614** (reply to it — do not open a new
ticket, it resets your queue position). If you no longer have the thread, use
**https://report.blockaid.io** and reference the ticket number in the first line.

**Subject:** `Re: #1263614 — Temptation Token (TTS, Base 0x5570eA97…) — new evidence, request re-review`

---

## Email body — copy from here

Hello Blockaid team,

I'm following up on ticket **#1263614** regarding **Temptation Token ($TTS)**, contract
`0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` on Base (chain 8453), which is currently
flagged in your detection feed.

Since the original submission the project has moved from pre-launch to a live product with
a verifiable on-chain history. I'd like to request a re-review against the following new
evidence.

**1. The product is live and its payouts are verifiable on-chain.**
The weekly contest has settled real rounds. Each settlement pays four recipients in a
single transaction, in exactly the split published on our site (35% winning entrant / 35%
top voter / 10% charity / 20% operator):

- `0x12010ff383e78f3775613a591e88a7c0d44f314c171c476599cf0926cb16d8d0` (2026-08-03) —
  1.75 / 1.75 / 0.50 / 1.00 TTS on a 5.00 TTS pool
- `0xbc5791cb405f532a055456297c3856d4f7494e8ac824b103e37e1053a1319ad8` (2026-08-02) —
  3.50 / 3.50 / 1.00 / 2.00 TTS on a 10.00 TTS pool

Amounts are small because the game is new; the point is that the distribution is
deterministic, matches the documentation exactly, and is reproducible from the contract
source. The winner is selected by **Chainlink VRF**, so the operator cannot choose it.

**2. An independent audit is published, with a permanent public URL.**
- Audit page: **https://temptationtoken.io/audit**
- Auditor's own portal (Solidproof): **https://app.solidproof.io/projects/temptation-token**

All critical and high findings are resolved. The one accepted finding (AF-001,
reentrancy-eth reported by Slither in `vote()`) is documented publicly with its rationale:
$TTS is a standard ERC-20 with no transfer hooks and the token address is immutable in the
voting contract, so the pattern is not exploitable.

**3. Privileged control is behind a multisig and a timelock — no single hot key.**
- `DEFAULT_ADMIN` on the token and on the staking contract is a **2-of-2 Gnosis Safe**
  (`0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86`).
- Contract upgrades additionally route through a **TimelockController with a 2-day delay**
  (`0xa4fbf397485763e39102dcfaefcbf9794df55875`), for which the Safe is the only proposer
  and executor.
- The operator wallet holds **no** upgrade rights. This was tightened on 2026-08-07: the
  operator's admin role was granted to the Safe and then renounced
  (`RoleGranted` block 49671451, `RoleRevoked` block 49671480).

**4. Token mechanics that are commonly mistaken for malicious patterns — stated plainly.**
I suspect these drove the original flag, so I want to address them head-on rather than
have them re-detected:

- **There is a 1% transfer tax.** It is hardcoded, permanent, and cannot be raised — there
  is no setter for the rate. A fixed allowlist of protocol contracts is tax-exempt so the
  game's own payouts aren't double-taxed. This is not a dynamic or ownable fee.
- **There is no mint function.** Supply is fixed at 69,000,000,000. `MINTER_ROLE` is held
  by nobody.
- **Tokens are burned to `0x…dEaD`** as core game logic — every vote on a losing entry is
  burned. This is intentional deflation, not a honeypot; burns are visible on-chain
  (currently ~1,520 TTS burned).
- **There is no blacklist, no pause on transfers, no max-transaction limit, and no
  ownership-gated ability to block selling.** Liquidity is locked until **2027-05-05**.

**5. Supporting pages.**
- Trust & security overview: https://temptationtoken.io/trust
- How we protect users (ID handling, retention): https://app.temptationtoken.io/protect.html
- Live app: https://app.temptationtoken.io
- Token on BaseScan (source verified):
  https://basescan.org/token/0x5570eA97d53A53170e973894A9Fa7feb5785d3b9

If any specific heuristic is still firing, I'd genuinely appreciate knowing which one — if
it's something we can fix in the product rather than argue about, we'd rather fix it.

Thank you for taking another look.

Jim Goetz
Blockchain Entertainment LLC
jgoetz@functionised.com

## Copy to here

---

## Your exact submission steps

1. Find the original **#1263614** thread in your email and **reply** to it. Replying keeps
   the ticket history; a fresh ticket loses it and typically restarts triage.
2. If the thread is gone: **https://report.blockaid.io** → "False positive / appeal" →
   put `Re: #1263614` as the first line of the description.
3. Paste the body above. Attach nothing — every claim is a link they can verify themselves,
   which is what reviewers prefer.
4. **Before sending**, click these three yourself and confirm they load:
   - https://temptationtoken.io/audit
   - https://app.solidproof.io/projects/temptation-token
   - https://basescan.org/tx/0x12010ff383e78f3775613a591e88a7c0d44f314c171c476599cf0926cb16d8d0
5. Expect **5–15 business days**. If nothing after 15, reply once in-thread with
   "following up" — do not open a parallel ticket.

## Honest note before you send

The 1% transfer tax is, on its own, a legitimate reason for a security vendor to flag a
token — plenty of scams use exactly that shape. Our argument is not "the tax is fine," it's
"the tax is fixed, unownable, and disclosed." That argument is much stronger now that
`DEFAULT_ADMIN` sits behind a 2-of-2 Safe and upgrades are timelocked, which is why this
appeal is worth making now rather than in June. But be prepared for them to keep a
lower-severity informational label on the tax itself — that outcome is normal and is not
the same as being flagged as malicious.
