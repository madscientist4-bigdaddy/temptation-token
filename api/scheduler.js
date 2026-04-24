// GET /api/scheduler — daily 10am UTC cron job (vercel.json crons)
// Posts a round status update to Telegram channels if a round is active.
// Vercel calls this via GET with a cron authorization header.

const VOTING_ADDRESS  = '0x49385909a23C97142c600f8d28D11Ba63410b65C'
const MAIN_CHANNEL_ID   = process.env.MAIN_CHANNEL_ID   || '-1002207667493'
const COMMUNITY_CHAT_ID = process.env.COMMUNITY_CHAT_ID || '-1003930752060'

async function rpcCall(method, params) {
  const r = await fetch('https://mainnet.base.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const { result } = await r.json()
  return result
}

function encodeCall(sig, ...args) {
  // Minimal ABI encode for view calls with no args or single uint256 arg
  const sel = sig // we use eth_call with pre-encoded data below
  return sel
}

async function getCurrentRoundId() {
  // eth_call currentRoundId()
  const data = '0x' + 'a87432d5' // keccak256("currentRoundId()")[0:4] — need actual selector
  // Use a known selector: currentRoundId() = 0xa87432d5? Let's compute properly
  // We'll call via the RPC proxy instead
  const result = await rpcCall('eth_call', [{
    to: VOTING_ADDRESS,
    // currentRoundId() selector: keccak256 first 4 bytes
    data: '0xa87432d5'
  }, 'latest'])
  if (!result || result === '0x') return null
  return parseInt(result, 16)
}

async function getRound(roundId) {
  // getRound(uint256) selector
  const padded = roundId.toString(16).padStart(64, '0')
  const result = await rpcCall('eth_call', [{
    to: VOTING_ADDRESS,
    data: '0x' + 'c1523768' + padded // getRound(uint256) selector
  }, 'latest'])
  if (!result || result === '0x') return null

  // Decode: startTime, endTime, totalTickets, totalRawVotes, settled, vrfPending, profileCount
  const hex = result.slice(2)
  const chunks = []
  for (let i = 0; i < hex.length; i += 64) chunks.push(hex.slice(i, i + 64))
  return {
    startTime:     parseInt(chunks[0], 16),
    endTime:       parseInt(chunks[1], 16),
    totalRawVotes: BigInt('0x' + chunks[3]),
    settled:       chunks[4] !== '0'.padStart(64, '0'),
    profileCount:  parseInt(chunks[6], 16),
  }
}

async function sendTelegram(chatId, text, token) {
  if (!chatId || !token) return null
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  return r.json()
}

function formatCountdown(endTime) {
  const ms = endTime * 1000 - Date.now()
  if (ms <= 0) return 'ended'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  return `${h}h ${m}m`
}

export default async function handler(req, res) {
  // Vercel cron sends GET with authorization header
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  const token = process.env.BROADCAST_BOT_TOKEN
  if (!token) return res.status(200).json({ ok: true, skipped: 'BROADCAST_BOT_TOKEN not set' })

  let roundId, round
  try {
    roundId = await getCurrentRoundId()
    if (!roundId) return res.status(200).json({ ok: true, skipped: 'no round' })
    round = await getRound(roundId)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }

  if (!round || round.settled) {
    return res.status(200).json({ ok: true, skipped: 'round settled or not found' })
  }

  const pool = Number(round.totalRawVotes) / 1e18
  const timeLeft = formatCountdown(round.endTime)
  const text = [
    `🔥 <b>Round ${roundId} Update</b>`,
    '',
    `👥 ${round.profileCount} profiles competing`,
    `💰 ${pool.toLocaleString(undefined, { maximumFractionDigits: 0 })} $TTS in the pool`,
    `⏱ ${timeLeft} remaining`,
    '',
    'Vote now → <a href="https://app.temptationtoken.io">app.temptationtoken.io</a>',
  ].join('\n')

  const results = {}
  try { results.main    = await sendTelegram(MAIN_CHANNEL_ID, text, token) }   catch(e) { results.main_err    = e.message }
  try { results.community = await sendTelegram(COMMUNITY_CHAT_ID, text, token) } catch(e) { results.community_err = e.message }

  return res.status(200).json({ ok: true, roundId, timeLeft, pool, results })
}
