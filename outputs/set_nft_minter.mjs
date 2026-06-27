// One-shot: point the TTSRoundNFT minter at TTSVotingV3d so V3d's auto-mint on
// settlement (winner / top voter / house archive) actually succeeds.
//
//   Bank (NFT owner) -> NFT.setMinter(V3d)
//
// Run:  node --env-file=.env outputs/set_nft_minter.mjs
// Env:  DEPLOYER_PRIVATE_KEY (Bank), BASE_RPC_URL
//
// Pre-flight (aborts unless ALL hold):
//   - signer address == Bank
//   - NFT.owner()  == Bank == signer  (setMinter is onlyOwner)
//   - NFT.minter() == old V3b         (so we don't run against an unexpected state)
// Post: verify NFT.minter() == V3d.

import { createWalletClient, createPublicClient, http, parseAbi, getAddress } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const NFT  = '0x0768e862D3AB14d85213BfeF8f1D012E77721da2'
const V3D  = '0x783b8cd80b586b723188c93ef94ee1beede617b4' // new minter
const V3B  = '0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6' // expected current minter (old)
const BANK = '0xb1e991bf617459b58964eef7756b350e675c53b5' // expected signer + owner

const eq = (a, b) => getAddress(a) === getAddress(b)
const die = (m) => { console.error('\n❌ ABORT:', m); process.exit(1) }

const RPC = process.env.BASE_RPC_URL
const PK  = process.env.DEPLOYER_PRIVATE_KEY
if (!RPC) die('BASE_RPC_URL not set')
if (!PK)  die('DEPLOYER_PRIVATE_KEY not set')

const abi = parseAbi([
  'function owner() view returns (address)',
  'function minter() view returns (address)',
  'function setMinter(address newMinter) external',
])

const pub = createPublicClient({ chain: base, transport: http(RPC) })
const account = privateKeyToAccount(PK.startsWith('0x') ? PK : `0x${PK}`)
const wallet = createWalletClient({ account, chain: base, transport: http(RPC) })

console.log('── PRE-FLIGHT ───────────────────────────────')
console.log('  NFT contract :', NFT)
console.log('  signer       :', account.address)

const [owner, minter] = await Promise.all([
  pub.readContract({ address: NFT, abi, functionName: 'owner' }),
  pub.readContract({ address: NFT, abi, functionName: 'minter' }),
])
console.log('  NFT.owner()  :', owner)
console.log('  NFT.minter() :', minter, '(current)')

if (!eq(account.address, BANK)) die(`signer ${account.address} is not Bank ${BANK}`)
if (!eq(owner, BANK))           die(`NFT.owner() ${owner} is not Bank ${BANK} — cannot setMinter`)
if (!eq(owner, account.address)) die('signer is not the NFT owner')
if (eq(minter, V3D))            die('minter is ALREADY V3d — nothing to do')
if (!eq(minter, V3B))           die(`current minter ${minter} is not the expected old V3b ${V3B} — refusing to proceed`)
console.log('  ✓ signer == Bank == owner; current minter == old V3b. Proceeding.\n')

console.log('── SEND setMinter(V3d) ──────────────────────')
const hash = await wallet.writeContract({ address: NFT, abi, functionName: 'setMinter', args: [V3D] })
console.log('  tx submitted:', hash)
const rcpt = await pub.waitForTransactionReceipt({ hash })
console.log('  status      :', rcpt.status, '| block', rcpt.blockNumber, '| gasUsed', rcpt.gasUsed.toString())
if (rcpt.status !== 'success') die('transaction REVERTED — minter NOT changed')

console.log('\n── VERIFY ───────────────────────────────────')
const after = await pub.readContract({ address: NFT, abi, functionName: 'minter' })
console.log('  NFT.minter() :', after, '(after)')
if (!eq(after, V3D)) die(`minter is ${after}, expected V3d ${V3D}`)
console.log('  ✓ minter() == V3d — V3d auto-mint on settlement is now authorized.')
console.log('\nTX:', hash)
