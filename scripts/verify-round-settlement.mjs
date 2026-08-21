// One-shot settlement audit, Telegram-reported.
//
// Answers the only question that matters after a round closes: did the game actually pay
// out, mint, and roll over — or did it silently stall? Written after Round 7 closed at
// 2026-08-17 04:59 UTC and was still unsettled 14.5 hours later with the Chainlink upkeep
// funded, active, and checkUpkeep() returning true.
//
// READ-ONLY. It never sends a chain transaction; recovering a stalled round needs a Bank
// wallet transaction, which requires Jim's explicit go-ahead.
//
//   node scripts/verify-round-settlement.mjs            # audit + Telegram
//   node scripts/verify-round-settlement.mjs --round 7  # pin a round
//   node scripts/verify-round-settlement.mjs --no-telegram
import { createPublicClient, http, parseAbi, parseAbiItem } from 'viem'
import { base } from 'viem/chains'

const RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
const V3D = '0x783b8cd80b586b723188c93ef94ee1beede617b4'
const TROPHY = '0x02DDd0e63DC2A5F66Fdb5a46F5981191959AC9A5'
const KEEPER = '0x363ce4960e3b459f5892587a37ae1ff2ed04442c'
const REGISTRY = '0xf4bAb6A129164aBa9B113cB96BA4266dF49f8743'
const UPKEEP_ID = 113446314522587151772280129999432062856069985411437977877707978564657748455208n

const argv = process.argv
const pinned = argv.indexOf('--round') > -1 ? BigInt(argv[argv.indexOf('--round') + 1]) : null
const noTelegram = argv.includes('--no-telegram')

const c = createPublicClient({ chain: base, transport: http(RPC) })

const V = parseAbi([
  'function currentRoundId() view returns (uint256)',
  'function getRound(uint256) view returns (uint256 startTime,uint256 endTime,uint256 totalTickets,uint256 totalRawVotes,bool settled,bool vrfPending,uint256 profileCount)',
])
const T = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'function tokenURI(uint256) view returns (string)',
])
const K = parseAbi([
  'function s_nextSettleTarget() view returns (uint256)',
  'function checkUpkeep(bytes) view returns (bool,bytes)',
])
const REG = [{
  name: 'getUpkeep', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'id', type: 'uint256' }],
  outputs: [{ type: 'tuple', components: [
    { name: 'target', type: 'address' }, { name: 'performGas', type: 'uint32' },
    { name: 'checkData', type: 'bytes' }, { name: 'balance', type: 'uint96' },
    { name: 'admin', type: 'address' }, { name: 'maxValidBlocknumber', type: 'uint64' },
    { name: 'lastPerformedBlockNumber', type: 'uint32' }, { name: 'amountSpent', type: 'uint96' },
    { name: 'paused', type: 'bool' }, { name: 'offchainConfig', type: 'bytes' },
  ] }],
}]

const iso = (s) => new Date(Number(s) * 1000).toISOString().replace('.000Z', 'Z')
const tts = (wei) => (Number(wei) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 })

const lines = []
const say = (s) => { lines.push(s); console.log(s) }
let healthy = true
const problem = (s) => { healthy = false; say(`❌ ${s}`) }
const good = (s) => say(`✅ ${s}`)

const current = await c.readContract({ address: V3D, abi: V, functionName: 'currentRoundId' })
const target = pinned ?? current
say(`Round audit · currentRoundId=${current} · auditing round ${target}`)

const r = await c.readContract({ address: V3D, abi: V, functionName: 'getRound', args: [target] })
const [, endTime, , rawVotes, settled, vrfPending, profileCount] = r
const overdueSec = Math.floor(Date.now() / 1000) - Number(endTime)

say(`ends ${iso(endTime)} · profiles ${profileCount} · votes ${tts(rawVotes)} $TTS`)

if (settled) {
  good(`round ${target} SETTLED`)
} else if (overdueSec <= 0) {
  say(`⏳ round ${target} still open (${Math.round(-overdueSec / 3600)}h remaining)`)
} else if (vrfPending) {
  problem(`round ${target} is ${Math.round(overdueSec / 3600)}h overdue with VRF PENDING — awaiting Chainlink VRF fulfilment`)
} else {
  problem(`round ${target} is ${Math.round(overdueSec / 3600)}h overdue and settlement was NEVER STARTED (vrfPending=false)`)
}

// Zero-vote rounds legitimately produce no winner, no payout and no mint.
const expectMint = rawVotes > 0n

const supply = await c.readContract({ address: TROPHY, abi: T, functionName: 'totalSupply' })
say(`Trophy totalSupply = ${supply}`)
if (settled && expectMint) {
  if (supply === 0n) problem('settled with votes but Trophy minted NOTHING — the try/catch mint path swallowed a failure')
  else {
    good(`${supply} trophy token(s) minted`)
    try {
      const owner = await c.readContract({ address: TROPHY, abi: T, functionName: 'ownerOf', args: [1n] })
      const uri = await c.readContract({ address: TROPHY, abi: T, functionName: 'tokenURI', args: [1n] })
      say(`token #1 owner ${owner}`)
      // tokenURI must actually resolve to something a wallet can render.
      if (uri.startsWith('data:application/json')) {
        good('token #1 tokenURI is inline JSON (renders with no server dependency)')
      } else if (/^https?:\/\//.test(uri)) {
        const res = await fetch(uri).catch(() => null)
        if (res && res.ok) good(`token #1 tokenURI resolves (${res.status})`)
        else problem(`token #1 tokenURI does NOT resolve (${res ? res.status : 'network error'}) — it will render blank in wallets`)
      } else problem(`token #1 tokenURI is not a usable URI: ${uri.slice(0, 60)}`)
    } catch (e) { problem(`token #1 unreadable: ${(e.shortMessage || e.message).slice(0, 90)}`) }
  }
} else if (settled && !expectMint) {
  good('zero-vote round — no winner, no payout, no mint (correct by design)')
}

// Rollover
if (settled && current <= target) problem(`round ${target} settled but currentRoundId is still ${current} — no rollover`)
if (current > target) {
  const nxt = await c.readContract({ address: V3D, abi: V, functionName: 'getRound', args: [current] })
  good(`round ${current} live · ends ${iso(nxt[1])}`)
  // Calendar pin: ends Monday 04:59 UTC.
  const d = new Date(Number(nxt[1]) * 1000)
  if (d.getUTCDay() !== 1 || d.getUTCHours() !== 4 || d.getUTCMinutes() !== 59) {
    problem(`round ${current} endTime ${iso(nxt[1])} is NOT the Monday 04:59 UTC calendar pin`)
  } else good('endTime matches the Monday 04:59 UTC calendar pin')
}

// Why automation did or did not act.
try {
  const [needed] = await c.readContract({ address: KEEPER, abi: K, functionName: 'checkUpkeep', args: ['0x'] })
  const nextTarget = await c.readContract({ address: KEEPER, abi: K, functionName: 's_nextSettleTarget' })
  const u = await c.readContract({ address: REGISTRY, abi: REG, functionName: 'getUpkeep', args: [UPKEEP_ID] })
  const block = await c.getBlockNumber()
  const behind = Number(block) - Number(u.lastPerformedBlockNumber)
  say(`keeper: checkUpkeep=${needed} · nextSettleTarget ${iso(nextTarget)}`)
  say(`upkeep: ${(Number(u.balance) / 1e18).toFixed(2)} LINK · paused=${u.paused} · last perform ${behind} blocks ago (~${(behind * 2 / 86400).toFixed(1)}d)`)
  if (needed && !u.paused) {
    problem('checkUpkeep says work is DUE and the upkeep is funded and unpaused, yet Chainlink is not performing it — automation side stall')
  }
  // Automation liveness is NOT the same question as "is work due right now". This audit
  // once reported "all good" while the Base registry had performed nothing for 18.6
  // days, because it only looked at the upkeep when a settle happened to be pending.
  // A round rolls over weekly, so a healthy upkeep can never be more than ~8 days idle.
  const STALE_DAYS = 8
  const idleDays = behind * 2 / 86400
  if (idleDays > STALE_DAYS) {
    problem(`Chainlink has not performed this upkeep in ${idleDays.toFixed(1)} days (>${STALE_DAYS}d). A weekly round cannot roll over without a perform — automation is DEAD and rounds are being closed by hand or not at all.`)
    // Registry-wide vs upkeep-specific changes the fix entirely: one is Chainlink's
    // outage, the other is ours. Ask the registry directly.
    try {
      const head = await c.getBlockNumber()
      // Alchemy's free tier caps eth_getLogs at 10 blocks; the public Base RPC allows
      // 10k. Use the public endpoint for this one wide query.
      const wide = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
      const logs = await wide.getLogs({
        address: REGISTRY,
        event: parseAbiItem('event UpkeepPerformed(uint256 indexed id, bool indexed success, uint96 totalPayment, uint256 gasUsed, uint256 gasOverhead, bytes trigger)'),
        fromBlock: head - 9000n, toBlock: head,
      })
      if (logs.length === 0) say('   ↳ registry-wide: NO upkeep performed for ANY consumer in the last ~5h — this is a Chainlink outage, not a TTS misconfiguration')
      else say(`   ↳ registry-wide: ${logs.length} performs in the last ~5h — the registry is alive and it is OUR upkeep that is being skipped`)
    } catch { say('   ↳ registry-wide liveness check unavailable (RPC log range limit)') }
  }
  // Whoever closed the last round, say so plainly: a manual close is not automation.
  if (current > 1n) {
    const cur = await c.readContract({ address: V3D, abi: V, functionName: 'getRound', args: [current] })
    const startedAt = Number(cur[0])
    const performedRecently = behind * 2 < (Math.floor(Date.now() / 1000) - startedAt) + 3600
    if (!performedRecently) say(`ℹ️  round ${current} started ${iso(startedAt)} but the upkeep has not performed since — that rollover was done by hand, not by Chainlink`)
  }
} catch (e) { say(`keeper/upkeep read failed: ${(e.shortMessage || e.message).slice(0, 90)}`) }

const header = healthy ? '✅ Round audit: all good' : '🚨 Round audit: ACTION NEEDED'
const body = `${header}\n\n${lines.join('\n')}`
console.log(`\n${header}`)

if (!noTelegram) {
  // Prefer a local token; fall back to the server-side alert endpoint, because the
  // Telegram token is marked Sensitive in Vercel and cannot be pulled to this machine.
  const token = process.env.BROADCAST_BOT_TOKEN || process.env.BOT2_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const chat = process.env.ADMIN_CHAT_ID || '-5273368658'
  let sent = false
  if (token) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: body.slice(0, 4000), disable_web_page_preview: true }),
    }).catch(() => null)
    sent = !!(res && res.ok)
  }
  if (!sent && process.env.ADMIN_SESSION_SECRET) {
    const res = await fetch('https://app.temptationtoken.io/api/social-post?action=admin-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ADMIN_SESSION_SECRET}` },
      body: JSON.stringify({ text: body.slice(0, 4000) }),
    }).catch(() => null)
    sent = !!(res && res.ok)
    console.log(`Telegram via server relay: ${sent ? 'sent' : `FAILED (${res ? res.status : 'network'})`}`)
  } else if (sent) {
    console.log('Telegram: sent')
  }
  if (!sent) {
    // A monitor that cannot reach anyone must not exit 0 — silence would read as health.
    console.error('ALERT NOT DELIVERED — no local bot token and no working relay.')
    process.exit(1)
  }
}

process.exit(healthy ? 0 : 1)
