#!/usr/bin/env node
/**
 * finish_v3d_wiring.mjs — Resume deploy after Step 2 false-alarm halt.
 *
 * Performs ONLY Steps 3-4 of the V3d deploy sequence:
 *   Step 3: Deploy TTSKeeper3(V3d_addr, 1782709140)
 *   Step 4: V3d.adminTransferOwnership(Keeper3_addr)
 *
 * V3d 0x783b8cd80b586b723188c93ef94ee1beede617b4 is already deployed and
 * configured (nftContract set). This script does NOT touch it further except
 * to call adminTransferOwnership at the end.
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x<bank_key> node outputs/finish_v3d_wiring.mjs
 *   BASE_RPC_URL=https://... DEPLOYER_PRIVATE_KEY=0x<key> node outputs/finish_v3d_wiring.mjs
 *
 * Requires: node >=18, project node_modules present.
 */

import { createPublicClient, createWalletClient, http, parseAbi } from '../node_modules/viem/_esm/index.js'
import { privateKeyToAccount } from '../node_modules/viem/_esm/accounts/index.js'

// ── Addresses ─────────────────────────────────────────────────────────────────

const BANK_ADDR       = '0xb1e991bf617459b58964eef7756b350e675c53b5'
const V3D_ADDR        = '0x783b8cd80b586b723188c93ef94ee1beede617b4'
const NFT_EXPECTED    = '0x0768e862D3AB14d85213BfeF8f1D012E77721da2'
const MARKETING_ADDR  = '0x7a9ff2f584248744cBbA32c737D660ED6f077fCB'
const CHARITY_ADDR    = '0xf7dd429d679cb61231e73785fd1737e60138aba3'
const FIRST_SETTLE    = 1782709140n   // Mon Jun 29 2026 04:59:00 UTC

const RPC_URL = process.env.BASE_RPC_URL
if (!RPC_URL) { console.error('BASE_RPC_URL not set'); process.exit(1) }

// ── Keeper3 bytecode (inlined — solc 0.8.20, optimizer 200, evmVersion paris, viaIR=false) ──
const KEEPER3_BYTECODE = '0x608060405234801561001057600080fd5b50604051610f08380380610f0883398101604081905261002f9161017e565b338061005657604051631e4fbdf760e01b8152600060048201526024015b60405180910390fd5b61005f8161012e565b506001600160a01b0382166100b65760405162461bcd60e51b815260206004820152601460248201527f5a65726f20766f74696e6720636f6e7472616374000000000000000000000000604482015260640161004d565b4281116101055760405162461bcd60e51b815260206004820152601860248201527f546172676574206d75737420626520696e206675747572650000000000000000604482015260640161004d565b600180546001600160a01b0319166001600160a01b0393909316929092179091556003556101b8565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b6000806040838503121561019157600080fd5b82516001600160a01b03811681146101a857600080fd5b6020939093015192949293505050565b610d41806101c76000396000f3fe608060405234801561001057600080fd5b506004361061010b5760003560e01c80638da5cb5b116100a2578063cb9cb28b11610071578063cb9cb28b14610202578063d9e2269f1461020a578063ee0b21f61461021d578063f2fde38b14610225578063f4359ce51461023857600080fd5b80638da5cb5b146101b8578063a069c1ac146101c9578063b9998a24146101dc578063c1fc006a146101ef57600080fd5b80634585e33b116100de5780634585e33b146101675780635740f5801461017c5780636e04ff0d1461018f578063715018a6146101b057600080fd5b80630ddfacd114610110578063187d68ac1461012c5780632c11ce96146101345780634522fb4c1461015f575b600080fd5b61011960035481565b6040519081526020015b60405180910390f35b610119600381565b600254610147906001600160a01b031681565b6040516001600160a01b039091168152602001610123565b610119600481565b61017a610175366004610b25565b610242565b005b61017a61018a366004610b97565b610315565b6101a261019d366004610b25565b61038f565b604051610123929190610bb0565b61017a610586565b6000546001600160a01b0316610147565b61017a6101d7366004610c08565b6105bf565b61017a6101ea366004610c08565b61068d565b600154610147906001600160a01b031681565b610119610716565b61017a610218366004610b97565b610826565b610119600181565b61017a610233366004610c08565b6108c9565b61011962093a8081565b6002546001600160a01b031633148061026557506000546001600160a01b031633145b6102b65760405162461bcd60e51b815260206004820152601960248201527f5454534b6565706572333a206e6f7420666f727761726465720000000000000060448201526064015b60405180910390fd5b60006102c482840184610b97565b905060006102d18261092c565b9050817fb2b1b888adfae15a62933587f75376cfee899546a0e67a5bf5b727b847c943d582604051610307911515815260200190565b60405180910390a250505050565b6000546001600160a01b031633146103425760405163118cdaa760e01b81523360048201526024016102ad565b600061034d8261092c565b9050817f3c6b7445b19e1af1a96c9665b79aeaa306af9f78f7aadaf6e2dd18ad65d7980382604051610383911515815260200190565b60405180910390a25050565b600060606000600160009054906101000a90046001600160a01b03166001600160a01b0316639cbe5efd6040518163ffffffff1660e01b8152600401602060405180830381865afa925050508015610404575060408051601f3d908101601f1916820190925261040191810190610c38565b60015b61042157505060408051602081019091526000808252915061057f565b9050806000036104595760018060405160200161044091815260200190565b604051602081830303815290604052925092505061057f565b60015460405163023c4c9f60e61b8152600481018390526001600160a01b0390911690638f1327c09060240160e060405180830381865afa9250505080156104be575060408051601f3d908101601f191682019092526104bb91810190610c66565b60015b6104db57505060408051602081019091526000808252915061057f565b8215610516576001806040516020016104f691815260200190565b60405160208183030381529060405299509950505050505050505061057f565b600087118015610524575081155b80156105305750854210155b1561056357801561054f576040805160036020820152600191016104f6565b6040805160046020820152600191016104f6565b5050505050505050506040805160208101909152600080825291505b9250929050565b6000546001600160a01b031633146105b35760405163118cdaa760e01b81523360048201526024016102ad565b6105bd6000610ad5565b565b6000546001600160a01b031633146105ec5760405163118cdaa760e01b81523360048201526024016102ad565b6001600160a01b0381166106315760405162461bcd60e51b815260206004820152600c60248201526b5a65726f206164647265737360a01b60448201526064016102ad565b6001546040516001600160a01b038084169216907f2fcb4b1df6e56bc5f5d52c1b8162c0df129e9ea9c7fb417399e353b4729e133f90600090a3600180546001600160a01b0319166001600160a01b0392909216919091179055565b6000546001600160a01b031633146106ba5760405163118cdaa760e01b81523360048201526024016102ad565b6002546040516001600160a01b038084169216907f94aed472e01353526c04ec91cee149d41e78d848ec851c72be532bf7b120bd3090600090a3600280546001600160a01b0319166001600160a01b0392909216919091179055565b60015460408051639cbe5efd60e01b815290516000926001600160a01b031691639cbe5efd9160048083019260209291908290030181865afa92505050801561077c575060408051601f3d908101601f1916820190925261077991810190610c38565b60015b15610820578060000361079157600091505090565b60015460405163023c4c9f60e61b8152600481018390526001600160a01b0390911690638f1327c09060240160e060405180830381865afa9250505080156107f6575060408051601f3d908101601f191682019092526107f391810190610c66565b60015b1561081e5782806108045750815b61080e5785610811565b60005b9850505050505050505090565b505b50600090565b6000546001600160a01b031633146108535760405163118cdaa760e01b81523360048201526024016102ad565b4281116108965760405162461bcd60e51b81526020600482015260116024820152704d75737420626520696e2066757475726560781b60448201526064016102ad565b600381905560405181907f70f6c10f13e0eddf5c946a09991073cd74dd09b6979fa0d2961a343629f8196590600090a250565b6000546001600160a01b031633146108f65760405163118cdaa760e01b81523360048201526024016102ad565b6001600160a01b03811661092057604051631e4fbdf760e01b8152600060048201526024016102ad565b61092981610ad5565b50565b6000600182036109f8575b42600354116109605762093a80600360008282546109559190610cdf565b909155506109379050565b6000426003546109709190610cf8565b600154604051635fc3d52d60e01b8152600481018390529192506001600160a01b031690635fc3d52d90602401600060405180830381600087803b1580156109b757600080fd5b505af19250505080156109c8575060015b6109d55750600092915050565b62093a80600360008282546109ea9190610cdf565b909155506001949350505050565b60038203610a7557600160009054906101000a90046001600160a01b03166001600160a01b0316636ffbfaa86040518163ffffffff1660e01b8152600401600060405180830381600087803b158015610a5057600080fd5b505af1925050508015610a61575060015b610a6d57506000919050565b506001919050565b60048203610acd57600160009054906101000a90046001600160a01b03166001600160a01b03166310947a336040518163ffffffff1660e01b8152600401600060405180830381600087803b158015610a5057600080fd5b506000919050565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b60008060208385031215610b3857600080fd5b823567ffffffffffffffff80821115610b5057600080fd5b818501915085601f830112610b6457600080fd5b813581811115610b7357600080fd5b866020828501011115610b8557600080fd5b60209290920196919550909350505050565b600060208284031215610ba957600080fd5b5035919050565b821515815260006020604081840152835180604085015260005b81811015610be657858101830151858201606001528201610bca565b506000606082860101526060601f19601f830116850101925050509392505050565b600060208284031215610c1a57600080fd5b81356001600160a01b0381168114610c3157600080fd5b9392505050565b600060208284031215610c4a57600080fd5b5051919050565b80518015158114610c6157600080fd5b919050565b600080600080600080600060e0888a031215610c8157600080fd5b87519650602088015195506040880151945060608801519350610ca660808901610c51565b9250610cb460a08901610c51565b915060c0880151905092959891949750929550565b634e487b7160e01b600052601160045260246000fd5b80820180821115610cf257610cf2610cc9565b92915050565b81810381811115610cf257610cf2610cc956fea26469706673582212206ff509fd163880a36c40c693e17e35324936fa2dc9a1b481c1f9e82fe6cb253a64736f6c63430008140033'

// ── ABIs ──────────────────────────────────────────────────────────────────────

const V3D_ABI = parseAbi([
  'function nftContract() view returns (address)',
  'function owner() view returns (address)',
  'function admin() view returns (address)',
  'function houseWallet() view returns (address)',
  'function charityWallet() view returns (address)',
  'function adminTransferOwnership(address to) external',
])

const KEEPER3_ABI = parseAbi([
  'constructor(address _votingContract, uint256 _nextSettleTarget)',
  'function votingContract() view returns (address)',
  'function owner() view returns (address)',
  'function s_nextSettleTarget() view returns (uint256)',
])

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function withRetry(fn, label) {
  const MAX = 6
  for (let i = 0; i < MAX; i++) {
    try { return await fn() } catch (e) {
      const is429 = e?.status === 429 || /429|rate.?limit|over_rate_limit/i.test(String(e))
      if (!is429 || i === MAX - 1) throw e
      const delay = 1000 * Math.pow(2, i)
      console.warn(`  429 on ${label} — retry ${i + 1}/${MAX - 1} in ${delay}ms`)
      await sleep(delay)
    }
  }
}

function addr(a) { return a.toLowerCase() }
function eq(a, b) { return addr(a) === addr(b) }

// ── Chain ─────────────────────────────────────────────────────────────────────

const BASE = {
  id: 8453, name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const transport    = http(RPC_URL, { retryCount: 3, retryDelay: 1000 })
  const publicClient = createPublicClient({ chain: BASE, transport })

  // ── Pre-flight ─────────────────────────────────────────────────────────────
  console.log('\n══ PRE-FLIGHT ═══════════════════════════════════════════════')
  console.log(`  V3d:  ${V3D_ADDR}`)
  console.log(`  RPC:  ${RPC_URL}`)

  const rawKey = process.env.DEPLOYER_PRIVATE_KEY
  if (!rawKey) { console.error('DEPLOYER_PRIVATE_KEY not set'); process.exit(1) }
  const key     = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`
  const account = privateKeyToAccount(key)
  if (!eq(account.address, BANK_ADDR)) {
    console.error(`ABORT: key maps to ${account.address}, expected Bank ${BANK_ADDR}`)
    process.exit(1)
  }
  console.log(`  Signer: ${account.address} ✓`)

  // Read V3d pre-flight state
  const read = fn => withRetry(
    () => publicClient.readContract({ address: V3D_ADDR, abi: V3D_ABI, functionName: fn }),
    `V3d.${fn}`
  )

  const [nftNow, ownerNow] = await Promise.all([read('nftContract'), read('owner')])

  console.log(`  V3d.nftContract(): ${nftNow}`)
  console.log(`  V3d.owner():       ${ownerNow}`)

  if (!eq(nftNow, NFT_EXPECTED)) {
    console.error(`  ABORT: nftContract = ${nftNow}, expected ${NFT_EXPECTED}`)
    process.exit(1)
  }
  console.log(`  ✓ nftContract == TTSRoundNFT`)

  if (!eq(ownerNow, BANK_ADDR)) {
    // Owner is already a non-Bank address — Keeper3 wiring may have partially run
    console.error(`  ABORT: V3d.owner() = ${ownerNow}`)
    console.error(`         Expected Bank ${BANK_ADDR}`)
    console.error(`         Keeper3 ownership transfer may have already run — check on-chain state.`)
    process.exit(1)
  }
  console.log(`  ✓ owner == Bank — safe to proceed`)

  const walletClient = createWalletClient({ account, chain: BASE, transport })

  // ── Step 3: Deploy TTSKeeper3 ─────────────────────────────────────────────
  console.log('\n══ STEP 3: Deploy TTSKeeper3 ════════════════════════════════')
  console.log(`  votingContract:   ${V3D_ADDR}`)
  console.log(`  s_nextSettleTarget: ${FIRST_SETTLE} (Mon Jun 29 2026 04:59:00 UTC)`)

  const deployK3Hash = await withRetry(() => walletClient.deployContract({
    abi:      KEEPER3_ABI,
    bytecode: KEEPER3_BYTECODE,
    args:     [V3D_ADDR, FIRST_SETTLE],
    gas:      1_000_000n,
  }), 'deploy Keeper3')
  console.log(`  TX: ${deployK3Hash}`)

  const receiptK3 = await publicClient.waitForTransactionReceipt({ hash: deployK3Hash })
  const KEEPER3_ADDR = receiptK3.contractAddress
  if (!KEEPER3_ADDR) { console.error('  FAIL: no contract address in Keeper3 receipt'); process.exit(1) }
  console.log(`  Confirmed. Keeper3: ${KEEPER3_ADDR}`)

  // 2s pause to let the node sync before reading back
  console.log('  Waiting 2s for RPC sync...')
  await sleep(2000)

  const k3Read = fn => withRetry(
    () => publicClient.readContract({ address: KEEPER3_ADDR, abi: KEEPER3_ABI, functionName: fn }),
    `Keeper3.${fn}`
  )

  const [k3vc, k3target, k3owner] = await Promise.all([
    k3Read('votingContract'),
    k3Read('s_nextSettleTarget'),
    k3Read('owner'),
  ])

  console.log(`  Keeper3.votingContract():    ${k3vc}`)
  console.log(`  Keeper3.s_nextSettleTarget: ${k3target}`)
  console.log(`  Keeper3.owner():            ${k3owner}`)

  if (!eq(k3vc, V3D_ADDR)) {
    console.error(`  FAIL: votingContract = ${k3vc}`); process.exit(1)
  }
  if (k3target !== FIRST_SETTLE) {
    console.error(`  FAIL: s_nextSettleTarget = ${k3target}, expected ${FIRST_SETTLE}`); process.exit(1)
  }
  if (!eq(k3owner, BANK_ADDR)) {
    console.error(`  FAIL: Keeper3.owner() = ${k3owner}`); process.exit(1)
  }
  console.log(`  ✓ votingContract ✓ s_nextSettleTarget ✓ owner — all correct`)

  // ── Step 4: V3d.adminTransferOwnership(Keeper3) ───────────────────────────
  console.log('\n══ STEP 4: V3d.adminTransferOwnership ═══════════════════════')
  console.log(`  Transferring V3d ownership to Keeper3 ${KEEPER3_ADDR}`)

  const txOwn = await withRetry(() => walletClient.writeContract({
    address:      V3D_ADDR,
    abi:          V3D_ABI,
    functionName: 'adminTransferOwnership',
    args:         [KEEPER3_ADDR],
  }), 'adminTransferOwnership')
  console.log(`  TX: ${txOwn}`)

  await publicClient.waitForTransactionReceipt({ hash: txOwn })
  console.log('  Confirmed.')

  // 2s pause before read-back
  console.log('  Waiting 2s for RPC sync...')
  await sleep(2000)

  const [ownerAfter, adminAfter, houseAfter, charityAfter] = await Promise.all([
    withRetry(() => publicClient.readContract({ address: V3D_ADDR, abi: V3D_ABI, functionName: 'owner' }),   'V3d.owner'),
    withRetry(() => publicClient.readContract({ address: V3D_ADDR, abi: V3D_ABI, functionName: 'admin' }),   'V3d.admin'),
    withRetry(() => publicClient.readContract({ address: V3D_ADDR, abi: V3D_ABI, functionName: 'houseWallet' }),   'V3d.houseWallet'),
    withRetry(() => publicClient.readContract({ address: V3D_ADDR, abi: V3D_ABI, functionName: 'charityWallet' }), 'V3d.charityWallet'),
  ])

  if (!eq(ownerAfter, KEEPER3_ADDR)) {
    console.error(`  FAIL: V3d.owner() = ${ownerAfter}, expected Keeper3 ${KEEPER3_ADDR}`)
    process.exit(1)
  }
  if (!eq(adminAfter, BANK_ADDR)) {
    console.error(`  FAIL: V3d.admin() = ${adminAfter}, expected Bank ${BANK_ADDR}`)
    process.exit(1)
  }
  console.log(`  ✓ V3d.owner()  = ${ownerAfter}  (Keeper3)`)
  console.log(`  ✓ V3d.admin()  = ${adminAfter}  (Bank)`)

  // ── Final state table ─────────────────────────────────────────────────────
  console.log(`
══ FINAL STATE ══════════════════════════════════════════════

  TTSVotingV3d:             ${V3D_ADDR}
  TTSKeeper3:               ${KEEPER3_ADDR}

  V3d.owner():              ${ownerAfter}  (Keeper3 ✅)
  V3d.admin():              ${adminAfter}  (Bank ✅)
  V3d.nftContract():        ${nftNow}  (TTSRoundNFT ✅)
  V3d.houseWallet():        ${houseAfter}  (${eq(houseAfter, MARKETING_ADDR) ? 'Marketing ✅' : '⚠️ unexpected'})
  V3d.charityWallet():      ${charityAfter}  (${eq(charityAfter, CHARITY_ADDR) ? 'Polaris ✅' : '⚠️ unexpected'})

  Keeper3.votingContract(): ${k3vc}  (V3d ✅)
  Keeper3.s_nextSettleTarget: ${k3target}  (Mon Jun 29 2026 04:59:00 UTC ✅)
  Keeper3.owner():          ${k3owner}  (Bank ✅)

  TX hashes:
    Keeper3 deploy:           ${deployK3Hash}
    adminTransferOwnership:   ${txOwn}

══ NEXT STEPS (NOT done by this script) ════════════════════

  1. Add ${V3D_ADDR} as VRF consumer at vrf.chain.link/base
       Sub ID: 58222014484560539249027457203866883376041731162442592604288474822166186263722
  2. Register Chainlink Custom Logic upkeep at automation.chain.link:
       Target: ${KEEPER3_ADDR}
       Balance: 10 LINK minimum · Gas limit: 500000
  3. Copy forwarder address from Chainlink UI after registration
  4. Keeper3.setForwarder(<forwarder>)  — Bank wallet
  5. Gnosis Safe: setTaxExempt(${V3D_ADDR}, true)  — required before settlement
  6. Cancel old Chainlink upkeep targeting Keeper2V2
  7. Update VOTING_ADDRESS in App.jsx, TTAdminDashboard.jsx, api/approve-profile.js

  ✅ Wiring complete. Keeper3 auto-starts Round 1 on first upkeep fire.
`)
}

main().catch(e => { console.error(e); process.exit(1) })
