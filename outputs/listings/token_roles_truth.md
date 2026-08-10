# TTS token — role truth, second pass

**Contract:** `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` (Base, chainId 8453)
**Source:** Sourcify `full_match`, `contracts/TTS.sol`, 118 lines, OZ upgradeable v4.9.3
**Verified:** 2026-08-10, second pass. Every line ref below was read from the verified
source; every role value below is a live `hasRole` read, not an inference.

Supersedes the role table in `token_capability_audit.md`. Findings there are confirmed;
this pass closes the evidence gap that document flagged, and answers the grant question.

---

## 1. The three capabilities, and exactly what gates each

| Capability | Line | Gate | Reality |
|---|---|---|---|
| `mint(address,uint256)` | 89 | `onlyRole(MINTER_ROLE)` | Unbounded. No cap, no max-supply check. |
| `pause()` / `unpause()` | 115 / 116 | `onlyRole(PAUSER_ROLE)` | Halts **all** transfers via `ERC20PausableUpgradeable`. |
| blacklist gate | 61–62 | **no gate — no setter exists** | `require(!blacklisted[from/to])` on the transfer path. |

Supporting refs:

```solidity
 17:  bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");
 18:  bytes32 public constant MINTER_ROLE   = keccak256("MINTER_ROLE");
 19:  bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
 25:  mapping(address => bool) public blacklisted;
 61:      require(!blacklisted[from], "blacklisted sender");
 62:      require(!blacklisted[to],   "blacklisted receiver");
 89:  function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
 99:  function setTaxExempt(address account, bool exempt) external onlyRole(DEFAULT_ADMIN_ROLE) {
108:  function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
115:  function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
116:  function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
117:  function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}
```

### Blacklist — is there a setter anywhere?

**No. It is a dead gate.** I read all 118 lines of `TTS.sol`. `blacklisted` is written
**nowhere** — not in `initialize` (33–50), not in any external function, and there is no
`_setBlacklist`-style internal helper. The only occurrences are the declaration (25) and
the two `require`s (61–62). Confirmed live: `blacklisted(0xb1e991bf…)` → `false`.

Because the contract cannot be upgraded (§4), **no setter can ever be added.** The mapping
is permanently all-`false`. A bytecode scanner still sees a blacklist check on the transfer
path — which is almost certainly what tripped Blockaid — but no address can ever be flagged.

That is the honest framing: *"there is a blacklist check with no way to write to it, on a
contract that cannot be upgraded to add one."* Not *"there is no blacklist."*

---

## 2. Current role holders — live `hasRole` reads

| Address | Label | DEFAULT_ADMIN | PAUSER | MINTER | UPGRADER |
|---|---|---|---|---|---|
| `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86` | **Gnosis Safe 2/2** | **YES** | no | no | **YES** |
| `0xb1e991bf617459b58964eef7756b350e675c53b5` | Bank / deployer | no | no | no | no |
| `0x7a9ff2f584248744cBbA32c737D660ED6f077fCB` | Marketing | no | no | no | no |
| `0xC3A3858A3777E4C9B542e60298c3161086c5Faae` | Treasury | no | no | no | no |
| `0xe5c3b6480164c20253c21928c699ab7fdb8a60e5` | Founder / Jim | no | no | no | no |
| `0x95607DcF6c815e6A7cb79eb6199174DFADC78758` | Dr. Mike | no | no | no | no |
| `0xe43105c9abeff42bdb79e1dca275803bbcdf8cc1` | Dr. Mike personal | no | no | no | no |
| `0xc17c1b5f653d66dc3324a0dc09d5500500f24ade` | Ecosystem / Chantea | no | no | no | no |
| `0xb1c9868d4bfb10d2d7e51cd625889f2b9e1d4887` | Team / Son | no | no | no | no |
| `0x783B8cd80B586B723188C93EF94EE1BEedE617B4` | V3d voting | no | no | no | no |
| `0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d` | Staking proxy | no | no | no | no |
| `0xa4fbf397485763e39102dcfaefcbf9794df55875` | Staking timelock | no | no | no | no |
| `0x0000…0000` | zero address | no | no | no | no |

**Nobody holds PAUSER. Nobody holds MINTER.** Only the 2-of-2 Safe holds anything.

Corroborating state: `paused() = false` · `totalSupply() = 69,000,000,000e18` exactly
(no mint has ever occurred beyond `initialize`) · `TAX_RATE_BPS() = 100` ·
`treasury() = 0xC3A3858A…c5Faae`.

### Role history (event scan, `RoleGranted` / `RoleRevoked`)

| Block | Event | Role | Account |
|---|---|---|---|
| 43889985 | GRANT | DEFAULT_ADMIN, PAUSER, MINTER, UPGRADER | Bank (deployer, via `initialize` lines 40–43) |
| 44625437 | REVOKE | MINTER | Bank |
| 44917220 | GRANT | DEFAULT_ADMIN | Safe |
| 44917240 | GRANT | PAUSER | Safe |
| 44917259 | GRANT | UPGRADER | Safe |
| 44917367 | REVOKE | DEFAULT_ADMIN | Bank |
| 47391416 | REVOKE | PAUSER, UPGRADER | Bank (by Safe) |

Note the Safe was granted PAUSER at 44917240 and **no longer holds it** — so it was
renounced or revoked later, in one of the unscanned ranges below.

> ### ⚠️ Completeness caveat — state this to Blockaid, do not paper over it
> The scan covered **475 of 596** 10,000-block chunks between deploy (43851235) and head
> (49806595). 121 chunks failed on public-RPC rate limits. Alchemy's free tier caps
> `eth_getLogs` at a **10-block** range, so it cannot do this scan at all.
>
> The contract does **not** inherit `AccessControlEnumerable` — `getRoleMemberCount()`
> reverts — so holders **cannot be enumerated on-chain**. The `hasRole` table above is
> definitive for every listed address, but proving *no unknown address* holds MINTER or
> PAUSER requires a complete event history.
>
> **To close this:** a BaseScan API key (free tier does full-range `getLogs`), or the
> browser check — BaseScan → token → Contract → Events → filter `RoleGranted` /
> `RoleRevoked`. Ten minutes. Do it before the Blockaid reply quotes "nobody holds MINTER."

---

## 3. Can DEFAULT_ADMIN grant MINTER / PAUSER? — **Yes. At will.**

Live `getRoleAdmin()` reads:

| Role | Its admin role |
|---|---|
| DEFAULT_ADMIN_ROLE | `0x00…00` (itself) |
| PAUSER_ROLE | `0x00…00` (DEFAULT_ADMIN_ROLE) |
| MINTER_ROLE | `0x00…00` (DEFAULT_ADMIN_ROLE) |
| UPGRADER_ROLE | `0x00…00` (DEFAULT_ADMIN_ROLE) |

`TTS.sol` never calls `_setRoleAdmin`, so all four keep OZ's default: **DEFAULT_ADMIN_ROLE
administers everything.** The Safe can call `grantRole(MINTER_ROLE, anyone)` in a single
2-of-2 transaction and mint unlimited supply in the next block.

**This is the single most important fact in this document.** "Nobody holds MINTER" is true
today and reversible in one transaction. Any public claim must say so, or it is misleading
in exactly the way Blockaid is accusing us of.

---

## 4. What is genuinely immutable

| Property | Why it cannot change |
|---|---|
| 1% transfer tax | `TAX_RATE_BPS` is `constant` (line 22) — compiled into bytecode, no setter exists. |
| Total supply ceiling *given no MINTER* | `INITIAL_SUPPLY` constant (21); supply only moves via `mint` (89) or `burn` (94). |
| Not upgradeable | Not behind a proxy: EIP-1967 slot empty, `upgradeTo` reverts `"Function must be called through delegatecall"`. **UPGRADER_ROLE is inert.** |
| Blacklist unwritable | No setter, and no upgrade path to add one. |
| LP locked | Uniswap V2 pool `0x77Fe1883…` locked to 2027-05-05 (off-contract). |

---

## 5. Renounce options — what is POSSIBLE and what each FORECLOSES

Mechanics: `renounceRole(role, account)` requires `account == msg.sender`, so the Safe can
drop its own roles. `revokeRole` requires the caller to hold the role's admin. **Once
DEFAULT_ADMIN has zero holders, no role can ever be granted or revoked again — the role
table freezes permanently.**

### Option A — Safe renounces UPGRADER_ROLE
- **Forecloses:** nothing. Upgrades are already impossible (§4); the role is inert.
- **Gains:** removes an "upgrader exists" indicator from every scanner.
- **Cost:** zero. **Do this regardless of what you decide on B and C.**

### Option B — Safe renounces DEFAULT_ADMIN_ROLE (the real decision)
- **Gains, and they are large:** MINTER and PAUSER are held by nobody *and can never be
  granted to anybody again*. Mint becomes permanently impossible; supply is fixed at 69B
  forever. Pause becomes permanently impossible; the freeze capability dies. Combined with
  §4, essentially every Blockaid indicator becomes provably dead rather than merely unused.
- **Forecloses, permanently:**
  1. **`setTaxExempt()` (line 99) — forever.** The 10 currently-exempt addresses stay
     exempt; nothing else can ever be added. **Every future contract pays 1% on every
     transfer, permanently.** You have shipped V3b → V3c → V3d; a V3e prize pool would be
     taxed on every payout and burn, and could not be fixed. Same for a staking V2, a new
     LP pair, a partner/club payout contract, or a bridge.
  2. **`setTreasury()` (line 108) — forever.** The 1% tax stream is locked to
     `0xC3A3858A…c5Faae` for the life of the token. If that key is ever lost or
     compromised, the tax flows there permanently with no recovery.
- **Currently exempt (locked in if you renounce):** Safe, Bank, Treasury, Founder,
  Ecosystem, Team/Son, Marketing, V3d voting, Staking proxy, Uniswap V2 pool.
  **Not exempt:** Trophy NFT `0x02DDd0e6…`, Dr. Mike personal `0xe43105c9…`.

### Option C — renounce MINTER / PAUSER
- **Not available.** Nobody holds them. There is nothing to renounce. The only way to make
  them permanently unreachable is Option B.

### Option D — middle path: exempt-then-renounce
Deploy the contracts you know you still need (staking V2, any V3e, Trophy NFT if it should
be exempt), `setTaxExempt` each one, **then** execute A + B. Converts B's foreclosure from
"every future contract" into "only contracts we haven't imagined yet."

### Option E — middle path: move DEFAULT_ADMIN to the existing 2-day timelock
Grant DEFAULT_ADMIN to `0xa4fbf397…` and have the Safe renounce. Keeps `setTaxExempt`
available behind a 2-day public delay; a surprise mint becomes visible 2 days ahead. Weaker
than B for trust, but forecloses nothing.

**Recommendation: A now, unconditionally. Then D — exempt your remaining contracts, then B.**
B is what actually answers Blockaid; D is what stops it costing you a redeploy you can't fix.
Decide the Trophy NFT exemption before B: after B it is taxed forever.

**No transaction has been executed. This document is reads only.**
