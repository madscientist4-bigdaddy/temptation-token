# Blockaid correction — FINAL, SEND-READY

**Status:** send-ready as of 2026-08-11. The renounce slot that previously blocked this
message is resolved: the decision is **DEFER** (per `outputs/hub_run_2026-08-11.md` §2),
and the letter now states that plainly rather than implying action that has not happened.

**Ref:** Blockaid case #1263614 · to `service@blockaid.io` (confirm the address on the
original thread before sending)

**Verified on-chain 2026-08-11** — 52/52 `hasRole` probes succeeded, no swallowed errors:

| Read | Result |
|---|---|
| `DEFAULT_ADMIN_ROLE` | Safe `0xeFb59d88…` only |
| `UPGRADER_ROLE` | Safe only |
| `PAUSER_ROLE` | held by none of 13 probed project addresses |
| `MINTER_ROLE` | held by none of 13 probed project addresses |
| Bank `0xb1e991bf…` | holds **no** role (all four negative) |
| `paused()` | `false` |
| `totalSupply()` | 69,000,000,000 TTS |
| Staking `0x7848cceE…` | `DEFAULT_ADMIN` → Safe · `UPGRADER` → Timelock `0xa4fbf397…` |

---

## Email body — copy from here

**Subject:** `Correction to our prior submission — TTS 0x5570eA97… (case #1263614)`

Hello,

We are writing to correct our own earlier message, not to appeal yours.

We re-audited the deployed contract against its verified source. Our prior submission
overstated the token's immutability: we described it as having no mint, no pause and no
blacklist. That was wrong, and we would rather tell you that ourselves than have you find
it.

**What actually exists in `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`**
(Base 8453; source verified on Sourcify, `contracts/TTS.sol`, 118 lines, OpenZeppelin
upgradeable v4.9.3; line numbers refer to that file):

| Line | Capability | Gate |
|---|---|---|
| 89 | `mint(address,uint256)` — unbounded, no cap | `MINTER_ROLE` |
| 115 / 116 | `pause()` / `unpause()` — halts all transfers | `PAUSER_ROLE` |
| 61–62 | `require(!blacklisted[from])` / `[to]` on the transfer path | — |
| 25 | `mapping(address => bool) public blacklisted` | — |
| 99 | `setTaxExempt(address,bool)` | `DEFAULT_ADMIN_ROLE` |
| 108 | `setTreasury(address)` | `DEFAULT_ADMIN_ROLE` |
| 117 | `_authorizeUpgrade(address)` | `UPGRADER_ROLE` |

So your mint, pause and blacklist indicators are all reading something real. Three
clarifications, each independently checkable:

1. **The blacklist has no setter.** `blacklisted` is written nowhere in the contract —
   declaration at line 25, two reads at 61–62, and nothing else in 118 lines. No address
   can be flagged. We understand a bytecode scanner sees the gate on the transfer path; we
   are explaining why it can never fire, not disputing that you see it.

2. **The contract is not upgradeable in practice**, so a setter cannot be added later. It
   is a UUPS-capable implementation deployed and used *directly*, not behind a proxy: the
   EIP-1967 implementation slot on the address is empty, and `upgradeTo` reverts
   `"Function must be called through delegatecall"` (OpenZeppelin's `onlyProxy` guard).
   `UPGRADER_ROLE` is therefore inert on this address.

3. **Current role holders**, by live `hasRole` reads on 2026-08-11:

   - `DEFAULT_ADMIN_ROLE` — `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86`, a 2-of-2 Gnosis
     Safe, and nothing else.
   - `UPGRADER_ROLE` — the same Safe (inert, per point 2).
   - `PAUSER_ROLE` — **no holder.**
   - `MINTER_ROLE` — **no holder.**
   - The original deployer / operator hot wallet `0xb1e991bf617459b58964eef7756b350e675c53b5`
     holds **none of the four**. Its `DEFAULT_ADMIN`, `PAUSER`, `MINTER` and `UPGRADER`
     were each revoked on-chain (blocks 44625437, 44917367, 47391416). No single hot key
     retains privileged control of this token.

   Two things we want to be precise about, because precision is the point of this letter:

   - **How "no holder" is evidenced.** This contract is `AccessControl`, not
     `AccessControlEnumerable`, so it exposes no on-chain member count to read. Our claim
     rests on `hasRole` returning false for `MINTER_ROLE` and `PAUSER_ROLE` across every
     address associated with this project — deployer, Safe, treasury, marketing, charity,
     team, ecosystem, the voting contract, the staking timelock and the zero address. If
     you would rather verify it independently of our address list, the complete grant
     history is auditable from the Safe's transaction record, since `DEFAULT_ADMIN` is the
     only account that can grant either role and the Safe has been the sole admin since
     the revocations above.
   - **"No holder" is a statement about today, not a guarantee.** All four roles are
     administered by `DEFAULT_ADMIN_ROLE`, so the Safe can grant `MINTER_ROLE` or
     `PAUSER_ROLE` to any address in a single transaction. We are not going to present a
     revocable fact as a permanent one — that is precisely the overstatement this letter
     exists to walk back.

**What is genuinely immutable**

- The 1% transfer tax: `TAX_RATE_BPS` is a `constant` (line 22). There is no setter. It
  cannot be raised by anyone, ever.
- Total supply is 69,000,000,000 TTS. `mint` has never been called beyond `initialize` —
  `totalSupply()` matches `INITIAL_SUPPLY` exactly, which we re-read today.
- The contract on this address cannot be upgraded (point 2).
- Uniswap V2 liquidity is locked until 2027-05-05.

**On renouncing — our decision, stated rather than implied**

We considered renouncing `MINTER_ROLE` and `PAUSER_ROLE` before writing to you, because it
would let us make a stronger claim in this message. We decided against doing it now, and
we would rather explain why than send you a gesture.

Renouncing a role that already has zero members changes nothing an auditor can rely on:
`DEFAULT_ADMIN` can re-grant it the next block. The only renounce that would make "cannot
mint, cannot pause" *permanent* is renouncing `DEFAULT_ADMIN_ROLE` itself — and that would
also permanently disable `setTaxExempt`, which this project needs every time it deploys a
new protocol contract (our staking contract required it in August). Doing that before the
contract set is final would impose the 1% transfer tax on every internal protocol transfer
forever.

So our plan is: **freeze the contract set first, then renounce `DEFAULT_ADMIN_ROLE` and
`UPGRADER_ROLE` together in a single Safe batch.** That is the point at which the
immutability claim becomes true and permanent, and we will write to you with the
transaction hashes when it is executed. Until then the honest line — the one now on our
public pages — is: *mint and pause exist in the code; no address currently holds either
role; the Safe could re-grant them.*

**Audit status**

We are not citing our existing SolidProof listing in support of this deployment. It
records no contract address, network or compiler, so it cannot be shown to cover this
bytecode, and several of its findings do not match the deployed contract in either
direction. We would rather say that than send you an artifact that does not survive
checking. We have asked SolidProof to re-pin their report to this exact address and
compiler; separately, we are commissioning an independent audit scoped to the deployed
address, and we will send it when it exists rather than describing it in advance.

We are also correcting our own public pages — the audit page, the protect page, our
support chatbot and our marketing copy — to describe the role-gated reality above rather
than the "no mint / no pause / no blacklist" claim we previously published.

If you would like the full role map with block numbers, or a walkthrough of any read
above, we will send it in whatever form is easiest for you to verify.

Thanks for the scrutiny — it caught something our own documentation had wrong.

Jim Goetz
Blockchain Entertainment LLC
jgoetz@functionised.com

## Copy to here

---

## Pre-send checklist

- [x] Renounce decision made — **DEFER**, and the letter now says so explicitly with the
      trigger condition (contract-set freeze) and the planned batch. No placeholder, no
      implied action.
- [x] Role state re-verified on-chain 2026-08-11 (52/52 probes, no swallowed errors).
- [ ] **Event-log gap still open.** We could not machine-scan the full `RoleGranted` /
      `RoleRevoked` history from the token's deploy block (43851235) to head: the project's
      Alchemy key is on the free tier, which caps `eth_getLogs` at a 10-block range, and
      the public Base RPC rate-limits across a 6M-block scan. The letter therefore does
      **not** claim an exhaustive log audit — it states the probe method and points Blockaid
      at the Safe's transaction history instead. If you want the exhaustive scan before
      sending, it needs one paid RPC month (~$50) or a BaseScan Pro API key.
- [ ] Public pages actually corrected — the letter says this work is "in progress" rather
      than done. Confirm that is still accurate on the day you send.
- [ ] Recipient address confirmed against the original thread.
- [ ] Do **not** attach the SolidProof report.
