# TTS token — privileged capability audit

**Contract:** `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` (Base, chainId 8453)
**Source:** Sourcify `exact_match`, `contracts/TTS.sol:TTS`, solc `0.8.27+commit.40a35a09`
**Audited:** 2026-08-10, from the verified source + live on-chain reads.
**Line references** are to `contracts/TTS.sol` as verified on-chain.

> ## ⛔ HONESTY GATE: TRIGGERED — DO NOT REPLY TO BLOCKAID YET
>
> Capabilities matching Blockaid's indicators **do exist in the deployed contract**. Two of
> their four claims are TRUE as written. A third is TRUE in code but currently unreachable.
>
> Worse for a reply: **our own SolidProof audit corroborates them.** Its published summary
> states *"Token transfer can be locked — Owner can lock user funds with owner functions"*
> and *"Ownership is not renounced."* Sending that audit as a rebuttal hands Blockaid
> supporting evidence, signed by our own auditor.
>
> No reply has been drafted. Fix or renounce first — see **What to do** at the bottom.

---

## 1. Every privileged / role-gated function

| Line | Function | Gate | What it can actually do |
|---|---|---|---|
| 89 | `mint(address,uint256)` | `MINTER_ROLE` | **Mints unlimited new supply.** No cap, no max-supply check. |
| 99 | `setTaxExempt(address,bool)` | `DEFAULT_ADMIN_ROLE` | Toggles an address's exemption from the 1% tax. Cannot block transfers, cannot move or seize anyone's funds. |
| 108 | `setTreasury(address)` | `DEFAULT_ADMIN_ROLE` | **Redirects where the 1% tax is sent**, to any address. Also flips exemption off the old treasury and on for the new one. |
| 115 | `pause()` | `PAUSER_ROLE` | **Halts ALL transfers** contract-wide (via `ERC20PausableUpgradeable`). |
| 116 | `unpause()` | `PAUSER_ROLE` | Resumes transfers. |
| 117 | `_authorizeUpgrade(address)` | `UPGRADER_ROLE` | Gates UUPS upgrades — **inert, see §2(iv)**. |
| 94 | `burn(uint256)` | none (public) | Caller burns only their own balance. Not privileged. |

Non-function capability worth naming explicitly:

| Line | Mechanism | Status |
|---|---|---|
| 25 | `mapping(address => bool) public blacklisted` | Declared **and enforced** (lines 61–62) — but **no setter exists anywhere in the contract**, so no address can ever be set to `true` in this implementation. |

---

## 2. Blockaid's claims, answered

### (i) Can ANY role pause / freeze / blacklist / limit trading?

**TRUE — pause exists and is real.**

```solidity
115:  function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
```
`TTS` inherits `ERC20PausableUpgradeable` (line 13). While paused, `_beforeTokenTransfer`
reverts, so **every transfer stops** — a complete trading freeze. This is exactly the
capability Blockaid describes and we cannot say otherwise.

**Blacklist — TRUE in code, currently unreachable.**
```solidity
25:  mapping(address => bool) public blacklisted;
61:      require(!blacklisted[from], "blacklisted sender");
62:      require(!blacklisted[to],   "blacklisted receiver");
```
The enforcement is live on the transfer path. There is **no function that writes to
`blacklisted`**, so today no address can be flagged. A static analyser reading the
bytecode will still see a blacklist gate on transfers, which is very likely what tripped
this indicator. "There's a blacklist check but no setter" is a defensible answer — it is
not the same as "there is no blacklist."

**Mint — TRUE, and our public claims are wrong.**
`mint()` (line 89) exists and is unbounded. `CLAUDE.md` states *"Total supply 69B TTS,
fixed, no mint function"* and the SolidProof summary says *"Contract owner cannot mint."*
**Both are false as written.** What is true is that no *known* wallet currently holds
`MINTER_ROLE` (see §3).

**Live mitigation:** `paused()` = `false`; no known wallet holds `PAUSER_ROLE` or
`MINTER_ROLE`.

### (ii) `owner()` vs AccessControl — is Ownable renounced while roles live?

**FALSE as stated — there is no Ownable at all.**
The contract inherits `AccessControlUpgradeable` (line 14) only. There is **no `Ownable`,
no `owner()`, no `renounceOwnership()`** — confirmed on-chain: calling `owner()` reverts
(no such function). So there is no "renounced owner concealing live roles," because there
was never an owner to renounce.

**But the substance of their concern is TRUE:** privileged roles exist and are held. The
honest framing is "we use role-based access control, here is exactly who holds what,"
not "ownership is renounced."

### (iii) Transfer hooks / backdoor-shaped mechanisms; what `setTaxExempt` can do; is the 1% tax immutable?

**A transfer hook exists** — `_beforeTokenTransfer` (lines 52–67). It enforces pause,
blacklist, and computes tax.

**The 1% rate is genuinely immutable.**
```solidity
22:  uint256 public constant TAX_RATE_BPS = 100;   // 1%
```
`constant` — compiled into bytecode, **no setter anywhere**. It cannot be raised, by anyone,
ever, without replacing the contract (which cannot be done — §2(iv)). Confirmed on-chain:
`TAX_RATE_BPS()` returns `100`.

> Note: the SolidProof summary claims *"Contract owner can set fees above 25%."* That is
> **false for this contract** — there is no fee setter. Their summary is wrong in both
> directions, which is why it cannot be used as evidence for anything.

**`setTaxExempt` can:** toggle whether an address pays the 1% on transfer.
**`setTaxExempt` cannot:** block a transfer, freeze an address, move funds, mint, or change
the rate. Its worst-case abuse is making a favoured address' transfers 1% cheaper.

**`setTreasury` (line 108) is the more meaningful admin power** — it redirects the tax
stream to any address. It cannot touch anyone's existing balance.

**One genuine code defect (not a security hole, but it should be reported honestly):**
line 66 calls `super._beforeTokenTransfer(from, treasury, tax)` — that invokes a *hook*, it
does not move tokens. The actual tax transfer happens in the `transfer`/`transferFrom`
overrides (lines 69–87). So line 66 is dead code that double-invokes the pausable check.
Harmless, but a reviewer will notice it and it makes the tax logic look confused.

### (iv) Is the token upgradeable / behind a proxy?

**FALSE in practice — the token is NOT behind a proxy and CANNOT be upgraded.**

The contract inherits `UUPSUpgradeable` (line 15) with `_authorizeUpgrade` gated by
`UPGRADER_ROLE` (line 117), so *source-wise* it looks upgradeable. On-chain it is not:

| Check | Result | Meaning |
|---|---|---|
| EIP-1967 impl slot on `0x5570eA97…` | `0x00…00` (empty) | No implementation pointer — nothing delegatecalls here |
| `upgradeTo(...)` simulated from an UPGRADER holder | reverts `"Function must be called through delegatecall"` | OZ's `onlyProxy` guard — **upgrades are impossible** |
| `proxiableUUID()` | returns the 1967 slot hash | Succeeds only when *not* delegated — confirms this is the logic contract, called directly |

`0x5570eA97…` is a UUPS-capable implementation **deployed directly and used directly**.
Balances and state live in it. The `UPGRADER_ROLE` held by the Safe is therefore inert.

> This also means **`CLAUDE.md` is wrong** where it calls the token a "UUPS proxy" with
> "v2 impl `0xb995b63c` (M-1 fix)". That upgrade sits **unexecuted** in the Safe queue at
> nonce 1 and, because the token is not behind a proxy, it could never have applied. Any
> fix believed to be live via that upgrade is **not live**.

---

## 3. Role holders — live on-chain reads

`AccessControlUpgradeable` is not enumerable, so these are direct `hasRole` reads:

| Address | Label | DEFAULT_ADMIN | PAUSER | MINTER | UPGRADER |
|---|---|---|---|---|---|
| `0xeFb59d88…E6fB86` | Gnosis Safe 2-of-2 | **true** | false | false | **true** |
| `0xb1e991bf…5c53b5` | Bank / deployer | false | false | false | false |
| `0x7a9ff2f5…077fCB` | Marketing | false | false | false | false |
| `0xC3A3858A…c5Faae` | Treasury | false | false | false | false |
| `0xe5c3b648…8a60e5` | Founder | false | false | false | false |
| `0x95607DcF…C78758` | Dr. Mike | false | false | false | false |
| `0x783b8cd8…e617b4` | V3d voting | false | false | false | false |

**Good news, and better than our own docs claim:** the Bank hot wallet holds **no roles at
all** — `CLAUDE.md`'s "UPGRADER = Safe *and Bank*; PAUSER = Bank" is stale. Only the 2-of-2
Safe holds anything, and its `UPGRADER_ROLE` is inert.

**⚠️ Evidence gap, stated plainly:** free-tier RPC caps `eth_getLogs` at 10k blocks, and a
scan of 400 blocks from the deploy block (`43851235`) returned no role events, so I could
**not** reconstruct the full `RoleGranted`/`RoleRevoked` history. The table above proves no
*known project wallet* holds PAUSER/MINTER — it does **not** prove that no unknown third
address does. **Before replying to Blockaid, confirm on BaseScan** → token address →
Contract → Events → filter `RoleGranted` / `RoleRevoked` and read the full list. That is a
free browser check and it closes the last hole in the argument.

---

## 4. The SolidProof audit — scope, and why we cannot cite it

**Where the report lives:** https://app.solidproof.io/projects/temptation-token —
this is the only public artifact. **No downloadable PDF is linked on the page**, and I
found no PDF anywhere in this repo. If a full PDF exists, it is not currently obtainable
from the public portal.

**Does it cover THIS deployed token? No — it covers no address at all.** The page's own
metadata reads:

> **Contract address N/A · Network N/A · License N/A · Compiler N/A · Type N/A**
> Onboard date 2026/05/04 · Revision date 2026/05/04

An audit with no contract address, no network and no compiler **cannot be cited as covering
`0x5570eA97…`**. There is nothing tying it to the deployed bytecode.

**And its findings contradict the deployed contract in both directions:**

| SolidProof says | Deployed reality |
|---|---|
| "Contract owner cannot mint" | ❌ `mint()` exists, line 89, unbounded |
| "Contract owner cannot blacklist addresses" | ❌ blacklist enforced, lines 61–62 (no setter, but the gate is there) |
| "Contract owner can set fees above 25%" | ❌ `TAX_RATE_BPS` is `constant` 100 — no setter exists |
| "Token cannot be burned" | ❌ `burn()` exists, line 94 |
| **"Token transfer can be locked — Owner can lock user funds"** | ✅ **correct — and this is Blockaid's point** |
| **"Ownership is not renounced — the owner retains significant control"** | ✅ **correct in substance** |
| "Contract is not upgradeable" | ✅ correct in effect (not behind a proxy) |

Four of seven statements are wrong about the deployed contract, and the two that are right
are the two that **support Blockaid's case**. Attaching this to an appeal would actively
damage us.

---

## 5. What to do before replying

Ordered by how much each one strengthens the reply.

1. **Decide the PAUSER question.** If nobody needs it, have the Safe confirm no address
   holds `PAUSER_ROLE` and say so with the on-chain proof. A pause capability that is
   *provably held by nobody* is a genuinely strong answer. Right now we believe that but
   cannot prove it — close the event-log gap first (§3).
2. **Same for `MINTER_ROLE`.** Then correct `CLAUDE.md` and every public page that says
   "no mint function" — the function exists; the honest claim is "no one holds the role."
3. **Correct the audit page and CLAUDE.md** on the proxy claim. The token is not a proxy
   and the queued `upgradeTo` at Safe nonce 1 never executed and never could.
4. **Do not cite the SolidProof audit.** Either commission a re-audit pinned to
   `0x5570eA97…` with the address, network and compiler recorded, or omit it. If Blockaid
   asked for "an audit," sending one scoped to `N/A` invites exactly the scrutiny we don't
   want.
5. **Then** draft the reply — leading with what is verifiably true: 1% tax is a hardcoded
   `constant` and cannot be raised by anyone; the contract cannot be upgraded (with the
   revert as proof); admin is a 2-of-2 multisig; the Bank hot wallet holds no roles; and
   the pause/mint capabilities exist but are held by no one, with event-log proof.
