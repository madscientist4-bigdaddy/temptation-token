// ─────────────────────────────────────────────────────────────────────────────
// MANUAL SETTLE / ROUND-START FALLBACK  (TTSKeeper3)
//
// Guaranteed one-command recovery if the (Deprecated) Chainlink Automation upkeep
// fails to fire — e.g. Sunday night settlement or the Monday round-start. The Bank
// wallet is Keeper3.owner(), and Keeper3.manualExecute(action) is onlyOwner, so the
// Bank can do exactly what the Automation forwarder would have done. The action to
// take is read straight from Keeper3.checkUpkeep() so this mirrors the keeper 1:1.
//
//   ACTION_START_ROUND = 1   (start the next round)
//   ACTION_SETTLE      = 3   (settle the current round → requests VRF)
//   ACTION_ROLLOVER    = 4   (no votes → rollover, no VRF)
//
// USAGE
//   Pre-flight (READ-ONLY, no key needed, DEFAULT):
//     node --env-file=.env outputs/manual_settle_fallback.mjs
//   Execute the single action that is currently due (Bank key required):
//     node --env-file=.env outputs/manual_settle_fallback.mjs --execute
//   Full Sunday recovery — settle, wait for VRF, then start next round:
//     node --env-file=.env outputs/manual_settle_fallback.mjs --execute --wait
//
// ENV: BASE_RPC_URL, DEPLOYER_PRIVATE_KEY (Bank — only needed with --execute).
//
// SAFETY: never writes unless --execute is passed; verifies chainId 8453 and that
// the signer == Keeper3.owner() (Bank); aborts a SETTLE if VRF is already pending
// (that is the stall case — use outputs/round4_vrf_recovery_runbook.md instead).
// ─────────────────────────────────────────────────────────────────────────────

import { createPublicClient, createWalletClient, http, parseAbi, getAddress, decodeAbiParameters } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const KEEPER3 = '0x363Ce4960E3B459f5892587A37Ae1fF2ED04442C'
const V3D     = '0x783B8cd80B586B723188C93EF94EE1BEedE617B4'
const BANK    = '0xb1e991bf617459b58964eef7756b350e675c53b5'

const ACTION = { 1: 'START_ROUND', 3: 'SETTLE', 4: 'ROLLOVER' }

const EXECUTE = process.argv.includes('--execute')
const WAIT    = process.argv.includes('--wait')

const die = (m) => { console.error('\n❌ ABORT:', m); process.exit(1) }
const eq  = (a, b) => getAddress(a) === getAddress(b)
const ts  = (n) => new Date(Number(n) * 1000).toISOString()
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const RPC = process.env.BASE_RPC_URL
if (!RPC) die('BASE_RPC_URL not set')

const KEEPER_ABI = parseAbi([
  'function owner() view returns (address)',
  'function votingContract() view returns (address)',
  'function s_forwarder() view returns (address)',
  'function s_nextSettleTarget() view returns (uint256)',
  'function checkUpkeep(bytes) view returns (bool upkeepNeeded, bytes performData)',
  'function getNextSettlementTime() view returns (uint256)',
  'function manualExecute(uint256 action)',
  'event ManualExecuted(uint256 action, bool success)',
])
const V3D_ABI = parseAbi([
  'function currentRoundId() view returns (uint256)',
  'function getRound(uint256) view returns (uint256 startTime, uint256 endTime, uint256 totalTickets, uint256 totalRawVotes, bool settled, bool vrfPending, uint256 profileCount)',
])

const pub = createPublicClient({ chain: base, transport: http(RPC) })

async function readState() {
  const chainId = await pub.getChainId()
  if (chainId !== 8453) die(`Wrong chain ${chainId} (expected Base mainnet 8453)`)

  const [owner, voting, forwarder, nextTarget] = await Promise.all([
    pub.readContract({ address: KEEPER3, abi: KEEPER_ABI, functionName: 'owner' }),
    pub.readContract({ address: KEEPER3, abi: KEEPER_ABI, functionName: 'votingContract' }),
    pub.readContract({ address: KEEPER3, abi: KEEPER_ABI, functionName: 's_forwarder' }),
    pub.readContract({ address: KEEPER3, abi: KEEPER_ABI, functionName: 's_nextSettleTarget' }),
  ])
  const roundId = await pub.readContract({ address: V3D, abi: V3D_ABI, functionName: 'currentRoundId' })
  let round = null
  if (roundId > 0n) {
    const r = await pub.readContract({ address: V3D, abi: V3D_ABI, functionName: 'getRound', args: [roundId] })
    round = { startTime: r[0], endTime: r[1], settled: r[4], vrfPending: r[5], profileCount: r[6] }
  }
  // checkUpkeep — the keeper's own decision
  const [needed, performData] = await pub.readContract({ address: KEEPER3, abi: KEEPER_ABI, functionName: 'checkUpkeep', args: ['0x'] })
  let action = null
  if (needed && performData && performData !== '0x') {
    action = Number(decodeAbiParameters([{ type: 'uint256' }], performData)[0])
  }
  return { chainId, owner, voting, forwarder, nextTarget, roundId, round, needed, action, performData }
}

function report(s) {
  const now = Math.floor(Date.now() / 1000)
  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('  TTSKeeper3 — manual settle / round-start FALLBACK  (pre-flight)')
  console.log('══════════════════════════════════════════════════════════════')
  console.log(`Keeper3            ${KEEPER3}`)
  console.log(`  owner            ${s.owner}   ${eq(s.owner, BANK) ? '✅ Bank (can manualExecute)' : '⚠️ NOT Bank'}`)
  console.log(`  votingContract   ${s.voting}   ${eq(s.voting, V3D) ? '✅ V3d' : '⚠️ unexpected'}`)
  console.log(`  s_forwarder      ${s.forwarder}`)
  console.log(`  s_nextSettleTarget ${s.nextTarget}  (${ts(s.nextTarget)})`)
  console.log(`Current round      #${s.roundId}`)
  if (s.round) {
    console.log(`  endTime          ${s.round.endTime}  (${ts(s.round.endTime)})  ${now >= Number(s.round.endTime) ? '→ PASSED' : '→ future'}`)
    console.log(`  settled          ${s.round.settled}`)
    console.log(`  vrfPending       ${s.round.vrfPending}`)
    console.log(`  profileCount     ${s.round.profileCount}`)
  } else {
    console.log('  (no round started yet)')
  }
  console.log('──────────────────────────────────────────────────────────────')
  console.log(`checkUpkeep()      upkeepNeeded=${s.needed}` + (s.action != null ? `  action=${s.action} (${ACTION[s.action] || '?'})` : ''))

  // Diagnosis
  if (!s.needed) {
    if (s.round && s.round.vrfPending && !s.round.settled) {
      console.log('DIAGNOSIS          Round is mid-settlement (vrfPending) — awaiting Chainlink VRF, NOT an')
      console.log('                   automation problem. If it stays pending > ~1h see')
      console.log('                   outputs/round4_vrf_recovery_runbook.md (VRF stall, not this script).')
    } else if (s.round && !s.round.settled && now < Number(s.round.endTime)) {
      console.log(`DIAGNOSIS          Round live and not yet ended (${Math.round((Number(s.round.endTime) - now) / 3600)}h left). Nothing to do.`)
    } else {
      console.log('DIAGNOSIS          Nothing due right now.')
    }
    console.log('ACTION             none — do NOT run --execute.')
  } else {
    const overdue = s.round && now >= Number(s.round.endTime)
    console.log(`DIAGNOSIS          Upkeep IS due (${ACTION[s.action]})${overdue ? ' and the round end has PASSED' : ''}.`)
    if (s.action === 3) console.log('                   → would call votingContract.settleRound() (requests VRF).')
    if (s.action === 1) console.log('                   → would call votingContract.startRound(duration) for the next round.')
    if (s.action === 4) console.log('                   → would call votingContract.rolloverRound() (no votes, no VRF).')
    if (s.action === 3 && s.round?.vrfPending) {
      console.log('⚠️ WARNING          vrfPending is already true — settleRound would revert. This is the')
      console.log('                   VRF-stall case; use outputs/round4_vrf_recovery_runbook.md, not this script.')
    }
    console.log(`ACTION             run:  node --env-file=.env outputs/manual_settle_fallback.mjs --execute${s.action === 3 ? ' --wait' : ''}`)
  }
  console.log('══════════════════════════════════════════════════════════════\n')
}

async function execAction(wallet, action, label) {
  console.log(`→ manualExecute(${action} / ${ACTION[action]}) …`)
  const hash = await wallet.writeContract({ address: KEEPER3, abi: KEEPER_ABI, functionName: 'manualExecute', args: [BigInt(action)] })
  console.log(`  tx ${hash}  — awaiting receipt…`)
  const rcpt = await pub.waitForTransactionReceipt({ hash })
  if (rcpt.status !== 'success') die(`${label} tx reverted (${hash})`)
  // decode ManualExecuted(action, success)
  let innerOk = null
  for (const log of rcpt.logs) {
    try {
      const dec = decodeAbiParameters([{ type: 'uint256' }, { type: 'bool' }], log.data)
      innerOk = dec[1]
    } catch {}
  }
  console.log(`  ✅ mined. inner voting call success=${innerOk}`)
  if (innerOk === false) {
    console.log('  ⚠️ The keeper ran but the voting call reverted (try/catch). For a failed SETTLE this is')
    console.log('     usually the VRF/settlement precondition — check outputs/round4_vrf_recovery_runbook.md.')
  }
  return innerOk
}

async function main() {
  const s = await readState()
  report(s)

  if (!EXECUTE) {
    console.log('READ-ONLY pre-flight complete. No transaction sent. Add --execute to act.')
    return
  }

  // ── write path (guarded) ──────────────────────────────────────────────────
  if (!s.needed) die('checkUpkeep says nothing is due — refusing to execute.')
  const PK = process.env.DEPLOYER_PRIVATE_KEY
  if (!PK) die('DEPLOYER_PRIVATE_KEY (Bank) required for --execute')
  const account = privateKeyToAccount(PK.startsWith('0x') ? PK : `0x${PK}`)
  if (!eq(account.address, BANK)) die(`Signer ${account.address} is not the Bank wallet (${BANK})`)
  if (!eq(s.owner, account.address)) die('Bank is not Keeper3.owner() — manualExecute would revert')
  if (s.action === 3 && s.round?.vrfPending) die('vrfPending already true — SETTLE would revert. Use the VRF recovery runbook.')

  const wallet = createWalletClient({ account, chain: base, transport: http(RPC) })

  const first = await execAction(wallet, s.action, ACTION[s.action])

  // ── --wait: settle → poll VRF → start next round ──────────────────────────
  if (WAIT && s.action === 3 && first !== false) {
    console.log('\n⏳ Waiting for VRF fulfillment, then starting the next round…')
    const deadline = Date.now() + 15 * 60 * 1000
    while (Date.now() < deadline) {
      await sleep(15000)
      const r = await pub.readContract({ address: V3D, abi: V3D_ABI, functionName: 'getRound', args: [s.roundId] })
      const settled = r[4], vrfPending = r[5]
      process.stdout.write(`  round #${s.roundId}: settled=${settled} vrfPending=${vrfPending}\r`)
      if (settled) {
        console.log(`\n  ✅ Round #${s.roundId} settled. Starting next round…`)
        const s2 = await readState()
        if (s2.needed && s2.action === 1) { await execAction(wallet, 1, 'START_ROUND') }
        else console.log(`  checkUpkeep now: needed=${s2.needed} action=${s2.action} — no start needed.`)
        console.log('\n✅ Fallback complete.')
        return
      }
    }
    console.log('\n⚠️ VRF did not fulfill within 15 min — this is the VRF-stall case.')
    console.log('   Follow outputs/round4_vrf_recovery_runbook.md, then re-run with --execute to start the round.')
  } else {
    console.log('\n✅ Done. If this was a SETTLE, re-run after VRF fulfills to start the next round.')
  }
}

main().catch(e => die(e.shortMessage || e.message || String(e)))
