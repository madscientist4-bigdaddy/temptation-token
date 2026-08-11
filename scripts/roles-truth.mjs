// Token role truth for TTS 0x5570eA97… — state, not history.
//
// An earlier version replayed RoleGranted/RoleRevoked logs. That cannot work on
// this RPC key: Alchemy's free tier caps eth_getLogs at a 10-block range, and
// the token has ~2.6M blocks of history — 260k requests. Rather than report a
// silently-truncated history as if it were complete, this queries hasRole()
// directly for every (role, address) pair. That is the authoritative answer and
// costs one cheap eth_call each.
//
// Trade-off worth knowing: this shows WHO holds what right now, but not how
// they got it. To audit grant/revoke history you need a paid RPC tier or an
// explorer API.
//
// Read-only. Prints exact calldata for removal; never sends a transaction.
//
//   BASE_RPC_URL=… node scripts/roles-truth.mjs

import { createPublicClient, http, parseAbiItem, keccak256, toHex, getAddress } from 'viem'
import { base } from 'viem/chains'

const RPC = process.env.BASE_RPC_URL
if (!RPC) { console.error('BASE_RPC_URL not set'); process.exit(1) }
const pc = createPublicClient({ chain: base, transport: http(RPC) })

const TTS = getAddress('0x5570ea97d53a53170e973894a9fa7feb5785d3b9')

const ZERO = '0x' + '0'.repeat(64)
const ROLES = {
  DEFAULT_ADMIN_ROLE: ZERO,
  UPGRADER_ROLE: keccak256(toHex('UPGRADER_ROLE')),
  PAUSER_ROLE: keccak256(toHex('PAUSER_ROLE')),
  MINTER_ROLE: keccak256(toHex('MINTER_ROLE')),
}

// Stored lowercase and normalised through getAddress so a mis-cased address
// pasted from docs can never reach the ABI encoder, which is checksum-strict.
const KNOWN = {
  '0xb1e991bf617459b58964eef7756b350e675c53b5': 'Bank / Deployer',
  '0xefb59d88179edc49bda60b43249722ea0de6fb86': 'Gnosis Safe (2/2)',
  '0xa4fbf397485763e39102dcfaefcbf9794df55875': 'Staking Timelock',
  '0x7a9ff2f584248744cbba32c737d660ed6f077fcb': 'Marketing / Bonus',
  '0xc3a3858a3777e4c9b542e60298c3161086c5faae': 'TTS Treasury',
  '0xe5c3b6480164c20253c21928c699ab7fdb8a60e5': 'Founder / Jim',
  '0x95607dcf6c815e6a7cb79eb6199174dfadc78758': 'Development / Dr. Mike',
  '0x783b8cd80b586b723188c93ef94ee1beede617b4': 'TTSVotingV3d',
  '0x363ce4960e3b459f5892587a37ae1ff2ed04442c': 'TTSKeeper3',
  '0x7848cceeb8613375d36ba3f50dd577b4e6bcfc0d': 'TTSStaking proxy',
}
// NOT .map(getAddress) — Array.map passes (element, index, array), and viem's
// getAddress takes an optional chainId as its second parameter. The index would
// be read as a chainId, silently switching to EIP-1191 checksumming for every
// entry after the first and producing addresses viem itself then rejects.
const ADDRS = Object.keys(KNOWN).map(a => getAddress(a))
const label = a => `${a}  (${KNOWN[a.toLowerCase()] ?? 'unknown'})`

const ABI = [parseAbiItem('function hasRole(bytes32 role, address account) view returns (bool)')]

console.log(`TTS ${TTS}`)
console.log(`checked at block ${await pc.getBlockNumber()}\n`)

console.log('role hashes:')
for (const [n, h] of Object.entries(ROLES)) console.log(`  ${n.padEnd(20)} ${h}`)

const live = {}
console.log('\n=== HOLDERS (hasRole at head — authoritative) ===')
for (const [name, hash] of Object.entries(ROLES)) {
  live[name] = []
  for (const acct of ADDRS) {
    try {
      if (await pc.readContract({ address: TTS, abi: ABI, functionName: 'hasRole', args: [hash, acct] })) {
        live[name].push(acct)
      }
    } catch (e) {
      console.log(`  !! ${name} / ${acct}: ${(e.shortMessage || e.message).slice(0, 70)}`)
    }
  }
  const shown = live[name].length ? live[name].map(label).join('\n' + ' '.repeat(22)) : '(nobody among known addresses)'
  console.log(`  ${name.padEnd(19)} ${shown}`)
}

console.log('\n  NOTE: only the addresses listed in KNOWN are checked. A role held by')
console.log('  an address not in that list would not appear. Enumerating all holders')
console.log('  needs either AccessControlEnumerable or full log history (paid RPC).')

// ── Removal options ───────────────────────────────────────────────────────
const BANK = getAddress('0xb1e991bf617459b58964eef7756b350e675c53b5')
const SAFE = getAddress('0xefb59d88179edc49bda60b43249722ea0de6fb86')

console.log('\n=== REMOVAL OPTIONS ===')
let anything = false
for (const role of ['UPGRADER_ROLE', 'PAUSER_ROLE', 'DEFAULT_ADMIN_ROLE']) {
  if (!live[role].includes(BANK)) {
    console.log(`  ${role.padEnd(19)} Bank does NOT hold it — nothing to do.`)
    continue
  }
  anything = true
  const others = live[role].filter(a => a !== BANK)
  console.log(`\n  ${role} — Bank HOLDS it.`)
  console.log(`    remaining holders after removal: ${others.length ? others.map(a => KNOWN[a.toLowerCase()]).join(', ') : 'NOBODY'}`)
  if (!others.length) {
    console.log('    ⚠️  DO NOT REMOVE YET — this would leave the role with zero holders.')
    console.log('        Grant it to the Safe first, then remove Bank.')
  }
  console.log(`    A) Bank renounces its own — one tx FROM Bank, no Safe signatures:`)
  console.log(`         to    ${TTS}`)
  console.log(`         call  renounceRole(${ROLES[role]}, ${BANK})`)
  console.log(`    B) Safe revokes it — 2/2 Safe tx, works even if the Bank key is lost:`)
  console.log(`         to    ${TTS}`)
  console.log(`         call  revokeRole(${ROLES[role]}, ${BANK})`)
}
if (!anything) console.log('\n  Bank holds none of UPGRADER / PAUSER / DEFAULT_ADMIN. Nothing to revoke.')

const admins = live.DEFAULT_ADMIN_ROLE
if (admins.length === 1 && admins[0] === SAFE) {
  console.log('\n  ✅ Safe is the sole DEFAULT_ADMIN — option B is available and any')
  console.log('     removal is recoverable (the Safe can re-grant).')
} else if (admins.includes(BANK)) {
  console.log('\n  ⚠️  Bank still holds DEFAULT_ADMIN_ROLE — it can re-grant itself any role,')
  console.log('     so removing UPGRADER/PAUSER from Bank is cosmetic until this goes.')
}

console.log('\n(read-only — no transaction was sent)')
