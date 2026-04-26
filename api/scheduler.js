// GET /api/scheduler — runs every hour via Vercel cron (vercel.json)
// Two jobs in one handler:
//   1. EVERY HOUR: fire approved scheduled_posts whose scheduled_at has passed
//   2. AT 10AM UTC daily: post round status update to Telegram

import crypto from 'crypto'

const SUPABASE_URL   = 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'
const VOTING_ADDRESS  = '0x49385909a23C97142c600f8d28D11Ba63410b65C'
const MAIN_CHANNEL_ID   = process.env.MAIN_CHANNEL_ID   || '-1002207667493'
const COMMUNITY_CHAT_ID = process.env.COMMUNITY_CHAT_ID || '-1003930752060'

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function sbGet(table, query = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
  return r.json()
}

async function sbPatch(table, query, body) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal'
    },
    body: JSON.stringify(body)
  })
}

// ── RPC / on-chain helpers ────────────────────────────────────────────────────

async function rpcCall(method, params) {
  const r = await fetch('https://mainnet.base.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const { result } = await r.json()
  return result
}

async function getCurrentRoundId() {
  const result = await rpcCall('eth_call', [{ to: VOTING_ADDRESS, data: '0x9cbe5efd' }, 'latest'])
  if (!result || result === '0x') return null
  return parseInt(result, 16)
}

async function getRound(roundId) {
  const padded = roundId.toString(16).padStart(64, '0')
  const result = await rpcCall('eth_call', [{ to: VOTING_ADDRESS, data: '0x8f1327c0' + padded }, 'latest'])
  if (!result || result === '0x') return null
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

function formatCountdown(endTime) {
  const ms = endTime * 1000 - Date.now()
  if (ms <= 0) return 'ended'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`
}

// ── Posting helpers ───────────────────────────────────────────────────────────

async function sendTelegram(chatId, text, token) {
  if (!chatId || !token) return null
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  return r.json()
}

function oauthSign(method, url, params, consumerKey, consumerSecret, tokenSecret, token) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: '1.0',
  }
  const allParams = { ...params, ...oauthParams }
  const paramStr = Object.keys(allParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`).join('&')
  const sigBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`
  const sigKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`
  const signature = crypto.createHmac('sha1', sigKey).update(sigBase).digest('base64')
  oauthParams.oauth_signature = signature
  return 'OAuth ' + Object.keys(oauthParams)
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')
}

async function postTweet(text) {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env
  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
    return { skipped: 'X credentials not set' }
  }
  const url = 'https://api.twitter.com/2/tweets'
  const auth = oauthSign('POST', url, {}, X_API_KEY, X_API_SECRET, X_ACCESS_SECRET, X_ACCESS_TOKEN)
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  })
  return r.json()
}

// ── Fire a single scheduled post ─────────────────────────────────────────────

async function firePost(post) {
  const broadcastToken = process.env.BROADCAST_BOT_TOKEN

  // For Instagram: just mark as ready (no auto-post)
  if (post.platform === 'instagram') {
    await sbPatch('scheduled_posts', `id=eq.${post.id}`, {
      status: 'posted',
      posted_at: new Date().toISOString(),
      error: null
    })
    return { platform: 'instagram', status: 'ready (manual post)' }
  }

  // Resolve content — instagram uses selected_caption, others use content directly
  const content = post.content

  const results = {}
  let anyError = null

  if (post.platform === 'x') {
    try { results.x = await postTweet(content) }
    catch (e) { results.x_error = e.message; anyError = e.message }
  }

  if (post.platform === 'telegram') {
    try { results.main    = await sendTelegram(MAIN_CHANNEL_ID, content, broadcastToken) }
    catch (e) { results.main_error = e.message; anyError = e.message }
    try { results.community = await sendTelegram(COMMUNITY_CHAT_ID, content, broadcastToken) }
    catch (e) { results.community_error = e.message; anyError = e.message }
  }

  await sbPatch('scheduled_posts', `id=eq.${post.id}`, {
    status: anyError ? 'failed' : 'posted',
    posted_at: anyError ? null : new Date().toISOString(),
    error: anyError || null
  })

  return { platform: post.platform, id: post.id, results }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  // Manual fire: POST /api/scheduler?action=fire&id=UUID
  if (req.method === 'POST' && req.query?.action === 'fire') {
    const id = req.query.id || req.body?.id
    if (!id) return res.status(400).json({ error: 'Missing post id' })
    const posts = await sbGet('scheduled_posts', `id=eq.${id}&select=*`)
    if (!Array.isArray(posts) || posts.length === 0) return res.status(404).json({ error: 'Post not found' })
    try {
      const result = await firePost(posts[0])
      return res.status(200).json({ ok: true, result })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  const nowISO   = new Date().toISOString()
  const nowHour  = new Date().getUTCHours()
  const results  = { fired: [], roundStatus: null }

  // ── JOB 1: Fire approved posts that are due ──────────────────────────────

  try {
    const duePosts = await sbGet(
      'scheduled_posts',
      `status=eq.approved&scheduled_at=lte.${nowISO}&select=*`
    )

    if (Array.isArray(duePosts) && duePosts.length > 0) {
      for (const post of duePosts) {
        try {
          const r = await firePost(post)
          results.fired.push(r)
        } catch (e) {
          await sbPatch('scheduled_posts', `id=eq.${post.id}`, {
            status: 'failed', error: e.message
          })
          results.fired.push({ id: post.id, error: e.message })
        }
      }
    }
  } catch (e) {
    results.fired_error = e.message
  }

  // ── JOB 2: Daily 10am round status update to Telegram ────────────────────

  if (nowHour === 10) {
    const broadcastToken = process.env.BROADCAST_BOT_TOKEN
    if (broadcastToken) {
      try {
        const roundId = await getCurrentRoundId()
        if (roundId) {
          const round = await getRound(roundId)
          if (round && !round.settled) {
            const pool     = Number(round.totalRawVotes) / 1e18
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
            try { await sendTelegram(MAIN_CHANNEL_ID, text, broadcastToken) }    catch (e) {}
            try { await sendTelegram(COMMUNITY_CHAT_ID, text, broadcastToken) }  catch (e) {}
            results.roundStatus = { roundId, pool, timeLeft }
          }
        }
      } catch (e) {
        results.roundStatus = { error: e.message }
      }
    }
  }

  return res.status(200).json({ ok: true, time: nowISO, ...results })
}
