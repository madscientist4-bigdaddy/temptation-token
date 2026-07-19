# TTSStaking — canonical staking module

Isolated Foundry sub-project (the repo root has legacy `.sol` that forge 1.5
globs and can't compile). Build here.

```bash
cd staking
./setup.sh        # one-time: vendor pinned OZ 4.9.6
forge test        # 42 tests: units, invariants, fuzz, reentrancy, V3d-stub integration
node analysis/depletion_model.mjs   # Gate E runway model
```

| Gate | What | Status |
|---|---|---|
| A | Contract spec → impl (`src/TTSStaking.sol`) | ✅ compiles |
| B | Foundry safety suite + Slither | ✅ 42/42, no high-sev |
| C | Live-fire: mainnet-fork (real TTS+V3d) ✅ · public Sepolia (`script/DeploySepolia.s.sol`) ⏳ needs funded key |
| D | V3d reads tier through 7-day gate ✅ (fork) · website UI + admin controls ⏳ |
| E | 10B depletion runway (`analysis/DEPLETION_RUNWAY.md`) | ✅ modeled + flagged |

**Fork integration** (Gate C/D core): `BASE_RPC_URL=<alchemy> forge test
--match-path test/ForkIntegration.t.sol --evm-version cancun -vv` → 3/3. Proves
real V3d.tierVoteCap reads my `getStakingTier` (500 fallback pre-eligibility,
correct tier cap after 7d), real 1% tax + exemption, and the full stake→claim→
unstake→emergency lifecycle with real TTS — zero mainnet writes.

- Gate A/B report: [`SPEC_AND_SECURITY.md`](./SPEC_AND_SECURITY.md)
- Gate E report: [`analysis/DEPLETION_RUNWAY.md`](./analysis/DEPLETION_RUNWAY.md)

**Do not touch mainnet or the live 10B proxy** until every gate is green and Jim
explicitly approves the migration. `src/TTSStaking.sol` is the final contract.
