// POST /api/social-post — posts to X (Twitter) and mirrors to Telegram channels
//
// Required env vars (set in Vercel):
//   X_API_KEY, X_API_SECRET         — app credentials (shared by both X accounts)
//   X_ACCESS_TOKEN, X_ACCESS_SECRET — @CryptoFitJim user credentials
//   TTS_X_ACCESS_TOKEN, TTS_X_ACCESS_SECRET — @temptationtoken user credentials (optional)
//   BROADCAST_BOT_TOKEN   — @TTSBroadcastBot token
//   MAIN_CHANNEL_ID       — @temptationtoken channel ID
//   COMMUNITY_CHAT_ID     — @TTSCommunityChat chat ID
//
// Posting rules:
//   @CryptoFitJim     — all template types + content calendar (personal voice)
//   @temptationtoken  — round_start, round_settled, profile_approved only (brand voice)
//
// Body: { type: 'round_start'|'round_settled'|'profile_approved', data: { roundId, profileCount, pool } }
//   OR: { platform: 'telegram', content: '...', chatId: '...' }  — direct Telegram mode

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

// @CryptoFitJim — personal voice, all event types
const TEMPLATES = {
  round_start: ({ roundId, profileCount, pool }) =>
    `🔥 Round ${roundId} is LIVE on Temptation Token\n\n${profileCount} profiles competing for ${pool ? pool.toLocaleString() + ' $TTS' : '$TTS'}\n\nVote now → app.temptationtoken.io\n\n#TTS #Base #Crypto`,

  round_settled: ({ roundId }) =>
    `🏆 Round ${roundId} SETTLED\n\nWinner paid automatically on Base\nChainlink VRF — provably fair\n\nRound ${roundId + 1} starts Monday 🔥\n\napp.temptationtoken.io`,

  profile_approved: () =>
    `🔥 New profile just approved\n\nVote $TTS to back your favorite\nWinner takes 35% of the pool\n\nt.me/TTSGameBot`,
}

// @temptationtoken — brand voice, event-driven announcements only
const TTS_TEMPLATES = {
  round_start: ({ roundId, profileCount }) =>
    `🎮 Round ${roundId} is now LIVE on Temptation Token. ${profileCount || 14} profiles competing. Vote now → app.temptationtoken.io $TTS #Base #Crypto`,

  round_settled: ({ roundId, pool }) =>
    `🏆 Round ${roundId} winner announced! ${pool ? pool.toLocaleString() + ' $TTS' : '$TTS'} paid automatically on-chain. Round ${Number(roundId) + 1} starts Monday. app.temptationtoken.io $TTS`,

  profile_approved: ({ roundId }) =>
    `👑 New profile approved and live${roundId ? ` in Round ${roundId}` : ''}! Vote now → app.temptationtoken.io $TTS #TemptationToken`,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = req.body || {}

  // Direct X post to @temptationtoken: { platform: 'x_tts', content }
  if (body.platform === 'x_tts' && body.content) {
    const _apiKey   = process.env.X_API_KEY
    const _apiSecret= process.env.X_API_SECRET
    const ttsToken  = process.env.TTS_X_ACCESS_TOKEN
    const ttsSecret = process.env.TTS_X_ACCESS_SECRET
    if (!_apiKey || !_apiSecret || !ttsToken || !ttsSecret) {
      return res.status(200).json({ ok: false, error: 'TTS X credentials not configured' })
    }
    try {
      const r = await postTweet(body.content, { X_API_KEY: _apiKey, X_API_SECRET: _apiSecret, X_ACCESS_TOKEN: ttsToken, X_ACCESS_SECRET: ttsSecret })
      return res.status(200).json({ ok: true, tweet: r })
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message })
    }
  }

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

  const results = {}

  const apiKey    = process.env.X_API_KEY
  const apiSecret = process.env.X_API_SECRET

  // Post to @CryptoFitJim (personal voice — all types)
  const jimToken  = process.env.X_ACCESS_TOKEN
  const jimSecret = process.env.X_ACCESS_SECRET
  if (apiKey && apiSecret && jimToken && jimSecret) {
    const jimText = TEMPLATES[type](data)
    try {
      results.twitter_jim = await postTweet(jimText, { X_API_KEY: apiKey, X_API_SECRET: apiSecret, X_ACCESS_TOKEN: jimToken, X_ACCESS_SECRET: jimSecret })
    } catch(e) {
      results.twitter_jim_error = e.message
    }
  } else {
    results.twitter_jim = 'skipped — @CryptoFitJim X credentials not configured'
  }

  // Post to @temptationtoken (brand voice — event types only)
  const ttsToken  = process.env.TTS_X_ACCESS_TOKEN
  const ttsSecret = process.env.TTS_X_ACCESS_SECRET
  if (apiKey && apiSecret && ttsToken && ttsSecret && TTS_TEMPLATES[type]) {
    const ttsText = TTS_TEMPLATES[type](data)
    try {
      results.twitter_tts = await postTweet(ttsText, { X_API_KEY: apiKey, X_API_SECRET: apiSecret, X_ACCESS_TOKEN: ttsToken, X_ACCESS_SECRET: ttsSecret })
    } catch(e) {
      results.twitter_tts_error = e.message
    }
  } else if (!ttsToken || !ttsSecret) {
    results.twitter_tts = 'skipped — TTS_X_ACCESS_TOKEN/SECRET not configured'
  }

  // Mirror to Telegram channels
  const broadcastToken = process.env.BROADCAST_BOT_TOKEN
  const mainChannelId   = process.env.MAIN_CHANNEL_ID   || '-1002207667493'
  const communityChatId = process.env.COMMUNITY_CHAT_ID || '-1003930752060'
  if (broadcastToken) {
    const telegramText = TEMPLATES[type](data)
    try { results.main_channel = await sendTelegram(mainChannelId, telegramText, broadcastToken) } catch(e) { results.main_channel_error = e.message }
    try { results.community    = await sendTelegram(communityChatId, telegramText, broadcastToken) } catch(e) { results.community_error = e.message }
  } else {
    results.telegram = 'skipped — BROADCAST_BOT_TOKEN not configured'
  }

  return res.status(200).json({ ok: true, jim_text: TEMPLATES[type](data), tts_text: TTS_TEMPLATES[type]?.(data) || null, results })
}
