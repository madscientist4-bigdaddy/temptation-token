#!/usr/bin/env node
/**
 * wire_v3c.mjs — One-shot wiring for TTSVotingV3c canonical deployment
 *
 * Performs three Bank-wallet transactions in sequence:
 *   1. V3c.setNFTContract(NFT_ADDR)        — onlyAdmin
 *   2. Deploy TTSKeeper2V2(V3C_ADDR)       — new contract
 *   3. V3c.transferOwnership(KEEPER_ADDR)  — onlyOwner
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x<key> node outputs/wire_v3c.mjs
 *
 * Dry-run (reads only, no tx):
 *   node outputs/wire_v3c.mjs --dry-run
 *
 * Requires: node >=18 (uses native fetch). No npm install needed — imports
 * are resolved from the project's existing node_modules.
 */

import { createPublicClient, createWalletClient, http, parseAbi, pad } from '../node_modules/viem/_esm/index.js'
import { privateKeyToAccount } from '../node_modules/viem/_esm/accounts/index.js'

// ── Addresses ────────────────────────────────────────────────────────────────

const V3C_ADDR  = '0x916984DBaBFDF9B1c95b7507386330Bb37626112'
const NFT_ADDR  = '0x0768e862D3AB14d85213BfeF8f1D012E77721da2'
const BANK_ADDR = '0xb1e991bf617459b58964eef7756b350e675c53b5'
const RPC_URL   = process.env.BASE_RPC_URL || 'https://rpc.ankr.com/base'
const CHAIN_ID  = 8453

console.log(`  RPC: ${RPC_URL}`)

// ── Retry helper: 6 attempts, exponential backoff from 1s, catches 429 ───────

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

// ── ABIs ─────────────────────────────────────────────────────────────────────

const V3C_ABI = parseAbi([
  'function setNFTContract(address _nft) external',
  'function transferOwnership(address newOwner) external',
  'function nftContract() view returns (address)',
  'function owner() view returns (address)',
  'function admin() view returns (address)',
  'function houseWallet() view returns (address)',
  'function charityWallet() view returns (address)',
  'function currentRoundId() view returns (uint256)',
])

const KEEPER_ABI = parseAbi([
  'function votingContract() view returns (address)',
  'function owner() view returns (address)',
  'constructor(address _votingContract)',
])

// ── TTSKeeper2V2 deploy bytecode (solc 0.8.20, optimizer 200, paris, no viaIR)
const KEEPER_BYTECODE = '0x608060405234801561001057600080fd5b50604051610d8b380380610d8b83398101604081905261002f9161012b565b338061005657604051631e4fbdf760e01b8152600060048201526024015b60405180910390fd5b61005f816100db565b506001600160a01b0381166100b65760405162461bcd60e51b815260206004820152601460248201527f5a65726f20766f74696e6720636f6e7472616374000000000000000000000000604482015260640161004d565b600180546001600160a01b0319166001600160a01b039290921691909117905561015b565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b60006020828403121561013d57600080fd5b81516001600160a01b038116811461015457600080fd5b9392505050565b610c218061016a6000396000f3fe608060405234801561001057600080fd5b50600436106101005760003560e01c8063715018a611610097578063c1fc006a11610066578063c1fc006a146101ed578063cb9cb28b14610200578063ee0b21f614610208578063f2fde38b1461021057600080fd5b8063715018a6146101ae5780638da5cb5b146101b6578063a069c1ac146101c7578063b9998a24146101da57600080fd5b80634585e33b116100d35780634585e33b1461015b5780635740f580146101705780636641ea08146101835780636e04ff0d1461018d57600080fd5b8063187d68ac146101055780632c11ce961461012057806334da7d011461014b5780634522fb4c14610153575b600080fd5b61010d600381565b6040519081526020015b60405180910390f35b600254610133906001600160a01b031681565b6040516001600160a01b039091168152602001610117565b61010d600281565b61010d600481565b61016e610169366004610a47565b610223565b005b61016e61017e366004610ab9565b6102f6565b61010d62093a4481565b6101a061019b366004610a47565b610370565b604051610117929190610ad2565b61016e61056d565b6000546001600160a01b0316610133565b61016e6101d5366004610b2a565b6105a6565b61016e6101e8366004610b2a565b610674565b600154610133906001600160a01b031681565b61010d6106fd565b61010d600181565b61016e61021e366004610b2a565b61080d565b6002546001600160a01b031633148061024657506000546001600160a01b031633145b6102975760405162461bcd60e51b815260206004820152601b60248201527f5454534b65657065723256323a206e6f7420666f72776172646572000000000060448201526064015b60405180910390fd5b60006102a582840184610ab9565b905060006102b282610870565b9050817fb2b1b888adfae15a62933587f75376cfee899546a0e67a5bf5b727b847c943d5826040516102e8911515815260200190565b60405180910390a250505050565b6000546001600160a01b031633146103235760405163118cdaa760e01b815233600482015260240161028e565b600061032e82610870565b9050817f3c6b7445b19e1af1a96c9665b79aeaa306af9f78f7aadaf6e2dd18ad65d7980382604051610364911515815260200190565b60405180910390a25050565b600060606000600160009054906101000a90046001600160a01b03166001600160a01b0316639cbe5efd6040518163ffffffff1660e01b8152600401602060405180830381865afa9250505080156103e5575060408051601f3d908101601f191682019092526103e291810190610b5a565b60015b610402575050604080516020810190915260008082529150610566565b90508060000361043a5760018060405160200161042191815260200190565b6040516020818303038152906040529250925050610566565b60015460405163023c4c9f60e61b8152600481018390526001600160a01b0390911690638f1327c09060240160e060405180830381865afa92505050801561049f575060408051601f3d908101601f1916820190925261049c91810190610b88565b60015b6104bc575050604080516020810190915260008082529150610566565b6000871180156104ca575082155b80156104d4575081155b80156104e05750854210155b1561052f57801561051b576040805160036020820152600191015b604051602081830303815290604052995099505050505050505050610566565b6040805160046020820152600191016104fb565b821561054a576001806040516020016104fb91815260200190565b5050505050505050506040805160208101909152600080825291505b9250929050565b6000546001600160a01b0316331461059a5760405163118cdaa760e01b815233600482015260240161028e565b6105a460006109f7565b565b6000546001600160a01b031633146105d35760405163118cdaa760e01b815233600482015260240161028e565b6001600160a01b0381166106185760405162461bcd60e51b815260206004820152600c60248201526b5a65726f206164647265737360a01b604482015260640161028e565b6001546040516001600160a01b038084169216907f2fcb4b1df6e56bc5f5d52c1b8162c0df129e9ea9c7fb417399e353b4729e133f90600090a3600180546001600160a01b0319166001600160a01b0392909216919091179055565b6000546001600160a01b031633146106a15760405163118cdaa760e01b815233600482015260240161028e565b6002546040516001600160a01b038084169216907f94aed472e01353526c04ec91cee149d41e78d848ec851c72be532bf7b120bd3090600090a3600280546001600160a01b0319166001600160a01b0392909216919091179055565b60015460408051639cbe5efd60e01b815290516000926001600160a01b031691639cbe5efd9160048083019260209291908290030181865afa925050508015610763575060408051601f3d908101601f1916820190925261076091810190610b5a565b60015b15610807578060000361077857600091505090565b60015460405163023c4c9f60e61b8152600481018390526001600160a01b0390911690638f1327c09060240160e060405180830381865afa9250505080156107dd575060408051601f3d908101601f191682019092526107da91810190610b88565b60015b156108055782806107eb5750815b6107f557856107f8565b60005b9850505050505050505090565b505b50600090565b6000546001600160a01b0316331461083a5760405163118cdaa760e01b815233600482015260240161028e565b6001600160a01b03811661086457604051631e4fbdf760e01b81526000600482015260240161028e565b61086d816109f7565b50565b6000600182036108e757600154604051635fc3d52d60e01b815262093a4460048201526001600160a01b0390911690635fc3d52d90602401600060405180830381600087803b1580156108c257600080fd5b505af19250505080156108d3575060015b6108df57506000919050565b506001919050565b6003820361093f57600160009054906101000a90046001600160a01b03166001600160a01b0316636ffbfaa86040518163ffffffff1660e01b8152600401600060405180830381600087803b1580156108c257600080fd5b6002820361099757600160009054906101000a90046001600160a01b03166001600160a01b0316632e52ce166040518163ffffffff1660e01b8152600401600060405180830381600087803b1580156108c257600080fd5b600482036109ef57600160009054906101000a90046001600160a01b03166001600160a01b03166310947a336040518163ffffffff1660e01b8152600401600060405180830381600087803b1580156108c257600080fd5b506000919050565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b60008060208385031215610a5a57600080fd5b823567ffffffffffffffff80821115610a7257600080fd5b818501915085601f830112610a8657600080fd5b813581811115610a9557600080fd5b866020828501011115610aa757600080fd5b60209290920196919550909350505050565b600060208284031215610acb57600080fd5b5035919050565b821515815260006020604081840152835180604085015260005b81811015610b0857858101830151858201606001528201610aec565b506000606082860101526060601f19601f830116850101925050509392505050565b600060208284031215610b3c57600080fd5b81356001600160a01b0381168114610b5357600080fd5b9392505050565b600060208284031215610b6c57600080fd5b5051919050565b80518015158114610b8357600080fd5b919050565b600080600080600080600060e0888a031215610ba357600080fd5b87519650602088015195506040880151945060608801519350610bc860808901610b73565b9250610bd660a08901610b73565b915060c088015190509295989194975092955056fea26469706673582212209cc080c4062f2d26b8c08a094e351400cfc0f46e3801b529c0d2787f0a34c67464736f6c63430008140033'

// ── Chain definition ─────────────────────────────────────────────────────────

const BASE = {
  id: CHAIN_ID,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
}

// ── Main ─────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  const transport = http(RPC_URL, { retryCount: 3, retryDelay: 1000 })
  const publicClient = createPublicClient({ chain: BASE, transport })

  // ── Pre-flight reads (sequential with 250ms gap to avoid 429) ───────────
  console.log('\n══ PRE-FLIGHT READS ════════════════════════════════════════')
  const read = (fn) => withRetry(() => publicClient.readContract({ address: V3C_ADDR, abi: V3C_ABI, functionName: fn }), fn)
  const nftBefore    = await read('nftContract');    await sleep(250)
  const ownerBefore  = await read('owner');          await sleep(250)
  const admin        = await read('admin');          await sleep(250)
  const houseWallet  = await read('houseWallet');    await sleep(250)
  const charityWallet= await read('charityWallet');  await sleep(250)
  const roundId      = await read('currentRoundId')
  console.log(`  V3c address:   ${V3C_ADDR}`)
  console.log(`  owner:         ${ownerBefore}`)
  console.log(`  admin:         ${admin}`)
  console.log(`  houseWallet:   ${houseWallet}`)
  console.log(`  charityWallet: ${charityWallet}`)
  console.log(`  nftContract:   ${nftBefore}`)
  console.log(`  currentRoundId: ${roundId}`)

  // Guard: these must match canonical spec
  const EXPECTED_HOUSE    = '0x7a9ff2f584248744cBbA32c737D660ED6f077fCB'.toLowerCase()
  const EXPECTED_CHARITY  = '0xf7dD429D679CB61231e73785fD1737E60138ABa3'.toLowerCase()
  if (houseWallet.toLowerCase() !== EXPECTED_HOUSE)    { console.error('ABORT: houseWallet mismatch'); process.exit(1) }
  if (charityWallet.toLowerCase() !== EXPECTED_CHARITY){ console.error('ABORT: charityWallet mismatch'); process.exit(1) }
  if (ownerBefore.toLowerCase() !== BANK_ADDR.toLowerCase() && nftBefore.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    console.error('ABORT: owner is not Bank wallet — ownership already transferred before NFT was set?'); process.exit(1)
  }
  console.log('\n  ✓ Pre-flight checks passed')

  if (DRY_RUN) {
    console.log('\n  DRY-RUN mode — no transactions sent')
    console.log('\n  Would execute:')
    console.log(`  1. setNFTContract(${NFT_ADDR})`)
    console.log(`  2. Deploy TTSKeeper2V2(${V3C_ADDR})`)
    console.log(`  3. transferOwnership(<keeper_address>)`)
    process.exit(0)
  }

  // ── Private key ───────────────────────────────────────────────────────────
  const rawKey = process.env.DEPLOYER_PRIVATE_KEY
  if (!rawKey) { console.error('DEPLOYER_PRIVATE_KEY not set in environment'); process.exit(1) }
  const key = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`
  const account = privateKeyToAccount(key)
  if (account.address.toLowerCase() !== BANK_ADDR.toLowerCase()) {
    console.error(`ABORT: key maps to ${account.address}, expected ${BANK_ADDR}`)
    process.exit(1)
  }
  console.log(`\n  Signer confirmed: ${account.address}`)

  const walletClient = createWalletClient({ account, chain: BASE, transport })

  // ── Step 1: setNFTContract ────────────────────────────────────────────────
  console.log('\n══ STEP 1: setNFTContract ══════════════════════════════════')
  if (nftBefore.toLowerCase() === NFT_ADDR.toLowerCase()) {
    console.log('  Already set — skipping')
  } else {
    const tx1 = await withRetry(() => walletClient.writeContract({
      address: V3C_ADDR, abi: V3C_ABI, functionName: 'setNFTContract', args: [NFT_ADDR],
    }), 'setNFTContract')
    console.log(`  TX: ${tx1}`)
    await publicClient.waitForTransactionReceipt({ hash: tx1 })
    await sleep(500)
    const nftAfter = await withRetry(() => publicClient.readContract({ address: V3C_ADDR, abi: V3C_ABI, functionName: 'nftContract' }), 'nftContract readback')
    if (nftAfter.toLowerCase() !== NFT_ADDR.toLowerCase()) {
      console.error(`  FAIL: nftContract reads ${nftAfter}`); process.exit(1)
    }
    console.log(`  ✓ nftContract verified: ${nftAfter}`)
  }

  // ── Step 2: Deploy TTSKeeper2V2 ───────────────────────────────────────────
  console.log('\n══ STEP 2: Deploy TTSKeeper2V2 ═════════════════════════════')
  // Encode constructor argument: _votingContract = V3C_ADDR (address, 32 bytes padded)
  const constructorArg = pad(V3C_ADDR.toLowerCase(), { size: 32 })
  const deployData = `${KEEPER_BYTECODE}${constructorArg.slice(2)}`

  const tx2 = await withRetry(() => walletClient.sendTransaction({ data: deployData, gas: 1_000_000n }), 'deploy Keeper2V2')
  console.log(`  Deploy TX: ${tx2}`)
  const receipt2 = await publicClient.waitForTransactionReceipt({ hash: tx2 })
  const KEEPER_ADDR = receipt2.contractAddress
  if (!KEEPER_ADDR) { console.error('  FAIL: no contract address in receipt'); process.exit(1) }
  console.log(`  TTSKeeper2V2 deployed: ${KEEPER_ADDR}`)

  await sleep(500)
  const vcAddr = await withRetry(() => publicClient.readContract({
    address: KEEPER_ADDR, abi: KEEPER_ABI, functionName: 'votingContract'
  }), 'votingContract readback')
  await sleep(250)
  const keeperOwner = await withRetry(() => publicClient.readContract({
    address: KEEPER_ADDR, abi: KEEPER_ABI, functionName: 'owner'
  }), 'keeper owner readback')
  if (vcAddr.toLowerCase() !== V3C_ADDR.toLowerCase()) {
    console.error(`  FAIL: votingContract reads ${vcAddr}`); process.exit(1)
  }
  console.log(`  ✓ votingContract verified: ${vcAddr}`)
  console.log(`  ✓ owner: ${keeperOwner}`)

  // ── Step 3: transferOwnership ─────────────────────────────────────────────
  console.log('\n══ STEP 3: V3c.transferOwnership ═══════════════════════════')
  await sleep(250)
  const currentOwner = await withRetry(() => publicClient.readContract({ address: V3C_ADDR, abi: V3C_ABI, functionName: 'owner' }), 'owner pre-check')
  if (currentOwner.toLowerCase() === KEEPER_ADDR.toLowerCase()) {
    console.log('  Already transferred — skipping')
  } else {
    const tx3 = await withRetry(() => walletClient.writeContract({
      address: V3C_ADDR, abi: V3C_ABI, functionName: 'transferOwnership', args: [KEEPER_ADDR],
    }), 'transferOwnership')
    console.log(`  TX: ${tx3}`)
    await publicClient.waitForTransactionReceipt({ hash: tx3 })
    await sleep(500)
    const newOwner = await withRetry(() => publicClient.readContract({ address: V3C_ADDR, abi: V3C_ABI, functionName: 'owner' }), 'owner readback')
    if (newOwner.toLowerCase() !== KEEPER_ADDR.toLowerCase()) {
      console.error(`  FAIL: owner reads ${newOwner}`); process.exit(1)
    }
    console.log(`  ✓ V3c.owner() = ${newOwner}`)
  }
  await sleep(250)
  const adminAfter = await withRetry(() => publicClient.readContract({ address: V3C_ADDR, abi: V3C_ABI, functionName: 'admin' }), 'admin readback')
  console.log(`  ✓ V3c.admin() still = ${adminAfter} (Bank)`)

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log('\n══ FINAL STATE ══════════════════════════════════════════════')
  console.log(`  TTSVotingV3c:    ${V3C_ADDR}`)
  console.log(`  TTSKeeper2V2:    ${KEEPER_ADDR}`)
  await sleep(250)
  const nftFinal   = await withRetry(() => publicClient.readContract({ address: V3C_ADDR, abi: V3C_ABI, functionName: 'nftContract' }), 'nftContract final'); await sleep(250)
  const ownerFinal = await withRetry(() => publicClient.readContract({ address: V3C_ADDR, abi: V3C_ABI, functionName: 'owner' }), 'owner final');       await sleep(250)
  const adminFinal = await withRetry(() => publicClient.readContract({ address: V3C_ADDR, abi: V3C_ABI, functionName: 'admin' }), 'admin final')
  console.log(`  V3c.nftContract: ${nftFinal}`)
  console.log(`  V3c.owner():     ${ownerFinal}`)
  console.log(`  V3c.admin():     ${adminFinal}`)
  console.log('\n  ✅ All wiring complete')
  console.log('\n  NEXT STEPS (NOT done by this script):')
  console.log(`  4. Register Chainlink Custom Logic upkeep targeting ${KEEPER_ADDR}`)
  console.log(`  5. Keeper2V2.setForwarder(<forwarder from Chainlink UI>)`)
  console.log(`  6. Add ${V3C_ADDR} as VRF consumer at vrf.chain.link/base`)
  console.log(`  7. Gnosis Safe: setTaxExempt(${V3C_ADDR}, true)`)
  console.log(`  8. Update VOTING_ADDRESS in frontend to ${V3C_ADDR}`)
  console.log(`\n  Update CLAUDE.md KEEPER2V2_ADDRESS = ${KEEPER_ADDR}`)
}

main().catch(e => { console.error(e); process.exit(1) })
