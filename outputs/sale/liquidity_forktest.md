## Fork test — concentrated liquidity for the card on-ramp
Fork block 51754958  ·  ETH $2693.10
V2 pool: 0.526594496195889884 WETH / 101611.595507125101758369 TTS
Spot: 192960 TTS per WETH  ·  $0.013957 per TTS

Liquidity needed for $500 @ 2%: L=4078
Liquidity needed for $1,000 @ 5%: L=3262
Target (binding constraint + 50% headroom): L=6117
Range: ticks [112260, 121680]  (TTS up to +60% vs ETH)
TTS to deposit: 1007574 TTS
= 0.0101% of the Safe's 1.00e+10 TTS

### Before (Uniswap v2 only)
| buy | price impact | passes 5% guard |
|---|---|---|
| $30 | 2.42% | yes |
| $50 | 3.83% | yes |
| $100 | 7.35% | NO |
| $250 | 17.93% | NO |
| $500 | 35.56% | NO |
| $1000 | 70.81% | NO |

Pool created: 0x09E7a7A90b1C4E8Ad69b26417fE88FE30Af31cC8  ·  taxExempt=true
Position minted (status=success, gas=513995). Pool now holds 1007573.999999999999999886 TTS / 0 WETH
Pool active liquidity: 0

### After (new v3 pool), measured by actually swapping on the fork
| buy | TTS received | effective $/TTS | price impact | passes 5% guard |
|---|---|---|---|---|
| $30 | 2135 | $0.014050 | 0.67% | yes |
| $50 | 3557 | $0.014057 | 0.72% | yes |
| $100 | 7104 | $0.014076 | 0.85% | yes |
| $250 | 17691 | $0.014132 | 1.25% | yes |
| $500 | 35149 | $0.014225 | 1.92% | yes |
| $1000 | 69389 | $0.014411 | 3.26% | yes |

### Sell-side sanity (sell the TTS from a $500 buy straight back)
Bought with $500, received 35149 TTS, sold back for $497.02.
Round-trip cost $2.98 (0.60%) — two 0.3% fees plus the spread. Sell did not revert (status=success).

### Result
Max buy under 2% impact: $500 (was $0)
Max buy under the app's 5% guard: $1000 (was $50)
Target "$500 under 2%": MET   ·   "$1,000 under 5%": MET
