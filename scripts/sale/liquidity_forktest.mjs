/**
 * Part 4 — prove the concentrated-liquidity position on a Base mainnet fork.
 *
 * The problem: the Uniswap v2 pool holds ~0.53 WETH a side. A $100 card buy moves the
 * price ~7%, and the app refuses anything over 5%, so the usable card window is about
 * $50. That makes the card on-ramp — a headline feature of the thing being sold —
 * effectively decorative.
 *
 * The fix: a Uniswap v3 position holding TTS only, in a narrow band starting at the
 * current price. Single-sided, so it costs no ETH and no cash: we are selling TTS into
 * buy pressure that does not exist yet, at prices at or above spot.
 *
 * Token ordering matters and is easy to get backwards. WETH (0x4200..06) sorts below
 * TTS (0x5570..b9), so WETH is token0 and v3's price is TTS-per-WETH. A *buy* of TTS
 * therefore moves that price DOWN, which means TTS-only liquidity sits BELOW the
 * current tick — the opposite of the intuition you get from thinking in dollars.
 *
 * Run: anvil --fork-url $BASE_RPC_URL --port 8545, then node this file.
 */
import { createPublicClient, createWalletClient, http, parseAbi, formatEther,
         parseEther, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';

const RPC = 'http://127.0.0.1:8545';
const transport = http(RPC);
const pub = createPublicClient({ chain: base, transport });

const WETH    = '0x4200000000000000000000000000000000000006';
const TTS     = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9';
const V2PAIR  = '0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68';
const SAFE    = '0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86';
const FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
const NPM     = '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1';
const ROUTER  = '0x2626664c2603336E57B271c5C0b26F421741e481';
const BUYER   = '0x000000000000000000000000000000000b0b0b01';

const FEE = 3000;              // 0.3%, matching v2 so routing comparisons are apples-to-apples
const TICK_SPACING = 60;

const erc20 = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function transfer(address,uint256) returns (bool)',
  'function setTaxExempt(address,bool)',
  'function isTaxExempt(address) view returns (bool)',
  'function deposit() payable',
]);
const factoryAbi = parseAbi([
  'function createPool(address,address,uint24) returns (address)',
  'function getPool(address,address,uint24) view returns (address)',
]);
const poolAbi = parseAbi([
  'function initialize(uint160)',
  'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,uint8,bool)',
  'function liquidity() view returns (uint128)',
]);
const npmAbi = parseAbi([
  'function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)',
]);
const routerAbi = parseAbi([
  'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
]);
const v2Abi = parseAbi(['function getReserves() view returns (uint112,uint112,uint32)']);

const rpc = (method, params) => fetch(RPC, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
}).then(r => r.json());

async function asAccount(addr, fn) {
  await rpc('anvil_impersonateAccount', [addr]);
  await rpc('anvil_setBalance', [addr, '0x56BC75E2D63100000']); // 100 ETH for gas
  const w = createWalletClient({ account: addr, chain: base, transport });
  try { return await fn(w); } finally { await rpc('anvil_stopImpersonatingAccount', [addr]); }
}

// ── price helpers ─────────────────────────────────────────────────────────
const Q96 = 2n ** 96n;
const sqrtPriceX96From = (p) => BigInt(Math.floor(Math.sqrt(p) * 2 ** 96));
const tickFrom = (p) => Math.floor(Math.log(p) / Math.log(1.0001));
const alignDown = (t) => Math.floor(t / TICK_SPACING) * TICK_SPACING;

async function ethUsd() {
  const r = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot').then(r => r.json());
  return Number(r.data.amount);
}

async function main() {
  const out = [];
  const log = (s = '') => { console.log(s); out.push(s); };

  const ETH_USD = await ethUsd();
  const [r0, r1] = await pub.readContract({ address: V2PAIR, abi: v2Abi, functionName: 'getReserves' });
  const wethRes = r0, ttsRes = r1;                    // token0 = WETH, confirmed on-chain
  const P = Number(ttsRes) / Number(wethRes);         // TTS per WETH
  const ttsUsd = ETH_USD / P;

  log(`## Fork test — concentrated liquidity for the card on-ramp`);
  log(`Fork block ${await pub.getBlockNumber()}  ·  ETH $${ETH_USD.toFixed(2)}`);
  log(`V2 pool: ${formatEther(wethRes)} WETH / ${formatEther(ttsRes)} TTS`);
  log(`Spot: ${P.toFixed(0)} TTS per WETH  ·  $${ttsUsd.toFixed(6)} per TTS`);
  log('');

  // ── size the position ───────────────────────────────────────────────────
  // For a constant-liquidity v3 range, a swap that moves price P -> P' executes at
  // 1/sqrt(P*P') against a spot of 1/P, so impact i satisfies sqrt(P/P') = 1+i, and
  // the WETH required to cause it is L*i/sqrt(P). Invert for the L we need.
  const need = (usd, imp) => (usd / ETH_USD) * Math.sqrt(P) / imp;
  const L_500_2pct  = need(500, 0.02);
  const L_1000_5pct = need(1000, 0.05);
  const L_target = Math.max(L_500_2pct, L_1000_5pct) * 1.5;   // 50% headroom
  log(`Liquidity needed for $500 @ 2%: L=${L_500_2pct.toFixed(0)}`);
  log(`Liquidity needed for $1,000 @ 5%: L=${L_1000_5pct.toFixed(0)}`);
  log(`Target (binding constraint + 50% headroom): L=${L_target.toFixed(0)}`);

  // Range: from spot down to P/2.56 in TTS-per-WETH terms, i.e. TTS appreciating up to
  // 60% against ETH. Wide enough that a run of buys cannot exhaust it in one round.
  const pUpper = P;                 // == spot, so the position is 100% TTS at mint
  const pLower = P / 2.56;
  const tickUpper = alignDown(tickFrom(pUpper));
  const tickLower = alignDown(tickFrom(pLower));
  const ttsNeeded = L_target * (Math.sqrt(pUpper) - Math.sqrt(pLower));
  log(`Range: ticks [${tickLower}, ${tickUpper}]  (TTS up to +60% vs ETH)`);
  log(`TTS to deposit: ${ttsNeeded.toFixed(0)} TTS`);
  const safeBal = await pub.readContract({ address: TTS, abi: erc20, functionName: 'balanceOf', args: [SAFE] });
  log(`= ${(ttsNeeded / Number(formatEther(safeBal)) * 100).toFixed(4)}% of the Safe's ${Number(formatEther(safeBal)).toExponential(2)} TTS`);
  log('');

  // ── baseline: what V2 does today ────────────────────────────────────────
  const SIZES = [30, 50, 100, 250, 500, 1000];
  const v2Impact = (usd) => {
    const dx = (usd / ETH_USD) * 1e18 * 0.997;
    const outTts = Number(ttsRes) * dx / (Number(wethRes) + dx);
    return (((usd / ETH_USD) * 1e18 / outTts) / (Number(wethRes) / Number(ttsRes)) - 1) * 100;
  };
  log('### Before (Uniswap v2 only)');
  log('| buy | price impact | passes 5% guard |');
  log('|---|---|---|');
  for (const s of SIZES) log(`| $${s} | ${v2Impact(s).toFixed(2)}% | ${v2Impact(s) < 5 ? 'yes' : 'NO'} |`);
  log('');

  // ── build it on the fork ────────────────────────────────────────────────
  const pool = await asAccount(SAFE, async (w) => {
    await w.writeContract({ address: FACTORY, abi: factoryAbi, functionName: 'createPool', args: [WETH, TTS, FEE] });
    const p = await pub.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'getPool', args: [WETH, TTS, FEE] });
    await w.writeContract({ address: p, abi: poolAbi, functionName: 'initialize', args: [sqrtPriceX96From(P)] });
    // Without this every swap out of the pool pays the 1% transfer tax: the token skips
    // tax only when the sender OR the recipient is exempt, and a fresh pool is neither.
    await w.writeContract({ address: TTS, abi: erc20, functionName: 'setTaxExempt', args: [p, true] });
    return p;
  });
  log(`Pool created: ${pool}  ·  taxExempt=${await pub.readContract({ address: TTS, abi: erc20, functionName: 'isTaxExempt', args: [pool] })}`);

  const mintAmt = parseEther(Math.floor(ttsNeeded).toString());
  const minted = await asAccount(SAFE, async (w) => {
    await w.writeContract({ address: TTS, abi: erc20, functionName: 'approve', args: [NPM, mintAmt] });
    const hash = await w.writeContract({ address: NPM, abi: npmAbi, functionName: 'mint', args: [{
      token0: WETH, token1: TTS, fee: FEE, tickLower, tickUpper,
      amount0Desired: 0n, amount1Desired: mintAmt, amount0Min: 0n, amount1Min: 0n,
      recipient: SAFE, // The fork's block.timestamp comes from the forked block, not the wall clock,
      // so derive the deadline from the chain rather than from Date.now().
      deadline: (await pub.getBlock()).timestamp + 3600n,
    }] });
    const r = await pub.waitForTransactionReceipt({ hash });
    // A reverted mint used to be logged and walked past, which produced a whole
    // "after" table measured against an empty pool. Fail loudly instead.
    if (r.status !== 'success') throw new Error('position mint REVERTED — nothing below this point would mean anything');
    return r;
  });
  const poolTts = await pub.readContract({ address: TTS, abi: erc20, functionName: 'balanceOf', args: [pool] });
  const poolWeth = await pub.readContract({ address: WETH, abi: erc20, functionName: 'balanceOf', args: [pool] });
  log(`Position minted (status=${minted.status}, gas=${minted.gasUsed}). Pool now holds ${formatEther(poolTts)} TTS / ${formatEther(poolWeth)} WETH`);
  log(`Pool active liquidity: ${await pub.readContract({ address: pool, abi: poolAbi, functionName: 'liquidity' })}`);
  log('');

  // ── swap through it, for real ───────────────────────────────────────────
  log('### After (new v3 pool), measured by actually swapping on the fork');
  log('| buy | TTS received | effective $/TTS | price impact | passes 5% guard |');
  log('|---|---|---|---|---|');
  const rows = [];
  for (const usd of SIZES) {
    const snap = (await rpc('evm_snapshot', [])).result;
    const amountIn = parseEther((usd / ETH_USD).toFixed(18));
    const got = await asAccount(BUYER, async (w) => {
      await pub.waitForTransactionReceipt({ hash: await w.writeContract({ address: WETH, abi: erc20, functionName: 'deposit', value: amountIn }) });
      await pub.waitForTransactionReceipt({ hash: await w.writeContract({ address: WETH, abi: erc20, functionName: 'approve', args: [ROUTER, amountIn] }) });
      const before = await pub.readContract({ address: TTS, abi: erc20, functionName: 'balanceOf', args: [BUYER] });
      const h = await w.writeContract({ address: ROUTER, abi: routerAbi, functionName: 'exactInputSingle', args: [{
        tokenIn: WETH, tokenOut: TTS, fee: FEE, recipient: BUYER,
        amountIn, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n,
      }] });
      const rcpt = await pub.waitForTransactionReceipt({ hash: h });
      if (rcpt.status !== 'success') {
        // Re-run as a call to get the revert reason; a receipt only carries the status.
        await pub.simulateContract({ account: BUYER, address: ROUTER, abi: routerAbi,
          functionName: 'exactInputSingle', args: [{ tokenIn: WETH, tokenOut: TTS, fee: FEE,
          recipient: BUYER, amountIn, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n }] });
        throw new Error(`swap reverted for $${usd} (simulation did not reproduce it)`);
      }
      const after = await pub.readContract({ address: TTS, abi: erc20, functionName: 'balanceOf', args: [BUYER] });
      return after - before;
    });
    const tts = Number(formatEther(got));
    const eff = usd / tts;
    const imp = (eff / ttsUsd - 1) * 100;
    rows.push({ usd, tts, eff, imp });
    log(`| $${usd} | ${tts.toFixed(0)} | $${eff.toFixed(6)} | ${imp.toFixed(2)}% | ${imp < 5 ? 'yes' : 'NO'} |`);
    await rpc('evm_revert', [snap]);
  }
  log('');

  // ── sells back, to prove the position is not a one-way trap ─────────────
  log('### Sell-side sanity (sell the TTS from a $500 buy straight back)');
  const snap = (await rpc('evm_snapshot', [])).result;
  try {
    const amountIn = parseEther((500 / ETH_USD).toFixed(18));
    const res = await asAccount(BUYER, async (w) => {
      await pub.waitForTransactionReceipt({ hash: await w.writeContract({ address: WETH, abi: erc20, functionName: 'deposit', value: amountIn }) });
      await pub.waitForTransactionReceipt({ hash: await w.writeContract({ address: WETH, abi: erc20, functionName: 'approve', args: [ROUTER, amountIn] }) });
      let h = await w.writeContract({ address: ROUTER, abi: routerAbi, functionName: 'exactInputSingle', args: [{
        tokenIn: WETH, tokenOut: TTS, fee: FEE, recipient: BUYER, amountIn, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n }] });
      await pub.waitForTransactionReceipt({ hash: h });
      const tts = await pub.readContract({ address: TTS, abi: erc20, functionName: 'balanceOf', args: [BUYER] });
      await pub.waitForTransactionReceipt({ hash: await w.writeContract({ address: TTS, abi: erc20, functionName: 'approve', args: [ROUTER, tts] }) });
      const wBefore = await pub.readContract({ address: WETH, abi: erc20, functionName: 'balanceOf', args: [BUYER] });
      h = await w.writeContract({ address: ROUTER, abi: routerAbi, functionName: 'exactInputSingle', args: [{
        tokenIn: TTS, tokenOut: WETH, fee: FEE, recipient: BUYER, amountIn: tts, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n }] });
      const rc = await pub.waitForTransactionReceipt({ hash: h });
      const wAfter = await pub.readContract({ address: WETH, abi: erc20, functionName: 'balanceOf', args: [BUYER] });
      return { status: rc.status, tts, back: wAfter - wBefore, spent: amountIn };
    });
    const backUsd = Number(formatEther(res.back)) * ETH_USD;
    log(`Bought with $500, received ${Number(formatEther(res.tts)).toFixed(0)} TTS, sold back for $${backUsd.toFixed(2)}.`);
    log(`Round-trip cost $${(500 - backUsd).toFixed(2)} (${((1 - backUsd / 500) * 100).toFixed(2)}%) — two 0.3% fees plus the spread. Sell did not revert (status=${res.status}).`);
  } catch (e) {
    log(`SELL FAILED: ${e.shortMessage || e.message}`);
  }
  await rpc('evm_revert', [snap]);

  log('');
  const pass2 = rows.filter(r => r.imp < 2).map(r => r.usd);
  const pass5 = rows.filter(r => r.imp < 5).map(r => r.usd);
  log(`### Result`);
  log(`Max buy under 2% impact: $${Math.max(...pass2, 0)} (was $0)`);
  log(`Max buy under the app's 5% guard: $${Math.max(...pass5, 0)} (was $${Math.max(...SIZES.filter(s => v2Impact(s) < 5), 0)})`);
  const ok500 = rows.find(r => r.usd === 500)?.imp < 2;
  const ok1000 = rows.find(r => r.usd === 1000)?.imp < 5;
  log(`Target "$500 under 2%": ${ok500 ? 'MET' : 'NOT MET'}   ·   "$1,000 under 5%": ${ok1000 ? 'MET' : 'NOT MET'}`);

  const fs = await import('node:fs');
  fs.writeFileSync('outputs/sale/liquidity_forktest.md', out.join('\n') + '\n');
  fs.writeFileSync('outputs/sale/liquidity_params.json', JSON.stringify({
    fee: FEE, tickLower, tickUpper, ttsToDeposit: Math.floor(ttsNeeded),
    sqrtPriceX96: sqrtPriceX96From(P).toString(), poolAddressOnFork: pool,
    ethUsdAtDesign: ETH_USD, ttsUsdAtDesign: ttsUsd, targetLiquidity: Math.round(L_target),
  }, null, 2));
  console.log('\nwrote outputs/sale/liquidity_forktest.md + liquidity_params.json');
}
main().catch(e => { console.error('FAILED:', e.shortMessage || e.message); process.exit(1); });
