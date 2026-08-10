# Blockaid correction — DRAFT, NOT SENT

**Status:** draft only. Do not send until (a) the renounce decision is made and the
bracketed slot below is filled with what was actually executed, and (b) the event-log gap
in `token_roles_truth.md` §2 is closed on BaseScan.

**Ref:** Blockaid case #1263614 · to `service@blockaid.io` (confirm the address on the
original thread before sending)

---

**Subject: Correction to our prior submission — TTS `0x5570eA97…` (case #1263614)

Hello,

We are writing to correct our own earlier message, not to appeal yours.

We re-audited the deployed contract against its verified source. Our prior submission
overstated the token's immutability. Specifically, we described the token as having no
mint, no pause and no blacklist. That was wrong, and we would rather tell you that
ourselves than have you find it.

**What actually exists in `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`**
(Base 8453; source verified on Sourcify, `contracts/TTS.sol`, 118 lines, OZ upgradeable
v4.9.3; line numbers are that file):

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
   are telling you why it can never fire, not disputing that you see it.

2. **The contract is not upgradeable in practice**, so a setter cannot be added later. It
   is a UUPS-capable implementation deployed and used *directly*, not behind a proxy: the
   EIP-1967 implementation slot on the address is empty, and `upgradeTo` reverts
   `"Function must be called through delegatecall"` (OpenZeppelin's `onlyProxy` guard).
   `UPGRADER_ROLE` is therefore inert.

3. **Current role holders**, by live `hasRole` reads:

   - `DEFAULT_ADMIN_ROLE` — `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86`, a 2-of-2 Gnosis
     Safe, only
   - `UPGRADER_ROLE` — the same Safe (inert, per above)
   - `PAUSER_ROLE` — **no holder**
   - `MINTER_ROLE` — **no holder**
   - The deployer / hot wallet `0xb1e991bf…` holds **no roles**; its DEFAULT_ADMIN, PAUSER,
     MINTER and UPGRADER were all revoked (blocks 44625437, 44917367, 47391416).

   We want to be exact about what that does and does not mean: **all four roles are
   administered by `DEFAULT_ADMIN_ROLE`**, so the Safe can grant `MINTER_ROLE` or
   `PAUSER_ROLE` to any address in a single transaction. "No one holds it" is a statement
   about today, not a guarantee. We are not going to present it as one.

**What is genuinely immutable**

- The 1% transfer tax: `TAX_RATE_BPS` is a `constant` (line 22). There is no setter. It
  cannot be raised by anyone, ever.
- Total supply is 69,000,000,000 TTS and no `mint` has ever been called beyond
  `initialize` — `totalSupply()` matches `INITIAL_SUPPLY` exactly.
- The contract cannot be upgraded (point 2).
- Uniswap V2 liquidity is locked until 2027-05-05.

**What we have renounced or locked**

> ⛔ **SLOT PENDING JIM'S DECISION — do not send with this placeholder in place.**
> Fill with what was actually executed on-chain, with transaction hashes. Options and
> their trade-offs are in `token_roles_truth.md` §5. If nothing has been executed yet,
> either delay this message until it has, or state plainly that the decision is pending
> and give a date — do not imply action that has not happened.

**Audit status**

We are not citing our existing SolidProof listing. It records no contract address, network
or compiler, so it cannot be shown to cover this deployment, and several of its findings do
not match the deployed bytecode in either direction. We would rather say that than send you
an artifact that does not survive checking. We are arranging a re-audit pinned to this
address and will send it when it exists.

We are also correcting our own public pages — the audit page, the protect page, our support
chatbot and our marketing copy — to describe the role-gated reality above rather than the
"no mint / no pause / no blacklist" claim we published. That work is in progress.

If you would like the full role map with block numbers, or a walkthrough of any read above,
we will send it in whatever form is easiest to verify.

Thanks for the scrutiny — it caught something our own documentation had wrong.

Jim Goetz
Blockchain Entertainment LLC

---

## Pre-send checklist

- [ ] Renounce decision made; bracketed slot replaced with executed tx hashes
- [ ] Event-log gap closed on BaseScan (`token_roles_truth.md` §2) — confirms no unknown
      MINTER/PAUSER holder before we claim "no holder"
- [ ] Public pages actually corrected (item 3) — this letter says "in progress"; do not
      send if nothing has moved
- [ ] Recipient address confirmed against the original thread
- [ ] Do **not** attach the SolidProof report
