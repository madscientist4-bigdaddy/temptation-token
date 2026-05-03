// POST /api/social-post — posts to X (Twitter) and mirrors to Telegram channels
//
// Required env vars (set in Vercel + Railway):
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
//   BROADCAST_BOT_TOKEN   — @TTSBroadcastBot token
//   MAIN_CHANNEL_ID       — @temptationtoken channel ID (e.g. "@temptationtoken" or numeric)
//   COMMUNITY_CHAT_ID     — @TTSCommunityChat chat ID
//
// Call from any backend trigger (admin panel, on-chain event watcher, etc.)
// Body: { type: 'round_start'|'round_settled'|'profile_approved', data: { roundId, profileCount, pool, profileName } }

import crypto from 'crypto'

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
  const header = 'OAuth ' + Object.keys(oauthParams)
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')
  return header
}

async function postTweet(text, env) {
  const url = 'https://api.twitter.com/2/tweets'
  const authHeader = oauthSign(
    'POST', url, {},
    env.X_API_KEY, env.X_API_SECRET, env.X_ACCESS_SECRET, env.X_ACCESS_TOKEN
  )
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  })
  return r.json()
}

async function sendTelegram(chatId, text, token) {
  if (!chatId || !token) return null
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
  })
  return r.json()
}

const TEMPLATES = {
  round_start: ({ roundId, profileCount, pool }) =>
    `🔥 Round ${roundId} is LIVE on Temptation Token\n\n${profileCount} profiles competing for ${pool ? pool.toLocaleString() + ' $TTS' : '$TTS'}\n\nVote now → app.temptationtoken.io\n\n#TTS #Base #Crypto`,

  round_settled: ({ roundId }) =>
    `🏆 Round ${roundId} SETTLED\n\nWinner paid automatically on Base\nChainlink VRF — provably fair\n\nRound ${roundId + 1} starts Monday 🔥\n\napp.temptationtoken.io`,

  profile_approved: () =>
    `🔥 New profile just approved\n\nVote $TTS to back your favorite\nWinner takes 35% of the pool\n\nt.me/TTSGameBot`,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = req.body || {}

  // Direct content mode: { platform, content, chatId }
  if (body.platform === 'telegram' && body.content) {
    const broadcastToken = process.env.BROADCAST_BOT_TOKEN
    const chatId = body.chatId || process.env.MAIN_CHANNEL_ID || '-1002207667493'
    if (!broadcastToken) return res.status(200).json({ ok: false, error: 'BROADCAST_BOT_TOKEN not set' })
    try {
      const r = await sendTelegram(chatId, body.content, broadcastToken)
      return res.status(200).json({ ok: true, telegram: r })
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message })
    }
  }

  const { type, data = {} } = body
  if (!type || !TEMPLATES[type]) return res.status(400).json({ error: 'Unknown type' })

  const text = TEMPLATES[type](data)
  const results = {}

  const env = {
    X_API_KEY: process.env.X_API_KEY,
    X_API_SECRET: process.env.X_API_SECRET,
    X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN,
    X_ACCESS_SECRET: process.env.X_ACCESS_SECRET,
  }

  // Post to X
  if (env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_SECRET) {
    try {
      results.twitter = await postTweet(text, env)
    } catch(e) {
      results.twitter_error = e.message
    }
  } else {
    results.twitter = 'skipped — X credentials not configured'
  }

  // Mirror to Telegram channels
  const broadcastToken = process.env.BROADCAST_BOT_TOKEN
  const mainChannelId   = process.env.MAIN_CHANNEL_ID   || '-1002207667493'
  const communityChatId = process.env.COMMUNITY_CHAT_ID || '-1003930752060'
  if (broadcastToken) {
    const telegramText = text
    try { results.main_channel = await sendTelegram(mainChannelId, telegramText, broadcastToken) } catch(e) { results.main_channel_error = e.message }
    try { results.community    = await sendTelegram(communityChatId, telegramText, broadcastToken) } catch(e) { results.community_error = e.message }
  } else {
    results.telegram = 'skipped — BROADCAST_BOT_TOKEN not configured'
  }

  return res.status(200).json({ ok: true, text, results })
}
