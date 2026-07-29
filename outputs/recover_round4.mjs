#!/usr/bin/env node
// PERMANENT VRF-stall recovery tool for TTSVotingV3d.
//   Usage:  node --env-file=.env outputs/recover_round4.mjs [roundNumber]   (default 4)
//
// Staged, receipt-gated Bank-wallet operation. After EVERY tx: wait for receipt,
// pause 5s, re-read on-chain state, and ABORT if anything mismatches. Ownership is
// ALWAYS returned to Keeper3 (even on abort / stranded) via a guarded finalize.
//
// Requires env: DEPLOYER_PRIVATE_KEY (Bank), BASE_RPC_URL.
import { createPublicClient, createWalletClient, http, parseAbi, formatEther, formatUnits, decodeEventLog, encodeEventTopics } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { writeFileSync } from 'node:fs'

const ROUND = BigInt(process.argv[2] || process.env.RECOVER_ROUND || 4)
const RPC = process.env.BASE_RPC_URL
const PK_RAW = process.env.DEPLOYER_PRIVATE_KEY
if (!RPC || !PK_RAW) { console.error('FATAL: BASE_RPC_URL and DEPLOYER_PRIVATE_KEY required'); process.exit(2) }
const PK = PK_RAW.startsWith('0x') ? PK_RAW : `0x${PK_RAW}`

const V3D = '0x783b8cd80b586b723188c93ef94ee1beede617b4'
const KEEPER3 = '0x363ce4960e3b459f5892587a37ae1ff2ed04442c'
const NFT = '0x0768e862D3AB14d85213BfeF8f1D012E77721da2'
const TTS = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
const COORD = '0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634'
const eq = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase()

const LABELS = {
  [KEEPER3]: 'Keeper3', [V3D]: 'V3d', [TTS]: 'TTS-token',
  '0xb1e991bf617459b58964eef7756b350e675c53b5': 'Bank/House',
  '0x7a9ff2f584248744cbba32c737d660ed6f077fcb': 'Marketing(houseWallet)',
  '0xf7dd429d679cb61231e73785fd1737e60138aba3': 'Polaris/Charity',
  '0x000000000000000000000000000000000000dead': 'BURN',
}
const lab = a => LABELS[(a || '').toLowerCase()] || ''

const V3_ABI = parseAbi([
  'function currentRoundId() view returns (uint256)',
  'function owner() view returns (address)',
  'function admin() view returns (address)',
  'function subscriptionId() view returns (uint256)',
  'function getRound(uint256) view returns (uint256 startTime,uint256 endTime,uint256 totalTickets,uint256 totalRawVotes,bool settled,bool vrfPending,uint256 profileCount)',
  'function houseWallet() view returns (address)',
  'function charityWallet() view returns (address)',
  'function adminTransferOwnership(address to) external',
  'function adminResetSettlement(uint256 roundId) external',
  'function settleRound() external',
  'event RoundSettled(uint256 indexed roundId, string winnerProfileId, address winnerWallet, uint256 pool)',
  'event VRFRequested(uint256 indexed roundId, uint256 requestId)',
])
const CO_ABI = parseAbi([
  'function getSubscription(uint256) view returns (uint96 balance,uint96 nativeBalance,uint64 reqCount,address owner,address[] consumers)',
  'function s_requestCommitments(uint256) view returns (bytes32)',
])
const NFT_ABI = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256) view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
])
const XFER = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)'])

const pub = createPublicClient({ chain: base, transport: http(RPC) })
const account = privateKeyToAccount(PK)
const BANK = account.address
const wallet = createWalletClient({ account, chain: base, transport: http(RPC) })

const _log = []
const log = (...a) => { const s = a.join(' '); _log.push(s); console.log(s) }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const rd = (fn, args = []) => pub.readContract({ address: V3D, abi: V3_ABI, functionName: fn, args })
const getRound = () => rd('getRound', [ROUND])
const tts = v => Number(formatUnits(v, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 })

function saveReport(tag) {
  try { writeFileSync(`outputs/recover_round${ROUND}_report.txt`, _log.join('\n') + '\n'); log(`\n(report saved to outputs/recover_round${ROUND}_report.txt)`) } catch {}
}

// Guaranteed ownership restoration: if V3d is currently owned by Bank, hand it back.
async function finalizeOwnership(context) {
  try {
    const owner = await rd('owner')
    if (eq(owner, KEEPER3)) { log(`✓ [finalize] V3d owner already Keeper3 (${context}).`); return true }
    if (!eq(owner, BANK)) { log(`⚠ [finalize] V3d owner is ${owner} (${lab(owner)}), not Bank/Keeper3 — cannot auto-restore (${context}).`); return false }
    log(`\n── TX4 — return V3d ownership to Keeper3 (${context}) ──`)
    const hash = await wallet.writeContract({ address: V3D, abi: V3_ABI, functionName: 'adminTransferOwnership', args: [KEEPER3] })
    log(`  tx: ${hash}`)
    const rcpt = await pub.waitForTransactionReceipt({ hash })
    log(`  receipt status: ${rcpt.status}`)
    await sleep(5000)
    const now = await rd('owner')
    if (eq(now, KEEPER3)) { log(`  ✓ owner() == Keeper3 — automation restored.`); return true }
    log(`  ❌ owner() == ${now} (${lab(now)}) — OWNERSHIP NOT RESTORED. MANUAL ACTION NEEDED.`); return false
  } catch (e) {
    log(`  ❌ [finalize] TX4 failed: ${String(e.shortMessage || e.message || e).slice(0, 200)} — OWNERSHIP MAY BE STUCK WITH BANK. MANUAL ACTION NEEDED.`)
    return false
  }
}

async function abort(reason) {
  log(`\n🛑 ABORT: ${reason}`)
  await finalizeOwnership('post-abort restore')
  saveReport('ABORT')
  process.exit(1)
}

// Send a V3d tx from Bank, wait for receipt, verify success.
async function sendV3d(fn, args, label) {
  log(`\n── ${label} ──`)
  let hash
  try { hash = await wallet.writeContract({ address: V3D, abi: V3_ABI, functionName: fn, args }) }
  catch (e) { await abort(`${label} send failed: ${String(e.shortMessage || e.message || e).slice(0, 200)}`) }
  log(`  tx: ${hash}`)
  const rcpt = await pub.waitForTransactionReceipt({ hash })
  log(`  receipt status: ${rcpt.status}  block: ${rcpt.blockNumber}`)
  if (rcpt.status !== 'success') await abort(`${label} reverted on-chain`)
  await sleep(5000)
  return { hash, rcpt }
}

async function main() {
  log(`════════════ TTSVotingV3d VRF-STALL RECOVERY — Round ${ROUND} ════════════`)
  log(`time: ${new Date().toISOString()}  ·  Bank: ${BANK}`)

  // ── STEP 0: PRE-FLIGHT (reads only) ──
  log(`\n════ STEP 0 — PRE-FLIGHT (reads only) ════`)
  const cur = await rd('currentRoundId')
  const r = await getRound()
  const owner = await rd('owner')
  const admin = await rd('admin')
  const subId = await rd('subscriptionId')
  const sub = await pub.readContract({ address: COORD, abi: CO_ABI, functionName: 'getSubscription', args: [subId] })
  const subLink = Number(formatUnits(sub[0], 18))
  const bankEth = await pub.getBalance({ address: BANK })
  const gasPrice = await pub.getGasPrice()
  const need4tx = gasPrice * 200000n * 4n * 2n // 4 txs, 200k each, 2x buffer

  log(`currentRoundId      = ${cur}`)
  log(`getRound(${ROUND}).settled     = ${r[4]}   (want false)`)
  log(`getRound(${ROUND}).vrfPending  = ${r[5]}   (want true)`)
  log(`getRound(${ROUND}).profiles    = ${r[6]}   rawVotes=${tts(r[3])}   endTime=${new Date(Number(r[1]) * 1000).toISOString()}`)
  log(`V3d.owner()         = ${owner}  (${lab(owner)})   (want Keeper3)`)
  log(`V3d.admin()         = ${admin}  (${lab(admin)})   (want Bank)`)
  log(`VRF sub ${subId}`)
  log(`  LINK balance      = ${subLink}   (want >= 2)`)
  log(`  reserve estimate  ≈ ${formatEther(2500000n * 30000000000n)} ETH worth of LINK per request (2.5M callback × 30-gwei lane)`)
  if (subLink < 15) log(`  ⚠ WARNING: sub (${subLink} LINK) is below the ~15-LINK reserve — the fresh request may STRAND again. Proceeding per ≥2-LINK rule.`)
  log(`Bank ETH            = ${formatEther(bankEth)}   (need ~${formatEther(need4tx)} for 4 txs)`)

  // Abort checks (no ownership taken yet — safe to just exit)
  const fails = []
  if (r[4] !== false) fails.push('round already settled')
  if (r[5] !== true) fails.push('vrfPending is not true (nothing stalled)')
  if (!eq(owner, KEEPER3)) fails.push(`owner is ${owner}, expected Keeper3`)
  if (!eq(admin, BANK)) fails.push(`admin is ${admin}, expected Bank (this key cannot adminTransferOwnership)`)
  if (subLink < 2) fails.push(`VRF sub ${subLink} LINK < 2 LINK minimum`)
  if (bankEth < need4tx) fails.push(`Bank ETH ${formatEther(bankEth)} < needed ${formatEther(need4tx)}`)
  if (Number(cur) !== Number(ROUND)) fails.push(`currentRoundId ${cur} != target ${ROUND} (settleRound() acts on currentRoundId)`)
  if (fails.length) { log(`\n🛑 PRE-FLIGHT FAILED:\n  - ${fails.join('\n  - ')}`); saveReport('PREFLIGHT-ABORT'); process.exit(1) }
  log(`\n✅ PRE-FLIGHT PASSED — proceeding to Bank transactions.`)

  // ── TX1: Bank takes ownership ──
  await sendV3d('adminTransferOwnership', [BANK], 'TX1 — adminTransferOwnership(Bank)')
  let owner1 = await rd('owner')
  log(`  re-read owner() = ${owner1} (${lab(owner1)})`)
  if (!eq(owner1, BANK)) await abort(`after TX1 owner is ${owner1}, expected Bank`)
  log(`  ✓ owner() == Bank`)

  // ── TX2: clear stalled VRF ──
  await sendV3d('adminResetSettlement', [ROUND], `TX2 — adminResetSettlement(${ROUND})`)
  let r2 = await getRound()
  log(`  re-read vrfPending = ${r2[5]} (want false)`)
  if (r2[5] !== false) await abort(`after TX2 vrfPending is ${r2[5]}, expected false`)
  log(`  ✓ vrfPending == false`)

  // ── TX3: fresh settleRound() ──
  const { rcpt: rcpt3 } = await sendV3d('settleRound', [], 'TX3 — settleRound() (fires FRESH VRF request)')
  let r3 = await getRound()
  log(`  re-read vrfPending = ${r3[5]} (want true)`)
  if (r3[5] !== true) await abort(`after TX3 vrfPending is ${r3[5]}, expected true — request did not fire`)
  // Parse the new requestId from the VRFRequested event in TX3 receipt.
  let newReqId = null
  for (const lg of rcpt3.logs) {
    if (!eq(lg.address, V3D)) continue
    try { const d = decodeEventLog({ abi: V3_ABI, data: lg.data, topics: lg.topics }); if (d.eventName === 'VRFRequested') newReqId = d.args.requestId } catch {}
  }
  if (newReqId == null) await abort('TX3 did not emit VRFRequested — no fresh request')
  log(`  ✓ fresh VRFRequested(${ROUND}, requestId=${newReqId})`)
  try {
    const commit = await pub.readContract({ address: COORD, abi: CO_ABI, functionName: 's_requestCommitments', args: [newReqId] })
    log(`  coordinator commitment = ${commit} ${commit !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? '(queued ✓)' : '(already cleared)'}`)
  } catch {}
  const tx3Block = rcpt3.blockNumber

  // ── STEP 4: WATCH up to 45 min ──
  log(`\n════ STEP 4 — WATCH for fulfillment (poll 30s, up to 45 min) ════`)
  const deadline = Date.now() + 45 * 60 * 1000
  let settled = false
  while (Date.now() < deadline) {
    await sleep(30000)
    let rr
    try { rr = await getRound() } catch (e) { log(`  [${new Date().toISOString()}] read error, retrying: ${String(e.shortMessage || e).slice(0, 80)}`); continue }
    const mins = Math.round((45 * 60 * 1000 - (deadline - Date.now())) / 60000)
    log(`  [+${mins}m] settled=${rr[4]} vrfPending=${rr[5]}`)
    if (rr[4] === true) { settled = true; break }
  }

  // ── TX4: ALWAYS return ownership ──
  await finalizeOwnership(settled ? 'post-settle' : 'post-watch (not yet fulfilled)')

  // ── STEP 6: POST-VERIFY REPORT ──
  log(`\n════ STEP 6 — POST-VERIFY REPORT ════`)
  const rf = await getRound()
  log(`getRound(${ROUND}).settled = ${rf[4]}`)
  if (!settled && !rf[4]) {
    log(`\n⚠ STRANDED-AGAIN: no fulfillment within 45 min. Ownership returned to Keeper3.`)
    log(`  Most likely cause: VRF sub below the per-request reserve (fund sub ${await rd('subscriptionId')} to ≥25 LINK, then re-run this tool).`)
    saveReport('STRANDED-AGAIN')
    process.exit(3)
  }

  // Settled — pull RoundSettled + payouts + NFT + Round 5.
  try {
    const topics = encodeEventTopics({ abi: V3_ABI, eventName: 'RoundSettled', args: { roundId: ROUND } })
    const logs = await pub.request({ method: 'eth_getLogs', params: [{ address: V3D, topics, fromBlock: `0x${tx3Block.toString(16)}`, toBlock: 'latest' }] })
    if (logs.length) {
      const l = logs[logs.length - 1]
      const dec = decodeEventLog({ abi: V3_ABI, data: l.data, topics: l.topics })
      log(`\nWINNER: profileId="${dec.args.winnerProfileId}"  wallet=${dec.args.winnerWallet}  pool=${tts(dec.args.pool)} TTS`)
      const fulfilTx = l.transactionHash
      log(`settlement tx: ${fulfilTx}`)
      const frcpt = await pub.getTransactionReceipt({ hash: fulfilTx })
      log(`\n4 PAYOUT TRANSFERS (from V3d, in settlement tx):`)
      const pool = Number(dec.args.pool)
      for (const lg of frcpt.logs) {
        if (!eq(lg.address, TTS)) continue
        try {
          const d = decodeEventLog({ abi: XFER, data: lg.data, topics: lg.topics })
          if (!eq(d.args.from, V3D)) continue
          const pct = pool ? ` (${(Number(d.args.value) / pool * 100).toFixed(1)}%)` : ''
          log(`  → ${tts(d.args.value)} TTS${pct}  to ${d.args.to} ${lab(d.args.to)}  [tx ${fulfilTx}]`)
        } catch {}
      }
    } else {
      log(`\n(no RoundSettled log found in range — settled=true but event not retrieved; check BaseScan)`)
    }
  } catch (e) { log(`\n(payout log read error: ${String(e.shortMessage || e.message || e).slice(0, 140)})`) }

  // NFT
  try {
    const supply = await pub.readContract({ address: NFT, abi: NFT_ABI, functionName: 'totalSupply' })
    log(`\nNFT totalSupply = ${supply}  (expect 3)`)
    for (let i = 0n; i < supply && i < 5n; i++) {
      const tid = await pub.readContract({ address: NFT, abi: NFT_ABI, functionName: 'tokenByIndex', args: [i] })
      const own = await pub.readContract({ address: NFT, abi: NFT_ABI, functionName: 'ownerOf', args: [tid] })
      log(`  token #${tid} → ${own} ${lab(own)}`)
    }
  } catch (e) { log(`  NFT read error: ${String(e.shortMessage || e).slice(0, 100)}`) }

  // Round 5
  const cur2 = await rd('currentRoundId')
  log(`\ncurrentRoundId = ${cur2}`)
  if (Number(cur2) > Number(ROUND)) {
    log(`✓ Round ${Number(ROUND) + 1} auto-started by Keeper3.`)
  } else {
    log(`⚠ Round ${Number(ROUND) + 1} did NOT auto-start (Automation upkeep is deprecated).`)
    log(`  FALLBACK: call Keeper3.manualExecute(1) from the Bank wallet (ACTION_START_ROUND).`)
    log(`  Keeper3 ${KEEPER3} — Bank is owner; V3d owner is now Keeper3, so manualExecute can start the round.`)
  }

  log(`\n════════════ RECOVERY COMPLETE — settled=${rf[4]} ════════════`)
  saveReport('COMPLETE')
}

main().catch(async (e) => {
  log(`\n💥 UNHANDLED ERROR: ${String(e.stack || e.message || e).slice(0, 400)}`)
  await finalizeOwnership('post-error restore')
  saveReport('ERROR')
  process.exit(1)
})
