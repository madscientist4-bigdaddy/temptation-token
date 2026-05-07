// POST /api/social-post — posts to X (@temptationtoken only) and mirrors to Telegram
//
// Required env vars (set in Vercel):
//   X_API_KEY, X_API_SECRET         — app credentials
//   TTS_X_ACCESS_TOKEN, TTS_X_ACCESS_SECRET — @temptationtoken credentials
//   BROADCAST_BOT_TOKEN   — @TTSBroadcastBot token
//   MAIN_CHANNEL_ID       — @temptationtoken channel ID
//   COMMUNITY_CHAT_ID     — @TTSCommunityChat chat ID
//
// Posting rules:
//   @temptationtoken — all template types + direct posts (brand voice)
//   @CryptoFitJim    — posts manually; no automated X posting
//
// Body: { type: 'round_start'|'round_settled'|'profile_approved', data: { roundId, profileCount, pool } }
//   OR: { platform: 'telegram', content: '...', chatId: '...' }  — direct Telegram mode
//   OR: { platform: 'x_tts', content: '...', day_of_week: 0-6 } — direct @temptationtoken X post

import crypto from 'crypto'

// ── OAuth ────────────────────────────────────────────────────────────────────

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

// ── Image upload ─────────────────────────────────────────────────────────────

const DAY_IMAGE = {
  0: 'post1_monday',
  1: 'post2_tuesday',
  2: 'post3_wednesday',
  3: 'post4_thursday',
  4: 'post5_friday',
  5: 'post6_saturday',
  6: 'post7_sunday',
}

async function uploadImageForDay(dayOfWeek, env) {
  const { X_API_KEY, X_API_SECRET, TTS_X_ACCESS_TOKEN, TTS_X_ACCESS_SECRET } = env
  if (!X_API_KEY || !TTS_X_ACCESS_TOKEN) return null

  const filename = DAY_IMAGE[dayOfWeek != null ? dayOfWeek : new Date().getDay()]
  if (!filename) return null

  // Fetch PNG from Vercel CDN (public/social_images/)
  let imgBuffer
  try {
    const imgUrl = `https://app.temptationtoken.io/social_images/${filename}.png`
    const r = await fetch(imgUrl)
    if (!r.ok) { console.error(`Image fetch ${r.status}: ${imgUrl}`); return null }
    imgBuffer = Buffer.from(await r.arrayBuffer())
  } catch (e) {
    console.error('Image fetch error:', e.message)
    return null
  }

  // Upload to Twitter v1.1 media/upload.json (multipart — OAuth signed without body params)
  const mediaUrl = 'https://upload.twitter.com/1.1/media/upload.json'
  const auth = oauthSign('POST', mediaUrl, {}, X_API_KEY, X_API_SECRET, TTS_X_ACCESS_SECRET, TTS_X_ACCESS_TOKEN)

  try {
    const form = new FormData()
    form.append('media', new Blob([imgBuffer], { type: 'image/png' }), 'image.png')

    const r = await fetch(mediaUrl, {
      method: 'POST',
      headers: { Authorization: auth },
      body: form,
    })
    const body = await r.json()
    if (!r.ok) {
      console.error('Media upload failed:', r.status, JSON.stringify(body))
      return null
    }
    return body.media_id_string
  } catch (e) {
    console.error('Media upload error:', e.message)
    return null
  }
}

// ── Tweet ────────────────────────────────────────────────────────────────────

async function postTweet(text, env, mediaId = null) {
  const url = 'https://api.twitter.com/2/tweets'
  const authHeader = oauthSign(
    'POST', url, {},
    env.X_API_KEY, env.X_API_SECRET, env.TTS_X_ACCESS_SECRET, env.TTS_X_ACCESS_TOKEN
  )
  const tweetBody = { text }
  if (mediaId) tweetBody.media = { media_ids: [mediaId] }

  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify(tweetBody)
  })
  const body = await r.json()
  if (!r.ok) {
    console.error(`X API ${r.status} (@temptationtoken):`, JSON.stringify(body))
    const err = new Error(`X API ${r.status}: ${JSON.stringify(body)}`)
    err.status = r.status
    err.xBody = body
    throw err
  }
  return body
}

async function verifyCredentials(env) {
  const url = 'https://api.twitter.com/2/users/me'
  const authHeader = oauthSign(
    'GET', url, {},
    env.X_API_KEY, env.X_API_SECRET, env.TTS_X_ACCESS_SECRET, env.TTS_X_ACCESS_TOKEN
  )
  const r = await fetch(url, { headers: { Authorization: authHeader } })
  const body = await r.json()
  return { label: '@temptationtoken', status: r.status, ok: r.ok, body, key_prefix: env.X_API_KEY?.slice(0,8)+'...', token_prefix: env.TTS_X_ACCESS_TOKEN?.slice(0,8)+'...' }
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

// ── @temptationtoken templates ────────────────────────────────────────────────

const TTS_TEMPLATES = {
  round_start: ({ roundId, profileCount }) =>
    `🎮 Round ${roundId} is now LIVE on Temptation Token. ${profileCount || 14} profiles competing. Vote now → app.temptationtoken.io $TTS #Base #Crypto\n\nWho's your pick this week? 👇`,

  round_settled: ({ roundId, pool }) =>
    `🏆 Round ${roundId} winner announced! ${pool ? pool.toLocaleString() + ' $TTS' : '$TTS'} paid automatically on-chain. Round ${Number(roundId) + 1} starts Monday. app.temptationtoken.io $TTS\n\nLast chance to vote tonight — who's winning in your bracket? 🔥`,

  profile_approved: ({ roundId }) =>
    `👑 New profile approved and live${roundId ? ` in Round ${roundId}` : ''}! Vote now → app.temptationtoken.io $TTS #TemptationToken\n\nReply with your wallet — top commenter gets a vote match bonus 🎁`,
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = req.body || {}

  // ── Test post: { _test_x_post: true, account: 'temptationtoken' } ───────────
  if (body._test_x_post) {
    const apiKey   = process.env.X_API_KEY
    const apiSec   = process.env.X_API_SECRET
    const tok      = process.env.TTS_X_ACCESS_TOKEN
    const tokSec   = process.env.TTS_X_ACCESS_SECRET
    if (!apiKey || !apiSec || !tok || !tokSec) {
      return res.status(200).json({ ok: false, error: 'Missing TTS X credentials (X_API_KEY / X_API_SECRET / TTS_X_ACCESS_TOKEN / TTS_X_ACCESS_SECRET)' })
    }
    const testText = `🧪 Test post from @temptationtoken — ${new Date().toUTCString()} — app.temptationtoken.io $TTS`
    try {
      const tweet = await postTweet(testText, { X_API_KEY: apiKey, X_API_SECRET: apiSec, TTS_X_ACCESS_TOKEN: tok, TTS_X_ACCESS_SECRET: tokSec })
      const tweetId = tweet?.data?.id
      return res.status(200).json({
        ok: true, account: '@temptationtoken', tweetId,
        tweetUrl: tweetId ? `https://twitter.com/TemptationToken/status/${tweetId}` : null,
        text: testText,
      })
    } catch (e) {
      return res.status(200).json({ ok: false, account: '@temptationtoken', error: e.message, status: e.status, xBody: e.xBody })
    }
  }

  // ── Diagnostic: { _diag: true } (legacy) ────────────────────────────────────
  if (body._diag) {
    const apiKey    = process.env.X_API_KEY
    const apiSecret = process.env.X_API_SECRET
    const ttsToken  = process.env.TTS_X_ACCESS_TOKEN
    const ttsSecret = process.env.TTS_X_ACCESS_SECRET
    const results = {
      env_set: {
        X_API_KEY: !!apiKey,
        X_API_SECRET: !!apiSecret,
        TTS_X_ACCESS_TOKEN: !!ttsToken,
        TTS_X_ACCESS_SECRET: !!ttsSecret,
      },
      key_prefix: apiKey?.slice(0,10) + '...',
      tts_token_prefix: ttsToken?.slice(0,10) + '...',
    }
    try { results.tts_verify = await verifyCredentials({ X_API_KEY: apiKey, X_API_SECRET: apiSecret, TTS_X_ACCESS_TOKEN: ttsToken, TTS_X_ACCESS_SECRET: ttsSecret }) }
    catch(e) { results.tts_verify_err = e.message }
    return res.status(200).json({ ok: true, diagnostic: results })
  }

  // ── Deep diagnostic: { _diagnostic: true } ───────────────────────────────────
  if (body._diagnostic) {
    const apiKey    = process.env.X_API_KEY
    const apiSecret = process.env.X_API_SECRET
    const ttsToken  = process.env.TTS_X_ACCESS_TOKEN
    const ttsSecret = process.env.TTS_X_ACCESS_SECRET

    const describe = (val) => val
      ? { present: true,  length: val.length, first_4: val.slice(0, 4), last_4: val.slice(-4) }
      : { present: false, length: 0,          first_4: null,            last_4: null }

    // Build a real OAuth header against the actual tweet endpoint so the signature is real
    const tweetUrl = 'https://api.twitter.com/2/tweets'
    let last_attempt_auth_header = null
    let oauth_signing_base_string = null
    let oauth_sig_key_shape = null
    try {
      // Reproduce exactly what postTweet() does — sign with empty body params (JSON body excluded per OAuth spec)
      last_attempt_auth_header = oauthSign(
        'POST', tweetUrl, {},
        apiKey   || 'MISSING',
        apiSecret || 'MISSING',
        ttsSecret || 'MISSING',
        ttsToken  || 'MISSING'
      )
      // Also capture the signing base string for inspection (re-run oauthSign internals manually)
      const nonce = 'DIAG_NONCE_STATIC'
      const ts    = Math.floor(Date.now() / 1000).toString()
      const oauthP = {
        oauth_consumer_key:     apiKey   || 'MISSING',
        oauth_nonce:            nonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp:        ts,
        oauth_token:            ttsToken  || 'MISSING',
        oauth_version:          '1.0',
      }
      const paramStr = Object.keys(oauthP).sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthP[k])}`).join('&')
      oauth_signing_base_string = `POST&${encodeURIComponent(tweetUrl)}&${encodeURIComponent(paramStr)}`
      oauth_sig_key_shape = `<API_SECRET>&<ACCESS_TOKEN_SECRET>  (lengths: ${(apiSecret||'').length} & ${(ttsSecret||'').length})`
    } catch (e) {
      last_attempt_auth_header = `ERROR building header: ${e.message}`
    }

    // Also attempt a live call and capture the raw X response
    let live_attempt = null
    if (apiKey && apiSecret && ttsToken && ttsSecret) {
      try {
        const authHeader = oauthSign(
          'POST', tweetUrl, {},
          apiKey, apiSecret, ttsSecret, ttsToken
        )
        const xRes = await fetch(tweetUrl, {
          method: 'POST',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: '🔇 diagnostic dry-run — this text is never sent if X rejects first' })
        })
        const xBody = await xRes.json()
        live_attempt = { http_status: xRes.status, x_response: xBody }
      } catch (e) {
        live_attempt = { error: e.message }
      }
    }

    return res.status(200).json({
      ok: true,
      env_vars_seen: {
        X_API_KEY:            describe(apiKey),
        X_API_SECRET:         describe(apiSecret),
        TTS_X_ACCESS_TOKEN:   describe(ttsToken),
        TTS_X_ACCESS_SECRET:  describe(ttsSecret),
      },
      var_names_in_code: ['X_API_KEY', 'X_API_SECRET', 'TTS_X_ACCESS_TOKEN', 'TTS_X_ACCESS_SECRET'],
      oauth_endpoint:         tweetUrl,
      oauth_library:          'custom HMAC-SHA1 (node:crypto — no third-party oauth library)',
      signature_method:       'HMAC-SHA1',
      last_attempt_auth_header,
      oauth_signing_base_string,
      oauth_sig_key_shape,
      live_attempt,
      deployment_id: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || 'not-set',
      node_version:  process.version,
    })
  }

  // ── Direct @temptationtoken X post: { platform: 'x_tts', content, day_of_week? } ──
  if (body.platform === 'x_tts' && body.content) {
    const apiKey   = process.env.X_API_KEY
    const apiSec   = process.env.X_API_SECRET
    const ttsToken = process.env.TTS_X_ACCESS_TOKEN
    const ttsSecret= process.env.TTS_X_ACCESS_SECRET
    if (!apiKey || !apiSec || !ttsToken || !ttsSecret) {
      return res.status(200).json({ ok: false, error: 'TTS X credentials not configured' })
    }
    const env = { X_API_KEY: apiKey, X_API_SECRET: apiSec, TTS_X_ACCESS_TOKEN: ttsToken, TTS_X_ACCESS_SECRET: ttsSecret }
    const mediaId = await uploadImageForDay(body.day_of_week ?? null, env)
    try {
      const r = await postTweet(body.content, env, mediaId)
      return res.status(200).json({ ok: true, tweet: r, media_id: mediaId || null })
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message })
    }
  }

  // ── Direct Telegram: { platform: 'telegram', content, chatId? } ─────────────
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

  // ── Template mode: { type, data } ────────────────────────────────────────────
  const { type, data = {} } = body
  if (!type || !TTS_TEMPLATES[type]) return res.status(400).json({ error: 'Unknown type. Valid: round_start, round_settled, profile_approved' })

  const results = {}
  const apiKey    = process.env.X_API_KEY
  const apiSecret = process.env.X_API_SECRET
  const ttsToken  = process.env.TTS_X_ACCESS_TOKEN
  const ttsSecret = process.env.TTS_X_ACCESS_SECRET
  const ttsText   = TTS_TEMPLATES[type](data)

  // Post to @temptationtoken
  if (apiKey && apiSecret && ttsToken && ttsSecret) {
    const env = { X_API_KEY: apiKey, X_API_SECRET: apiSecret, TTS_X_ACCESS_TOKEN: ttsToken, TTS_X_ACCESS_SECRET: ttsSecret }
    const dayOfWeek = new Date().getDay()
    const mediaId = await uploadImageForDay(dayOfWeek, env)
    try {
      results.twitter_tts = await postTweet(ttsText, env, mediaId)
      results.media_id = mediaId || null
    } catch (e) {
      results.twitter_tts_error = e.message
    }
  } else {
    results.twitter_tts = 'skipped — TTS X credentials not configured'
  }

  // Mirror to Telegram
  const broadcastToken = process.env.BROADCAST_BOT_TOKEN
  const mainChannelId   = process.env.MAIN_CHANNEL_ID   || '-1002207667493'
  const communityChatId = process.env.COMMUNITY_CHAT_ID || '-1003930752060'
  if (broadcastToken) {
    try { results.main_channel = await sendTelegram(mainChannelId, ttsText, broadcastToken) }   catch(e) { results.main_channel_error = e.message }
    try { results.community    = await sendTelegram(communityChatId, ttsText, broadcastToken) } catch(e) { results.community_error = e.message }
  } else {
    results.telegram = 'skipped — BROADCAST_BOT_TOKEN not configured'
  }

  return res.status(200).json({ ok: true, tts_text: ttsText, results })
}
