# Staking mock stack — Base Sepolia (Gates C + D live-fire)

Deployed 2026-07-26 from throwaway deployer `0x767651E74c290122Dd8CC934e471fCE091BbC5c2`.
Chain **84532** (Base Sepolia). Explorer: https://sepolia.basescan.org

## Addresses
| Contract | Address |
|---|---|
| **TTSStaking (proxy)** | [`0x1ec9465651656eF1bFD60Dd2D1b220F24Df78743`](https://sepolia.basescan.org/address/0x1ec9465651656eF1bFD60Dd2D1b220F24Df78743) |
| TTSStaking (impl) | [`0xD818828b9B9D96B199f7EDCE46f4ea873BFeEBe2`](https://sepolia.basescan.org/address/0xD818828b9B9D96B199f7EDCE46f4ea873BFeEBe2) |
| MockTTS (1% tax + exemption) | [`0x20d110E78c86bfC8C8Ecea7bF16ce86FC033B782`](https://sepolia.basescan.org/address/0x20d110E78c86bfC8C8Ecea7bF16ce86FC033B782) |
| TimelockController (UPGRADER) | [`0x5a86c8a7B4f246639c15774E118F428e0f97AF85`](https://sepolia.basescan.org/address/0x5a86c8a7B4f246639c15774E118F428e0f97AF85) |
| StubVotingV3d (V3d read logic) | [`0x40BD8eB343E7663056E2963677CC387BFFB460d5`](https://sepolia.basescan.org/address/0x40BD8eB343E7663056E2963677CC387BFFB460d5) |

Reward pool funded: **10,000,000,000** mock TTS. Staking is tax-exempt on MockTTS.
UPGRADER_ROLE = the TimelockController (never an EOA), mirroring the mainnet role model.

## E2E results (Gates C + D closed on a public testnet)
| Step | Tx / result |
|---|---|
| approve | [`0xc7473e66…112c68`](https://sepolia.basescan.org/tx/0xc7473e66384c056694e3f98bea8a3f3fd21b4caa985ca4cb51c6f0f850112c68) ✓ |
| **stake 5,000,000 (VIP)** | [`0x17f5cb95…c72f93`](https://sepolia.basescan.org/tx/0x17f5cb950299b1574e468d01ddf4bbe8fef2bd58b742020f3a5c2f9105c72f93) ✓ principal credited, `tierByAmount=4`, `aprBps=4500`, rewards accruing |
| **7-day gate active** | `getStakingTier` reverts `not eligible` · `getMultiplier`=1e18 · **`StubVoting.tierVoteCap`=500e18** (real V3d read-logic falls back exactly as intended) ✓ |
| **claim** | [`0x7c06205f…de0a92`](https://sepolia.basescan.org/tx/0x7c06205fbd1e070e73d44c68a5210c7d36f065fff6b813754a7e5bc610de0a92) ✓ paid **7.56 TTS** from the pool, principal untouched |
| partial unstake 1M | ✓ `totalStaked` 5e24→4e24 |
| unstake 2M | ✓ |
| **emergency withdraw** (remaining 2M) | ✓ principal returned |
| **final** | `totalStaked=0` · deployer recovered all 5M principal + kept 7.56 reward · pool 9,999,999,992.44 · **invariant balance ≥ totalStaked holds** ✓ |

## BaseScan source verification — PENDING (needs the API key)
`ETHERSCAN_API_KEY` is **not present in `.env`** (checked). Once it is, verify with:
```bash
cd staking
export ETHERSCAN_API_KEY=<key>
# impl has no constructor args:
forge verify-contract 0xD818828b9B9D96B199f7EDCE46f4ea873BFeEBe2 \
  src/TTSStaking.sol:TTSStaking --chain 84532 --watch
# others need --constructor-args (abi-encode their ctor); MockTTS(address treasury),
# TimelockController(uint256,address[],address[],address), StubVotingV3d(address),
# TestProxy(address,bytes) — see script/DeploySepolia.s.sol for the exact values.
```

## Website UI wiring
Local `.env` now points the config at this deployment (`VITE_STAKING_ADDRESS`/`_TTS`/
`_CHAIN_ID`/`_RPC`/`_EXPLORER`). **`VITE_STAKING_ENABLED` is deliberately omitted** →
`STAKING_ENABLED=false` → the site keeps "Coming Soon". To drive the UI against Sepolia
**locally only**: add `VITE_STAKING_ENABLED=true` to `.env.local` and `npm run dev`
(never in production until Jim's cutover approval).
