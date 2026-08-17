import { createPublicClient, http, parseAbiItem, keccak256, toHex } from 'viem'
import { base } from 'viem/chains'
const pc = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL) })
const TTS = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
const DEPLOY = 43851235n
const head = await pc.getBlockNumber()
console.log(`scan range ${DEPLOY} → ${head}  (${head-DEPLOY} blocks)`)

const ROLES = {
  [ '0x' + '0'.repeat(64) ]: 'DEFAULT_ADMIN_ROLE',
  [ keccak256(toHex('PAUSER_ROLE')) ]: 'PAUSER_ROLE',
  [ keccak256(toHex('MINTER_ROLE')) ]: 'MINTER_ROLE',
  [ keccak256(toHex('UPGRADER_ROLE')) ]: 'UPGRADER_ROLE',
}
console.log('role hashes:'); for (const [h,n] of Object.entries(ROLES)) console.log(`  ${n.padEnd(20)} ${h}`)

const granted = parseAbiItem('event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)')
const revoked = parseAbiItem('event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)')

const events = []
let step = 400000n
for (let from = DEPLOY; from <= head; ) {
  const to = (from + step - 1n) > head ? head : from + step - 1n
  try {
    const logs = await pc.getLogs({ address: TTS, events: [granted, revoked], fromBlock: from, toBlock: to })
    events.push(...logs)
    process.stderr.write(`  ${from}-${to}: ${logs.length}\n`)
    from = to + 1n
  } catch (e) {
    if (step > 5000n) { step = step / 4n; continue }
    console.log(`  CHUNK FAIL ${from}-${to}: ${(e.shortMessage||e.message).slice(0,90)}`); from = to + 1n
  }
}
console.log(`\ntotal role events: ${events.length}\n`)
const state = {}
for (const ev of events.sort((a,b)=>Number(a.blockNumber-b.blockNumber))) {
  const role = ROLES[ev.args.role] || ev.args.role
  const acct = ev.args.account
  const on = ev.eventName === 'RoleGranted'
  state[role] ??= {}
  state[role][acct] = on
  console.log(`  blk ${ev.blockNumber}  ${ev.eventName.replace('Role','').padEnd(8)} ${role.padEnd(20)} ${acct}  by ${ev.args.sender}`)
}
console.log('\n=== DERIVED HOLDERS FROM EVENT HISTORY ===')
for (const [role, m] of Object.entries(state)) {
  const holders = Object.entries(m).filter(([,v])=>v).map(([a])=>a)
  console.log(`  ${role.padEnd(20)} ${holders.length ? holders.join(', ') : '(nobody)'}`)
}
