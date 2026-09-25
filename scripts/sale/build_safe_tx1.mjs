/**
 * Build Safe Transaction Builder JSON for the liquidity move (Safe tx #1).
 *
 * Reads the CURRENT mainnet price and derives every parameter from it. That is not a
 * convenience — the pool's initialize() price and the position's tick range encode the
 * price at the moment they are computed. Sign a batch built last week and you either
 * initialize the pool at a stale price (a free arbitrage for whoever notices first) or
 * mint a position that is partly in range and silently takes less TTS than intended.
 *
 * RE-RUN THIS IMMEDIATELY BEFORE SIGNING. The file prints its own expiry.
 */
import { createPublicClient, http, parseAbi, parseEther, formatEther, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';
import fs from 'node:fs';

const RPC = process.env.BASE_RPC_URL;
const pub = createPublicClient({ chain: base, transport: http(RPC) });

const WETH='0x4200000000000000000000000000000000000006';
const TTS='0x5570eA97d53A53170e973894A9Fa7feb5785d3b9';
const V2PAIR='0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68';
const SAFE='0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86';
const FACTORY='0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
const NPM='0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1';
const FEE=3000, SPACING=60;
// Deterministic: the v3 factory deploys with CREATE2 over (token0, token1, fee), so
// this is the same address on the fork and on mainnet. Verified empty on mainnet.
const POOL='0x09E7a7A90b1C4E8Ad69b26417fE88FE30Af31cC8';

const v2=parseAbi(['function getReserves() view returns (uint112,uint112,uint32)']);
const factoryAbi=parseAbi(['function createPool(address,address,uint24) returns (address)','function getPool(address,address,uint24) view returns (address)']);
const poolAbi=parseAbi(['function initialize(uint160)']);
const tokenAbi=parseAbi(['function setTaxExempt(address,bool)','function approve(address,uint256) returns (bool)','function balanceOf(address) view returns (uint256)']);
const npmAbi=parseAbi(['function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256,uint128,uint256,uint256)']);

const align=t=>Math.floor(t/SPACING)*SPACING;

const [r0,r1]=await pub.readContract({address:V2PAIR,abi:v2,functionName:'getReserves'});
const P=Number(r1)/Number(r0);
const ethUsd=Number((await (await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot')).json()).data.amount);
const ttsUsd=ethUsd/P;

const L=Math.max((500/ethUsd)*Math.sqrt(P)/0.02,(1000/ethUsd)*Math.sqrt(P)/0.05)*1.5;
const tickUpper=align(Math.floor(Math.log(P)/Math.log(1.0001)));
const tickLower=align(Math.floor(Math.log(P/2.56)/Math.log(1.0001)));
const ttsAmt=Math.floor(L*(Math.sqrt(P)-Math.sqrt(P/2.56)));
const amt=parseEther(String(ttsAmt));
const sqrtPriceX96=BigInt(Math.floor(Math.sqrt(P)*2**96));
const deadline=BigInt(Math.floor(Date.now()/1000)+14*86400);
const existing=await pub.readContract({address:FACTORY,abi:factoryAbi,functionName:'getPool',args:[WETH,TTS,FEE]});
const safeBal=await pub.readContract({address:TTS,abi:tokenAbi,functionName:'balanceOf',args:[SAFE]});

const txs=[];
if(existing==='0x0000000000000000000000000000000000000000')
  txs.push({to:FACTORY,value:'0',data:encodeFunctionData({abi:factoryAbi,functionName:'createPool',args:[WETH,TTS,FEE]}),_d:`Create the Uniswap v3 WETH/TTS pool at the 0.3% fee tier. Deterministic address ${POOL}. No pool exists at this tier today.`});
txs.push({to:POOL,value:'0',data:encodeFunctionData({abi:poolAbi,functionName:'initialize',args:[sqrtPriceX96]}),_d:`Set the new pool's opening price to the current Uniswap v2 price ($${ttsUsd.toFixed(6)} per TTS). Matching v2 means there is no arbitrage gap the moment it opens.`});
txs.push({to:TTS,value:'0',data:encodeFunctionData({abi:tokenAbi,functionName:'setTaxExempt',args:[POOL,true]}),_d:`Exempt the new pool from the 1% transfer tax. The token skips tax when either side is exempt; without this every purchase out of the pool loses 1%. The existing v2 pair is already exempt, so this only brings the new pool to parity.`});
txs.push({to:TTS,value:'0',data:encodeFunctionData({abi:tokenAbi,functionName:'approve',args:[NPM,amt]}),_d:`Allow Uniswap's position manager to take ${ttsAmt.toLocaleString()} TTS from the Safe. Exact amount, not unlimited.`});
txs.push({to:NPM,value:'0',data:encodeFunctionData({abi:npmAbi,functionName:'mint',args:[{token0:WETH,token1:TTS,fee:FEE,tickLower,tickUpper,amount0Desired:0n,amount1Desired:amt,amount0Min:0n,amount1Min:0n,recipient:SAFE,deadline}]}),_d:`Deposit ${ttsAmt.toLocaleString()} TTS as single-sided liquidity, priced from today's price up to about +60%. No ETH and no cash leaves the Safe. The position NFT is minted to the Safe itself.`});

const batch={version:'1.0',chainId:'8453',createdAt:Date.now(),
  meta:{name:'TTS Safe tx #1 — concentrated buy-side liquidity',
    description:`Open a Uniswap v3 WETH/TTS pool and seed it with ${ttsAmt.toLocaleString()} TTS single-sided. Raises the maximum card purchase from about $50 to $1,000 within the app's 5% price-impact guard. Costs no ETH and no cash.`,
    txBuilderVersion:'1.16.5',createdFromSafeAddress:SAFE},
  transactions:txs.map(({_d,...t})=>t)};

fs.mkdirSync('outputs/sale/safe',{recursive:true});
fs.writeFileSync('outputs/sale/safe/1_liquidity.json',JSON.stringify(batch,null,2));

const expiry=new Date(Date.now()+14*86400*1000).toISOString().slice(0,10);
const md=`# Safe transaction #1 — buy-side liquidity, in plain English

**For: Jim and Mike. Both signatures required. Nothing here spends ETH, cash, or any
wallet other than the Safe's own TTS.**

Built ${new Date().toISOString().slice(0,16).replace('T',' ')} UTC against live mainnet price
$${ttsUsd.toFixed(6)} per TTS (ETH $${ethUsd.toFixed(2)}).

## The problem it fixes
Today the only TTS pool holds about ${formatEther(r0).slice(0,6)} WETH. A \\$100 card purchase
moves the price more than 7%, and the app refuses any trade over 5%, so **the largest
card purchase anyone can actually complete is around \\$50.** The card on-ramp is one of
the headline features of what is being sold, and it does not work above pocket change.

## What these ${txs.length} transactions do
${txs.map((t,i)=>`${i+1}. ${t._d}`).join('\n')}

## What it costs
- **${ttsAmt.toLocaleString()} TTS**, which is **${(ttsAmt/Number(formatEther(safeBal))*100).toFixed(4)}%** of the Safe's ${Number(formatEther(safeBal)).toExponential(2)} TTS.
- **No ETH. No cash.** The position is single-sided: it holds only TTS, offered at
  today's price and above. It is sold only if someone buys at those prices.
- Founder, Team and Treasury wallets are untouched. The TTS comes from the Safe's own
  balance, because a Safe transaction can only move the Safe's own assets — the
  Treasury address is an ordinary wallet, not controlled by the Safe.

## Proven, not estimated
Every transaction was executed against a Base mainnet fork and the resulting pool was
traded through at six purchase sizes. Full transcript: \`outputs/sale/liquidity_forktest.md\`.

| purchase | before | after |
|---|---|---|
| \\$100 | 7.3% impact — refused | 0.9% — fine |
| \\$500 | 35.6% impact — refused | **1.9%** |
| \\$1,000 | 70.8% impact — refused | **3.3%** |

Selling back was also tested: buy \\$500, sell it straight back, recover \\$497 (0.6% round
trip, which is the two 0.3% swap fees). The position is not a one-way trap.

## Before you sign — this batch expires ${expiry}
The opening price and the price range are computed from the price at build time. If TTS
moves meaningfully before signing, this batch would open the pool at a stale price, which
is a free profit for the first person to notice. **Re-run \`node scripts/sale/build_safe_tx1.mjs\`
and re-upload the JSON if more than a few days have passed, or if the price has moved
more than a few percent.**

## Risks worth naming
- The TTS in this position is sold if buyers arrive at these prices. That is the point,
  but it is a real disposal of ${ttsAmt.toLocaleString()} TTS, not a loan.
- If the price falls below the range, the position converts entirely to WETH and stops
  offering TTS. It does not "lose" anything, but it stops helping until price recovers.
- A stray empty Uniswap v3 pool already exists at the **1% fee tier**
  (\`0x7f52386781Cd5c01a1f6A0B4fB028ab7598a3Bd1\`), initialized at an implausible price with
  zero liquidity and no tax exemption. It is harmless while empty — nothing routes through
  a pool with no liquidity — but **no one should ever add liquidity to it at that price.**
`;
fs.writeFileSync('outputs/sale/safe/1_liquidity_summary.md',md);
console.log(`built ${txs.length} transactions`);
console.log(`TTS: ${ttsAmt.toLocaleString()} (${(ttsAmt/Number(formatEther(safeBal))*100).toFixed(4)}% of Safe)`);
console.log(`ticks [${tickLower}, ${tickUpper}]  price $${ttsUsd.toFixed(6)}  expires ${expiry}`);
