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
| C | Base Sepolia deploy + live-fire (`script/DeploySepolia.s.sol`) | ⏳ needs funded testnet key |
| D | Integration: real V3d + website UI + admin dashboard + regression | ⏳ after C |
| E | 10B depletion runway (`analysis/DEPLETION_RUNWAY.md`) | ✅ modeled + flagged |

- Gate A/B report: [`SPEC_AND_SECURITY.md`](./SPEC_AND_SECURITY.md)
- Gate E report: [`analysis/DEPLETION_RUNWAY.md`](./analysis/DEPLETION_RUNWAY.md)

**Do not touch mainnet or the live 10B proxy** until every gate is green and Jim
explicitly approves the migration. `src/TTSStaking.sol` is the final contract.
