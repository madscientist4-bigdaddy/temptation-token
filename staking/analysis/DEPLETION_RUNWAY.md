# Gate E — 10B TTS reward-pool depletion runway

Reproduce: `node staking/analysis/depletion_model.mjs`

**Model.** The 10B pool is the rewards budget. Annual outflow = Σ(staked_tier ×
APR_tier). With ~constant TVL, depletion is linear: `runway = 10B / annualOutflow`.

| Scenario | TVL | Blended APR | Annual out | **Runway** |
|---|---:|---:|---:|---:|
| A. Conservative launch (Bronze/Silver heavy) | 0.5B | 10.2% | 51M/yr | **>100 yr** |
| B. Moderate (balanced) | 2B | 15.6% | 313M/yr | **32.0 yr** |
| C. Popular (mid-tier heavy) | 5B | 17.5% | 876M/yr | **11.4 yr** |
| D. Heavy VIP (all VIP) | 5B | 45.0% | 2.25B/yr | **4.4 yr** |
| E. Whale-dominated (high tiers) | 10B | 29.9% | 2.99B/yr | **3.3 yr** |
| F. Adversarial max (15B all VIP) | 15B | 45.0% | 6.75B/yr | **1.5 yr** |

**Max TVL that still holds a target runway** (`10B / (blendedAPR × years)`):

| Target | @15% | @20% | @30% | @45% |
|---|---:|---:|---:|---:|
| 3-yr | 22.2B | 16.7B | 11.1B | 7.4B |
| 5-yr | 13.3B | 10.0B | 6.7B | 4.4B |
| 10-yr | 6.7B | 5.0B | 3.3B | 2.2B |

## Verdict — FLAGGED, with a mitigation already built in

At realistic launch/growth TVL the pool lasts **decades** (scenarios A–C). The
runway only gets uncomfortable when a **large fraction of supply concentrates in
the top tiers** (D–F: 1.5–4.4 yr). The published **45% VIP APR is the dominant
driver** — every TTS at VIP burns the pool ~5.6× faster than at Bronze.

Because this is the *final* contract, the fix must not require an upgrade — so
per-tier APRs are **governance-adjustable storage** (`setAprBps`, Safe-only,
ascending + 200% ceiling + ≤4× deviation guard), defaulting to the published
8/12/18/32/45%. **Halving APRs doubles every runway above.**

### Recommendation before mainnet
1. Pick a **minimum acceptable runway** (suggest ≥ 5 yr).
2. Watch VIP/Diamond TVL. If concentration pushes projected runway under target,
   the Safe throttles high-tier APRs via `setAprBps` (no upgrade, no principal risk).
3. Optionally seed a **replenishment plan** (route a slice of house cut into
   `fundRewards`) so the pool is topped up rather than only drawn down.
4. None of this blocks launch — at expected early TVL the runway is >100 yr.
