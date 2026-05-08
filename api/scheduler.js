// GET /api/scheduler — runs every hour via Vercel cron (vercel.json)
// Two jobs in one handler:
//   1. EVERY HOUR: fire approved scheduled_posts whose scheduled_at has passed
//   2. AT 10AM UTC daily: post round status update to Telegram

import crypto from 'crypto'

const SUPABASE_URL   = 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'
const VOTING_ADDRESS  = '0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6'
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

// ── X posting — @temptationtoken only ────────────────────────────────────────

// America/New_York day-of-week (0=Sun…6=Sat). Prevents UTC midnight drift
// where the 8pm EDT slot (00:00 UTC) would pull the next day's image.
function nyDayOfWeek() {
  const d = new Date()
  const day = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' })
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[day] ?? d.getDay()
}

const DAY_IMAGE = {
  0: 'post1_monday', 1: 'post2_tuesday', 2: 'post3_wednesday',
  3: 'post4_thursday', 4: 'post5_friday', 5: 'post6_saturday', 6: 'post7_sunday',
}

// Asserts the full 0-6 mapping at module load. Throws on any future regression.
;(function assertDayMapping() {
  const expected = [
    'post1_monday','post2_tuesday','post3_wednesday','post4_thursday',
    'post5_friday','post6_saturday','post7_sunday',
  ]
  for (let i = 0; i <= 6; i++) {
    if (DAY_IMAGE[i] !== expected[i])
      throw new Error(`DAY_IMAGE regression: index ${i} expected '${expected[i]}', got '${DAY_IMAGE[i]}'`)
  }
})()

async function uploadMediaForDay(dayOfWeek) {
  const { X_API_KEY, X_API_SECRET, TTS_X_ACCESS_TOKEN, TTS_X_ACCESS_SECRET } = process.env
  if (!X_API_KEY || !TTS_X_ACCESS_TOKEN) return null
  // DB path: post.day_of_week is Mon-first (Mon=0..Sun=6), matches DAY_IMAGE index directly — no shift needed
  // Fallback path: nyDayOfWeek() returns JS-native (Sun=0..Sat=6), shift to Mon-first via (dow+6)%7
  const imgKey = dayOfWeek != null ? dayOfWeek : (nyDayOfWeek() + 6) % 7
  const filename = DAY_IMAGE[imgKey]
  if (!filename) return null
  try {
    const imgUrl = `https://app.temptationtoken.io/social_images/${filename}.png`
    const imgResp = await fetch(imgUrl)
    if (!imgResp.ok) return null
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer())
    const mediaUrl = 'https://upload.twitter.com/1.1/media/upload.json'
    const auth = oauthSign('POST', mediaUrl, {}, X_API_KEY, X_API_SECRET, TTS_X_ACCESS_SECRET, TTS_X_ACCESS_TOKEN)
    const form = new FormData()
    form.append('media', new Blob([imgBuffer], { type: 'image/png' }), 'image.png')
    const r = await fetch(mediaUrl, { method: 'POST', headers: { Authorization: auth }, body: form })
    const body = await r.json()
    if (!r.ok) { console.error('Media upload failed:', r.status, JSON.stringify(body)); return null }
    return body.media_id_string
  } catch (e) {
    console.error('Media upload error:', e.message)
    return null
  }
}

async function postTweetTTS(text, dayOfWeek) {
  const { X_API_KEY, X_API_SECRET, TTS_X_ACCESS_TOKEN, TTS_X_ACCESS_SECRET } = process.env
  if (!X_API_KEY || !X_API_SECRET) return { skipped: 'X app credentials not set' }
  if (!TTS_X_ACCESS_TOKEN || !TTS_X_ACCESS_SECRET) return { skipped: 'TTS X credentials not set' }
  const mediaId = await uploadMediaForDay(dayOfWeek)
  const url = 'https://api.twitter.com/2/tweets'
  const auth = oauthSign('POST', url, {}, X_API_KEY, X_API_SECRET, TTS_X_ACCESS_SECRET, TTS_X_ACCESS_TOKEN)
  const tweetBody = { text }
  if (mediaId) tweetBody.media = { media_ids: [mediaId] }
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(tweetBody)
  })
  const body = await r.json()
  if (!r.ok) {
    console.error(`X API ${r.status} (@temptationtoken):`, JSON.stringify(body))
    const err = new Error(`X API ${r.status}: ${JSON.stringify(body)}`)
    err.status = r.status
    throw err
  }
  return body
}

// ── Instagram: send handoff DM to admin ──────────────────────────────────────
// Sends 3 Telegram messages to ADMIN_CHAT_ID: photo, caption block, hashtags+button.
// Sets posted_at=now() (used as "notification sent" flag — prevents re-firing).
// Status stays 'approved' until admin confirms via button or "done" reply.

async function sendInstagramHandoff(post, broadcastToken) {
  const adminChatId = process.env.ADMIN_CHAT_ID || '-5273368658'
  if (!broadcastToken || !adminChatId) return

  const filename = post.image_hint || 'post1_monday'
  const imgUrl   = `https://app.temptationtoken.io/social_images/${filename}.png`
  const caption  = post.content || ''
  const DAYS     = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  const dayName  = DAYS[post.day_of_week] || 'Today'
  let   hashtags = ''
  try { hashtags = JSON.parse(post.instagram_captions || '[]')[0] || '' } catch {}

  const tg = (method, body) => fetch(`https://api.telegram.org/bot${broadcastToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(() => {})

  // 1 — Photo with short header
  await tg('sendPhoto', {
    chat_id: adminChatId,
    photo:   imgUrl,
    caption: `📸 Instagram · ${dayName} · ${filename}.png`,
  })

  // 2 — Caption in code block (copy-paste friendly)
  await tg('sendMessage', {
    chat_id: adminChatId,
    text: `📝 <b>Caption — copy this:</b>\n\n<code>${caption.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code>`,
    parse_mode: 'HTML',
  })

  // 3 — Hashtags + confirm button + post ID
  const confirmUrl = `https://app.temptationtoken.io/api/scheduler?action=ig_confirm&id=${post.id}`
  await tg('sendMessage', {
    chat_id: adminChatId,
    text: `#️⃣ <b>Hashtags — copy this:</b>\n\n<code>${hashtags}</code>\n\n<i>Post image + caption + hashtags to @temptationtoken Instagram.\nTap the button when posted, or reply <b>done</b> to this message.</i>\n\n<code>Post ID: ${post.id}</code>`,
    parse_mode: 'HTML',
    reply_markup: JSON.stringify({
      inline_keyboard: [[{ text: '✅ Mark as Posted', url: confirmUrl }]]
    }),
  })
}

// ── Fire a single scheduled post ─────────────────────────────────────────────

async function firePost(post) {
  const broadcastToken = process.env.BROADCAST_BOT_TOKEN

  // Instagram: send Telegram handoff. posted_at = notification timestamp (prevents re-fire).
  // Status intentionally stays 'approved' until admin confirms — ig_confirm or "done" reply.
  if (post.platform === 'instagram') {
    await sendInstagramHandoff(post, broadcastToken)
    await sbPatch('scheduled_posts', `id=eq.${post.id}`, {
      posted_at: new Date().toISOString(),  // "notified at" — NOT "posted at"
      error: `ig_notified:${new Date().toISOString()}`
    })
    return { platform: 'instagram', id: post.id, status: 'handoff_sent' }
  }

  // Resolve content — instagram uses selected_caption, others use content directly
  const content = post.content

  const results = {}
  let anyError = null

  // platform 'x' (legacy Jim posts) — skip; Jim posts manually from content calendar
  if (post.platform === 'x') {
    await sbPatch('scheduled_posts', `id=eq.${post.id}`, {
      status: 'posted',
      posted_at: new Date().toISOString(),
      error: 'manual — @CryptoFitJim posts manually'
    })
    return { platform: 'x', status: 'skipped (manual)', id: post.id }
  }

  if (post.platform === 'x_tts') {
    try {
      // post.day_of_week is Mon-first from DB — pass directly, no shift applied
      results.x = await postTweetTTS(content, post.day_of_week ?? null)
    } catch (e) {
      if (e.status === 429) {
        // Rate limited — reschedule 15 min later, leave status approved
        const reschedule = new Date(Date.now() + 15 * 60 * 1000).toISOString()
        await sbPatch('scheduled_posts', `id=eq.${post.id}`, {
          scheduled_at: reschedule,
          error: `Rate limited @ ${new Date().toISOString()} — retrying at ${reschedule}`
        })
        return { platform: post.platform, id: post.id, rescheduled: reschedule }
      }

      let finalErr = e

      if (e.status >= 500) {
        // Server error — silent retry once after 2 seconds
        await new Promise(r => setTimeout(r, 2000))
        try {
          results.x = await postTweetTTS(content, post.day_of_week ?? null)  // Mon-first, no shift
          finalErr = null  // retry succeeded
        } catch (e2) {
          finalErr = e2
        }
      }

      if (finalErr) {
        anyError = finalErr.message
        results.x_error = finalErr.message
        // Alert admin on any non-2xx (401, 402, 403, 422, 5xx after retry, etc.)
        const adminChatId = process.env.ADMIN_CHAT_ID || '-5273368658'
        const alertToken  = process.env.BROADCAST_BOT_TOKEN
        if (alertToken) {
          const status = finalErr.status ?? '?'
          const hint = status === 401 ? ' — Fix X credentials in Vercel env.'
            : status === 402 ? ' — X API subscription / payment issue.'
            : status === 403 ? ' — Check X app permissions or API plan.'
            : ''
          try {
            await sendTelegram(
              adminChatId,
              `🚨 X post failed (HTTP ${status})${hint}\nPost ID: ${post.id}\n${finalErr.message.slice(0, 200)}`,
              alertToken
            )
          } catch {}
        }
      }
    }
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

  // ── GET /api/scheduler?action=ig_confirm&id=UUID ──────────────────────────
  // Called by the inline Telegram button. Marks IG post as posted, returns HTML.
  if (req.method === 'GET' && req.query?.action === 'ig_confirm') {
    const id = req.query.id
    const HTML_OK = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0f4f8}
.box{text-align:center;padding:32px 24px;background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.1);max-width:320px}
.icon{font-size:52px;margin-bottom:12px}.title{font-size:20px;font-weight:700;margin:0 0 8px}.sub{color:#666;font-size:14px}</style></head>
<body><div class="box"><div class="icon">✅</div><p class="title">Instagram post confirmed!</p><p class="sub">Marked as posted in the scheduler. You can close this.</p></div></body></html>`

    const HTML_ERR = (msg) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff8f0}.box{text-align:center;padding:24px;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.1)}</style></head><body><div class="box"><p style="font-size:36px">⚠️</p><p>${msg}</p></div></body></html>`

    if (!id) {
      res.setHeader('Content-Type', 'text/html')
      return res.status(400).end(HTML_ERR('Missing post ID.'))
    }

    const posts = await sbGet('scheduled_posts', `id=eq.${id}&select=*`)
    if (!Array.isArray(posts) || posts.length === 0) {
      res.setHeader('Content-Type', 'text/html')
      return res.status(404).end(HTML_ERR('Post not found.'))
    }

    const post = posts[0]
    if (post.status === 'posted') {
      res.setHeader('Content-Type', 'text/html')
      return res.status(200).end(HTML_OK)  // idempotent — already confirmed
    }

    await sbPatch('scheduled_posts', `id=eq.${id}`, {
      status: 'posted', posted_at: new Date().toISOString(), error: null
    })

    // Telegram confirmation ping
    const broadcastToken = process.env.BROADCAST_BOT_TOKEN
    const adminChatId    = process.env.ADMIN_CHAT_ID || '-5273368658'
    if (broadcastToken) {
      await sendTelegram(adminChatId, `✅ Instagram post confirmed as posted (ID: ${id.slice(0, 8)}…)`, broadcastToken)
    }

    res.setHeader('Content-Type', 'text/html')
    return res.status(200).end(HTML_OK)
  }

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
  // Instagram posts stay status='approved' after handoff (posted_at set as notification marker).
  // Skip them here if already notified (posted_at !== null) to prevent re-sending.

  try {
    const duePosts = await sbGet(
      'scheduled_posts',
      `status=eq.approved&scheduled_at=lte.${nowISO}&select=*`
    )

    if (Array.isArray(duePosts) && duePosts.length > 0) {
      for (const post of duePosts) {
        // Skip Instagram posts that have already been notified (posted_at set)
        if (post.platform === 'instagram' && post.posted_at) continue
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

  // ── JOB 1b: Instagram reminder (hour 15 UTC = 11am EDT) ──────────────────
  // Fires for any IG post notified today but not yet confirmed.

  if (nowHour === 15) {
    const broadcastToken = process.env.BROADCAST_BOT_TOKEN
    const adminChatId    = process.env.ADMIN_CHAT_ID || '-5273368658'
    try {
      const igApproved = await sbGet('scheduled_posts', 'platform=eq.instagram&status=eq.approved&select=*')
      if (Array.isArray(igApproved)) {
        const unconfirmed = igApproved.filter(p => p.error?.startsWith?.('ig_notified:') && p.posted_at)
        if (unconfirmed.length > 0 && broadcastToken) {
          for (const p of unconfirmed) {
            const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
            const confirmUrl = `https://app.temptationtoken.io/api/scheduler?action=ig_confirm&id=${p.id}`
            await sendTelegram(
              adminChatId,
              `⏰ <b>Instagram reminder — ${DAYS[p.day_of_week] || 'today'}</b>\n\nThis post was sent at 8am EDT and hasn't been confirmed yet.\n\nTap to confirm once posted: <a href="${confirmUrl}">Mark as Posted</a>\n\nor reply <b>done</b> to the original handoff message.\n\n<code>Post ID: ${p.id}</code>`,
              broadcastToken
            )
          }
          results.ig_reminders = unconfirmed.length
        }
      }
    } catch (e) { results.ig_reminder_error = e.message }
  }

  // ── JOB 1c: Instagram skip (hour 17 UTC = 1pm EDT) ───────────────────────
  // Marks unconfirmed IG posts as skipped 5 hours after handoff.

  if (nowHour === 17) {
    const adminChatId = process.env.ADMIN_CHAT_ID || '-5273368658'
    const skipToken   = process.env.BROADCAST_BOT_TOKEN
    try {
      const igApproved = await sbGet('scheduled_posts', 'platform=eq.instagram&status=eq.approved&select=*')
      if (Array.isArray(igApproved)) {
        const toSkip = igApproved.filter(p => p.error?.startsWith?.('ig_notified:') && p.posted_at)
        for (const p of toSkip) {
          await sbPatch('scheduled_posts', `id=eq.${p.id}`, { status: 'skipped', error: `skipped:not_confirmed_by_1pm_edt` })
          if (skipToken) {
            const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
            await sendTelegram(adminChatId, `⏭ Instagram post skipped — ${DAYS[p.day_of_week] || 'today'} (no confirmation by 1pm EDT). ID: ${p.id.slice(0, 8)}…`, skipToken)
          }
        }
        results.ig_skipped = toSkip.length
      }
    } catch (e) { results.ig_skip_error = e.message }
  }

  // ── JOB 2: Daily 2pm EST (19:00 UTC) round status update to Telegram ────────

  if (nowHour === 19) {
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

  // ── JOB 3: Auto-correction alerts ────────────────────────────────────────
  const adminChatId = process.env.ADMIN_CHAT_ID || '-5273368658'
  const adminToken  = process.env.TELEGRAM_BOT_TOKEN

  try {
    // Check LINK balances vs known values (warn if < 2)
    const UPKEEPS = [
      { name: 'TTS Link Reserve Monitor', known: 7.11 },
      { name: 'TTS Settle Or Rollover',   known: 6.2  },
      { name: 'TTS Midpoint Snapshot',    known: 8.2  },
      { name: 'TTS Start Round',          known: 5.9  },
    ]
    for (const u of UPKEEPS) {
      if (u.known < 2) {
        await sendTelegram(adminChatId, `⚠️ LOW LINK: ${u.name} has ${u.known.toFixed(2)} LINK — fund now at https://automation.chain.link/base`, adminToken)
      }
    }

    // Check if round is overdue (ended but not settled)
    const idHex = await rpcCall('eth_call', [{ to: VOTING_ADDRESS, data: '0x9cbe5efd' }, 'latest'])
    if (idHex && idHex !== '0x') {
      const roundId = parseInt(idHex, 16)
      const padded  = roundId.toString(16).padStart(64, '0')
      const rData   = await rpcCall('eth_call', [{ to: VOTING_ADDRESS, data: '0x8f1327c0' + padded }, 'latest'])
      if (rData && rData !== '0x') {
        const chunks = []
        for (let i = 0; i < rData.slice(2).length; i += 64) chunks.push(rData.slice(2 + i, 2 + i + 64))
        const endTime = parseInt(chunks[1], 16)
        const settled = chunks[4] !== '0'.padStart(64, '0')
        if (!settled && Math.floor(Date.now() / 1000) > endTime) {
          const settleLink = `https://basescan.org/address/0xB17b3842E2CFf594d8886e77277f4B6fC7C61A48#writeContract`
          await sendTelegram(adminChatId,
            `🚨 ROUND ${roundId} OVERDUE — ended ${new Date(endTime * 1000).toLocaleString()} but not settled!\n\nManual settle: ${settleLink}`,
            adminToken)
        }
      }
    }

    // Check if bot hasn't posted in 25+ hours
    const recent = await sbGet('scheduled_posts', `status=eq.posted&order=posted_at.desc&limit=1&select=posted_at`)
    if (Array.isArray(recent) && recent.length > 0 && recent[0].posted_at) {
      const lastPost = new Date(recent[0].posted_at).getTime()
      if (Date.now() - lastPost > 25 * 3600 * 1000) {
        await sendTelegram(adminChatId,
          `⚠️ No posts in 25+ hours! Last post was ${new Date(lastPost).toLocaleString()}. Check Content Calendar.`,
          adminToken)
      }
    }
  } catch (e) {
    results.alerts_error = e.message
  }

  return res.status(200).json({ ok: true, time: nowISO, ...results })
}
