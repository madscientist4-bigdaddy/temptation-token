# Liquidity truth table — $TTS / WETH on Uniswap V2 (Base)

**Measured live on-chain 2026-08-09 19:3x UTC.** Not an estimate, not a projection —
`getReserves()` on the pool plus the Chainlink ETH/USD feed, run through the constant
product formula with the standard 0.3% fee. Re-run any time with the snippet at the bottom.

Pool: `0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68` · LP locked until **2027-05-05**

---

## The numbers

| Fact | Value |
|---|---|
| WETH in pool | **0.500001 WETH** |
| $TTS in pool | **106,999.79 TTS** |
| ETH/USD (Chainlink) | $1,920.22 |
| **Implied $TTS spot** | **$0.008973** |
| **Total pool TVL** | **$1,920** (both sides) |
| Share of supply in the pool | **0.0002%** of the 69B supply |
| Last swap | 2026-04-02 (≈4 months stale) |

## What a buyer actually receives

Constant product, 0.3% fee, no other routes:

| Buy size | TTS received | TTS at spot | Slippage |
|---|---|---|---|
| $100 | 10,066 | 11,145 | **9.7%** |
| $500 | 36,569 | 55,723 | **34.4%** |
| $1,000 | 54,508 | 111,445 | **51.1%** |
| $5,000 | 89,720 | 557,227 | **83.9%** |
| $10,000 | 97,601 | 1,114,453 | **91.2%** |

Selling is worse — it moves price the other way against a book this thin, and the pool can
never return more than 0.5 WETH total no matter how much $TTS is sold into it.

---

## What this means, stated plainly

1. **The published "spot price" is not a price anyone can trade at.** $0.008973 is the
   marginal price of an infinitesimal trade. The first $100 order already pays ~10%.

2. **The staking tier thresholds are not reachable at their stated USD values.** Bronze is
   6,000 TTS ≈ $54 at spot — but acquiring 6,000 TTS costs roughly $60 after slippage, and
   VIP at 600,000 TTS is **not purchasable from this pool at any price**: the entire pool
   holds 107,000 TTS, so 600,000 TTS cannot be bought here at all. The tier table is
   presently an off-market construct.

3. **Do not cite a market cap.** 69B × $0.008973 = $619M "market cap" is an artifact of a
   $1,920 pool. Publishing that number anywhere is the single fastest way to lose the
   Blockaid/GoPlus appeals and any exchange listing review.

4. **Any announcement that drives buyers here will produce immediate, visible harm.**
   Fifty people buying $100 each would walk the price up hundreds of percent and then back
   down, and every one of them takes a double-digit loss on entry. This is the concrete
   argument for keeping the Phase-4 staking/APR announcement held until liquidity is
   deepened.

5. **The scanner flags are partly downstream of this.** A 0.0002%-of-supply pool with 55%
   supply concentration is close to the textbook honeypot/rug heuristic. Deeper, longer-
   locked liquidity does more for the Blockaid and GoPlus appeals than any amount of
   correspondence.

## What would change it

Depth scales with the WETH side. To get a $1,000 buy under ~5% slippage the pool needs
roughly **$40–60k per side**, i.e. ~20–30 ETH plus the matching $TTS — two orders of
magnitude above today. There is no partial version of this that fixes point 2: until then,
tier thresholds should be described in **TTS only**, never in dollars.

---

## Reproduce

```bash
node -e '
const RPC=process.env.BASE_RPC_URL, POOL="0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68";
const call=async(to,data)=>(await (await fetch(RPC,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_call",params:[{to,data},"latest"]})})).json()).result;
call(POOL,"0x0902f1ac").then(r=>{const w=i=>BigInt("0x"+r.slice(2+i*64,2+(i+1)*64));
  console.log("reserve0",w(0).toString(),"reserve1",w(1).toString())});'
```
(`0x0902f1ac` = `getReserves()`. Pair `token0()` against the TTS address to know which
reserve is which — do not assume the ordering.)
