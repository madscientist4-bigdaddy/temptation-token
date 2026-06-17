#!/usr/bin/env node
/**
 * deploy_v3d.mjs — Deploy TTSVotingV3d + TTSKeeper3 for calendar-pinned rounds.
 *
 * Steps performed:
 *   1. Pre-flight: verify signer == Bank wallet
 *   2. Deploy TTSVotingV3d with canonical constructor args
 *   3. HALT if V3d.houseWallet != Marketing wallet
 *   4. V3d.setNFTContract(NFT_ADDR)
 *   5. Deploy TTSKeeper3(V3d_addr, FIRST_SETTLE_TARGET)
 *   6. V3d.adminTransferOwnership(Keeper3_addr)   ← leaves Bank as admin, Keeper3 as owner
 *   7. Print final state table
 *
 * Does NOT:
 *   - Register Chainlink upkeep (do manually at automation.chain.link)
 *   - Call setForwarder() on Keeper3 (do after upkeep registration)
 *   - Start Round 1 (Keeper3 starts it automatically once upkeep fires)
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x<key> node outputs/deploy_v3d.mjs
 *   DEPLOYER_PRIVATE_KEY=0x<key> node outputs/deploy_v3d.mjs --dry-run
 *
 * Requires: node >=18. No npm install needed — uses project node_modules.
 */

import { readFileSync } from 'fs'
import { createPublicClient, createWalletClient, http, parseAbi } from '../node_modules/viem/_esm/index.js'
import { privateKeyToAccount } from '../node_modules/viem/_esm/accounts/index.js'

// ── Canonical addresses ───────────────────────────────────────────────────────

const BANK_ADDR      = '0xb1e991bf617459b58964eef7756b350e675c53b5'
const MARKETING_ADDR = '0x7a9ff2f584248744cBbA32c737D660ED6f077fCB'
const CHARITY_ADDR   = '0xf7dd429d679cb61231e73785fd1737e60138aba3'
const NFT_ADDR       = '0x0768e862D3AB14d85213BfeF8f1D012E77721da2'
const TTS_TOKEN      = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
const STAKING_ADDR   = '0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc'
const VRF_COORD      = '0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634'
const KEY_HASH       = '0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70'
const SUB_ID         = 58222014484560539249027457203866883376041731162442592604288474822166186263722n
const RPC_URL        = process.env.BASE_RPC_URL || 'https://rpc.ankr.com/base'
const CHAIN_ID       = 8453

// First calendar-pinned Monday 04:59:00 UTC = June 29, 2026 04:59:00 UTC
// Unix: 1782709140
// Verify: new Date(1782709140 * 1000).toUTCString() === "Sun, 29 Jun 2026 04:59:00 GMT"
// EDT (UTC-4 summer): Sunday June 28, 2026 11:59 PM EDT
const FIRST_SETTLE_TARGET = 1782709140n

console.log(`  RPC: ${RPC_URL}`)
console.log(`  First settle target: ${FIRST_SETTLE_TARGET} (Mon Jun 29 2026 04:59:00 UTC / Sun Jun 28 2026 23:59 EDT)`)

// ── Retry helper ──────────────────────────────────────────────────────────────

async function withRetry(fn, label) {
  const MAX = 6
  for (let i = 0; i < MAX; i++) {
    try {
      return await fn()
    } catch (e) {
      const is429 = e?.status === 429 || /429|rate.?limit|over_rate_limit/i.test(String(e))
      if (!is429 || i === MAX - 1) throw e
      const delay = 1000 * Math.pow(2, i)
      console.warn(`  429 on ${label} — retry ${i + 1}/${MAX - 1} in ${delay}ms`)
      await sleep(delay)
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Load bytecodes from Foundry artifacts ─────────────────────────────────────

function loadBytecode(artifactPath) {
  const art = JSON.parse(readFileSync(new URL(`../${artifactPath}`, import.meta.url), 'utf8'))
  if (!art.bytecode?.object) throw new Error(`No bytecode in ${artifactPath}`)
  return art.bytecode.object // already has 0x prefix
}

const V3D_BYTECODE     = loadBytecode('out/TTSVotingV3d.sol/TTSVotingV3d.json')
const KEEPER3_BYTECODE = loadBytecode('out/TTSKeeper3.sol/TTSKeeper3.json')

// ── ABIs ──────────────────────────────────────────────────────────────────────

const V3D_ABI = parseAbi([
  'constructor(address _ttsToken, address vrfCoordinator_, bytes32 _keyHash, uint256 _subscriptionId, address _stakingContract, address _charityWallet, address _houseWallet)',
  'function setNFTContract(address _nft) external',
  'function adminTransferOwnership(address to) external',
  'function houseWallet() view returns (address)',
  'function charityWallet() view returns (address)',
  'function nftContract() view returns (address)',
  'function owner() view returns (address)',
  'function admin() view returns (address)',
  'function currentRoundId() view returns (uint256)',
])

const KEEPER3_ABI = parseAbi([
  'constructor(address _votingContract, uint256 _nextSettleTarget)',
  'function votingContract() view returns (address)',
  'function owner() view returns (address)',
  'function s_nextSettleTarget() view returns (uint256)',
])

// ── Chain ─────────────────────────────────────────────────────────────────────

const BASE = {
  id: CHAIN_ID,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
}

// ── Main ──────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  const transport    = http(RPC_URL, { retryCount: 3, retryDelay: 1000 })
  const publicClient = createPublicClient({ chain: BASE, transport })

  // ── Pre-flight ─────────────────────────────────────────────────────────────
  console.log('\n══ PRE-FLIGHT ═══════════════════════════════════════════════')

  const rawKey = process.env.DEPLOYER_PRIVATE_KEY
  if (!rawKey) { console.error('DEPLOYER_PRIVATE_KEY not set'); process.exit(1) }
  const key     = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`
  const account = privateKeyToAccount(key)

  if (account.address.toLowerCase() !== BANK_ADDR.toLowerCase()) {
    console.error(`ABORT: key maps to ${account.address}, expected Bank ${BANK_ADDR}`)
    process.exit(1)
  }
  console.log(`  Signer confirmed: ${account.address}`)

  const balance = await withRetry(() => publicClient.getBalance({ address: account.address }), 'balance')
  const ethBalance = Number(balance) / 1e18
  console.log(`  Bank ETH balance: ${ethBalance.toFixed(6)} ETH`)
  if (ethBalance < 0.015) {
    console.error(`  ABORT: Bank ETH balance ${ethBalance.toFixed(6)} is below 0.015 ETH minimum — top up before deploying`)
    process.exit(1)
  }

  const walletClient = createWalletClient({ account, chain: BASE, transport })

  if (DRY_RUN) {
    console.log('\n  DRY-RUN mode — no transactions will be sent')
    console.log('\n  Would deploy:')
    console.log(`  1. TTSVotingV3d(token=${TTS_TOKEN}, vrf=${VRF_COORD}, keyHash=${KEY_HASH.slice(0,10)}..., subId=${SUB_ID}, staking=${STAKING_ADDR}, charity=${CHARITY_ADDR}, house=${MARKETING_ADDR})`)
    console.log(`  2. TTSKeeper3(V3d_addr, ${FIRST_SETTLE_TARGET})`)
    console.log(`  3. V3d.setNFTContract(${NFT_ADDR})`)
    console.log(`  4. V3d.adminTransferOwnership(Keeper3_addr)`)
    console.log('\n  FIRST_SETTLE_TARGET:', FIRST_SETTLE_TARGET.toString(), '= Mon Jun 29 2026 04:59:00 UTC')
    process.exit(0)
  }

  // ── Step 1: Deploy TTSVotingV3d ────────────────────────────────────────────
  console.log('\n══ STEP 1: Deploy TTSVotingV3d ══════════════════════════════')

  const deployV3dHash = await withRetry(() => walletClient.deployContract({
    abi: V3D_ABI,
    bytecode: V3D_BYTECODE,
    args: [TTS_TOKEN, VRF_COORD, KEY_HASH, SUB_ID, STAKING_ADDR, CHARITY_ADDR, MARKETING_ADDR],
    gas: 4_000_000n,
  }), 'deploy V3d')
  console.log(`  Deploy TX: ${deployV3dHash}`)
  const receiptV3d = await publicClient.waitForTransactionReceipt({ hash: deployV3dHash })
  const V3D_ADDR = receiptV3d.contractAddress
  if (!V3D_ADDR) { console.error('  FAIL: no contract address in V3d receipt'); process.exit(1) }
  console.log(`  TTSVotingV3d deployed: ${V3D_ADDR}`)

  await sleep(500)

  // ── Guard: verify houseWallet == Marketing ─────────────────────────────────
  const house = await withRetry(() => publicClient.readContract({
    address: V3D_ADDR, abi: V3D_ABI, functionName: 'houseWallet',
  }), 'houseWallet')
  await sleep(250)
  const charity = await withRetry(() => publicClient.readContract({
    address: V3D_ADDR, abi: V3D_ABI, functionName: 'charityWallet',
  }), 'charityWallet')

  console.log(`  houseWallet:   ${house}`)
  console.log(`  charityWallet: ${charity}`)

  if (house.toLowerCase() !== MARKETING_ADDR.toLowerCase()) {
    console.error(`\n  🚨 HALT: houseWallet = ${house}`)
    console.error(`         Expected Marketing wallet: ${MARKETING_ADDR}`)
    console.error(`         DO NOT proceed. Check constructor args and redeploy.`)
    process.exit(1)
  }
  if (charity.toLowerCase() !== CHARITY_ADDR.toLowerCase()) {
    console.error(`\n  🚨 HALT: charityWallet = ${charity}, expected ${CHARITY_ADDR}`)
    process.exit(1)
  }
  console.log(`  ✓ houseWallet == Marketing wallet ✅`)
  console.log(`  ✓ charityWallet == Polaris ✅`)
  await sleep(250)

  // ── Step 2: setNFTContract ────────────────────────────────────────────────
  console.log('\n══ STEP 2: V3d.setNFTContract ═══════════════════════════════')
  const txNFT = await withRetry(() => walletClient.writeContract({
    address: V3D_ADDR, abi: V3D_ABI, functionName: 'setNFTContract', args: [NFT_ADDR],
  }), 'setNFTContract')
  console.log(`  TX: ${txNFT}`)
  await publicClient.waitForTransactionReceipt({ hash: txNFT })
  await sleep(500)
  const nftSet = await withRetry(() => publicClient.readContract({
    address: V3D_ADDR, abi: V3D_ABI, functionName: 'nftContract',
  }), 'nftContract readback')
  if (nftSet.toLowerCase() !== NFT_ADDR.toLowerCase()) {
    console.error(`  FAIL: nftContract reads ${nftSet}`); process.exit(1)
  }
  console.log(`  ✓ nftContract: ${nftSet}`)
  await sleep(250)

  // ── Step 3: Deploy TTSKeeper3 ─────────────────────────────────────────────
  console.log('\n══ STEP 3: Deploy TTSKeeper3 ════════════════════════════════')
  const deployK3Hash = await withRetry(() => walletClient.deployContract({
    abi: KEEPER3_ABI,
    bytecode: KEEPER3_BYTECODE,
    args: [V3D_ADDR, FIRST_SETTLE_TARGET],
    gas: 1_000_000n,
  }), 'deploy Keeper3')
  console.log(`  Deploy TX: ${deployK3Hash}`)
  const receiptK3 = await publicClient.waitForTransactionReceipt({ hash: deployK3Hash })
  const KEEPER3_ADDR = receiptK3.contractAddress
  if (!KEEPER3_ADDR) { console.error('  FAIL: no contract address in Keeper3 receipt'); process.exit(1) }
  console.log(`  TTSKeeper3 deployed: ${KEEPER3_ADDR}`)

  await sleep(500)
  const vc = await withRetry(() => publicClient.readContract({
    address: KEEPER3_ADDR, abi: KEEPER3_ABI, functionName: 'votingContract',
  }), 'Keeper3.votingContract')
  await sleep(250)
  const settleTarget = await withRetry(() => publicClient.readContract({
    address: KEEPER3_ADDR, abi: KEEPER3_ABI, functionName: 's_nextSettleTarget',
  }), 'Keeper3.s_nextSettleTarget')

  if (vc.toLowerCase() !== V3D_ADDR.toLowerCase()) {
    console.error(`  FAIL: Keeper3.votingContract = ${vc}`); process.exit(1)
  }
  if (settleTarget !== FIRST_SETTLE_TARGET) {
    console.error(`  FAIL: Keeper3.s_nextSettleTarget = ${settleTarget}, expected ${FIRST_SETTLE_TARGET}`); process.exit(1)
  }
  console.log(`  ✓ votingContract: ${vc}`)
  console.log(`  ✓ s_nextSettleTarget: ${settleTarget} (Mon Jun 29 2026 04:59:00 UTC)`)
  await sleep(250)

  // ── Step 4: adminTransferOwnership → Keeper3 ─────────────────────────────
  console.log('\n══ STEP 4: V3d.adminTransferOwnership ═══════════════════════')
  const txOwn = await withRetry(() => walletClient.writeContract({
    address: V3D_ADDR, abi: V3D_ABI, functionName: 'adminTransferOwnership', args: [KEEPER3_ADDR],
  }), 'adminTransferOwnership')
  console.log(`  TX: ${txOwn}`)
  await publicClient.waitForTransactionReceipt({ hash: txOwn })
  await sleep(500)

  const ownerAfter = await withRetry(() => publicClient.readContract({
    address: V3D_ADDR, abi: V3D_ABI, functionName: 'owner',
  }), 'owner readback')
  await sleep(250)
  const adminAfter = await withRetry(() => publicClient.readContract({
    address: V3D_ADDR, abi: V3D_ABI, functionName: 'admin',
  }), 'admin readback')

  if (ownerAfter.toLowerCase() !== KEEPER3_ADDR.toLowerCase()) {
    console.error(`  FAIL: V3d.owner() = ${ownerAfter}`); process.exit(1)
  }
  if (adminAfter.toLowerCase() !== BANK_ADDR.toLowerCase()) {
    console.error(`  FAIL: V3d.admin() = ${adminAfter}, expected Bank`); process.exit(1)
  }
  console.log(`  ✓ V3d.owner() = ${ownerAfter}  (Keeper3)`)
  console.log(`  ✓ V3d.admin() = ${adminAfter}  (Bank)`)

  // ── Final state table ─────────────────────────────────────────────────────
  console.log('\n══ FINAL STATE ══════════════════════════════════════════════')
  console.log(`  TTSVotingV3d:         ${V3D_ADDR}`)
  console.log(`  TTSKeeper3:           ${KEEPER3_ADDR}`)
  console.log(`  V3d.owner():          ${ownerAfter}  (Keeper3 ✅)`)
  console.log(`  V3d.admin():          ${adminAfter}  (Bank ✅)`)
  console.log(`  V3d.houseWallet():    ${house}  (Marketing ✅)`)
  console.log(`  V3d.charityWallet():  ${charity}  (Polaris ✅)`)
  console.log(`  V3d.nftContract():    ${nftSet}  (TTSRoundNFT ✅)`)
  console.log(`  Keeper3.s_nextSettleTarget: ${settleTarget}  (Mon Jun 29 2026 04:59 UTC ✅)`)
  console.log(`\n  Deploy TX hashes:`)
  console.log(`    V3d deploy:              ${deployV3dHash}`)
  console.log(`    setNFTContract:          ${txNFT}`)
  console.log(`    Keeper3 deploy:          ${deployK3Hash}`)
  console.log(`    adminTransferOwnership:  ${txOwn}`)

  console.log(`\n══ NEXT STEPS (NOT done by this script) ════════════════════`)
  console.log(`  1. Add ${V3D_ADDR} as VRF consumer at vrf.chain.link/base → Sub ID ${SUB_ID}`)
  console.log(`  2. Register Chainlink Custom Logic upkeep at automation.chain.link:`)
  console.log(`       Target: ${KEEPER3_ADDR}`)
  console.log(`       Balance: 10 LINK minimum`)
  console.log(`       Gas limit: 500000`)
  console.log(`  3. After registration, copy forwarder address from Chainlink UI`)
  console.log(`  4. Keeper3.setForwarder(<forwarder_address>)  — Bank wallet`)
  console.log(`  5. Gnosis Safe: setTaxExempt(${V3D_ADDR}, true)  — Required before any votes settle`)
  console.log(`  6. Update VOTING_ADDRESS in frontend (App.jsx, TTAdminDashboard.jsx, api/approve-profile.js)`)
  console.log(`  7. Update CLAUDE.md with deployed addresses`)
  console.log(`\n  ✅ Deploy complete. Keeper3 will start Round 1 automatically on first upkeep fire.`)
}

main().catch(e => { console.error(e); process.exit(1) })
