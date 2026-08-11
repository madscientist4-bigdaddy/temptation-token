// Social AI Composer — server side.
//
// Routed from api/social-post.js (?action=composer-*) so the Vercel function
// count stays at 12. Every handler is admin-token-gated.
//
// THE HARD GATE (requirement 3): only media whose social_assets.source is
// 'admin_brand' may be published. Creator/submitter photos are refused unless
// SOCIAL_CREATOR_MEDIA=true, because the consent copy users agreed to covers
// the game and its NFTs — not marketing use. The gate lives HERE, server-side,
// and is re-checked at post time; the browser's copy of the flag is advisory.

import crypto from 'crypto'
import { evaluate } from './compliance.js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY
const BUCKET       = 'social-media'
const CREATOR_MEDIA_ENABLED = process.env.SOCIAL_CREATOR_MEDIA === 'true'

const MAIN_CHANNEL_ID   = process.env.MAIN_CHANNEL_ID   || '-1002207667493'
const COMMUNITY_CHAT_ID = process.env.COMMUNITY_CHAT_ID || '-1003930752060'

// ── Supabase (service key) ────────────────────────────────────────────────────

const sbHeaders = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
})

async function sbGet(table, query) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders() })
  if (!r.ok) return []
  return r.json()
}

async function sbInsert(table, row, returning = true) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: returning ? 'return=representation' : 'return=minimal' },
    body: JSON.stringify(row),
  })
  if (!r.ok) throw new Error(`insert ${table} failed: ${(await r.text()).slice(0, 200)}`)
  return returning ? r.json() : null
}

// ── Private-bucket storage ───────────────────────────────────────────────────

// Signed UPLOAD url — the browser PUTs straight to Supabase, so a 50MB video
// never passes through Vercel's 4.5MB request-body cap.
async function signedUploadUrl(path) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({ expiresIn: 600 }),
  })
  if (!r.ok) throw new Error(`sign upload failed: ${(await r.text()).slice(0, 160)}`)
  const d = await r.json()
  const signed = d.url || d.signedURL || d.signedUrl
  return { url: `${SUPABASE_URL}/storage/v1${signed.startsWith('/') ? '' : '/'}${signed}`, token: d.token }
}

// Signed DOWNLOAD url — Telegram fetches this directly (sendPhoto/sendVideo
// accept a URL), so we never buffer media for the Telegram leg.
async function signedDownloadUrl(path, expiresIn = 900) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({ expiresIn }),
  })
  if (!r.ok) throw new Error(`sign download failed: ${(await r.text()).slice(0, 160)}`)
  const d = await r.json()
  const signed = d.signedURL || d.signedUrl
  return `${SUPABASE_URL}/storage/v1${signed}`
}

// X needs the raw bytes.
async function downloadBytes(path) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { headers: sbHeaders() })
  if (!r.ok) throw new Error(`download failed: HTTP ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

// ── X OAuth 1.0a ─────────────────────────────────────────────────────────────

const enc = s => encodeURIComponent(s).replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())

function xEnv() {
  const e = {
    key: process.env.X_API_KEY,
    secret: process.env.X_API_SECRET,
    token: process.env.TTS_X_ACCESS_TOKEN,
    tokenSecret: process.env.TTS_X_ACCESS_SECRET,
  }
  if (!e.key || !e.secret || !e.token || !e.tokenSecret) return null
  return e
}

// `params` must include any query-string or form-urlencoded body params —
// OAuth 1.0a signs those. Multipart bodies are excluded by spec.
function oauth(method, url, params, e) {
  const o = {
    oauth_consumer_key: e.key,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: e.token,
    oauth_version: '1.0',
  }
  const all = { ...params, ...o }
  const base = [
    method.toUpperCase(),
    enc(url),
    enc(Object.keys(all).sort().map(k => `${enc(k)}=${enc(all[k])}`).join('&')),
  ].join('&')
  o.oauth_signature = crypto.createHmac('sha1', `${enc(e.secret)}&${enc(e.tokenSecret)}`).update(base).digest('base64')
  return 'OAuth ' + Object.keys(o).sort().map(k => `${enc(k)}="${enc(o[k])}"`).join(', ')
}

const MEDIA_URL = 'https://upload.twitter.com/1.1/media/upload.json'

// Photos: single-shot multipart upload (the path already proven in prod).
async function xUploadPhoto(bytes, mime, e) {
  const form = new FormData()
  form.append('media', new Blob([bytes], { type: mime }), 'image')
  const r = await fetch(MEDIA_URL, {
    method: 'POST',
    headers: { Authorization: oauth('POST', MEDIA_URL, {}, e) },
    body: form,
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`X media upload ${r.status}: ${JSON.stringify(body).slice(0, 300)}`)
  return body.media_id_string
}

// Video: INIT → APPEND(×n) → FINALIZE → poll STATUS.
// INIT/FINALIZE/STATUS are form-urlencoded, so their params ARE signed.
// APPEND is multipart, so only the oauth params are signed.
async function xUploadVideo(bytes, mime, e, { probeOnly = false } = {}) {
  const initParams = {
    command: 'INIT',
    total_bytes: String(bytes.length),
    media_type: mime,
    media_category: 'tweet_video',
  }
  const initRes = await fetch(MEDIA_URL, {
    method: 'POST',
    headers: {
      Authorization: oauth('POST', MEDIA_URL, initParams, e),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(initParams).toString(),
  })
  const initBody = await initRes.json().catch(() => ({}))
  if (!initRes.ok) {
    const err = new Error(`X INIT ${initRes.status}: ${JSON.stringify(initBody).slice(0, 300)}`)
    err.status = initRes.status
    err.xBody = initBody
    throw err
  }
  const mediaId = initBody.media_id_string
  // Capability probe stops here — an INIT'd, never-FINALIZE'd upload simply expires.
  if (probeOnly) return { mediaId, probed: true }

  const CHUNK = 4 * 1024 * 1024
  for (let i = 0, seg = 0; i < bytes.length; i += CHUNK, seg++) {
    const form = new FormData()
    form.append('command', 'APPEND')
    form.append('media_id', mediaId)
    form.append('segment_index', String(seg))
    form.append('media', new Blob([bytes.subarray(i, i + CHUNK)], { type: 'application/octet-stream' }), 'chunk')
    const ar = await fetch(MEDIA_URL, {
      method: 'POST',
      headers: { Authorization: oauth('POST', MEDIA_URL, {}, e) },
      body: form,
    })
    if (!ar.ok) throw new Error(`X APPEND seg ${seg} ${ar.status}: ${(await ar.text()).slice(0, 200)}`)
  }

  const finParams = { command: 'FINALIZE', media_id: mediaId }
  const finRes = await fetch(MEDIA_URL, {
    method: 'POST',
    headers: {
      Authorization: oauth('POST', MEDIA_URL, finParams, e),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(finParams).toString(),
  })
  const finBody = await finRes.json().catch(() => ({}))
  if (!finRes.ok) throw new Error(`X FINALIZE ${finRes.status}: ${JSON.stringify(finBody).slice(0, 300)}`)

  // Transcode poll — X rejects a tweet referencing a still-processing video.
  let info = finBody.processing_info
  const deadline = Date.now() + 60_000
  while (info && info.state !== 'succeeded' && Date.now() < deadline) {
    if (info.state === 'failed') throw new Error(`X transcode failed: ${JSON.stringify(info).slice(0, 200)}`)
    await new Promise(r => setTimeout(r, Math.max(1000, (info.check_after_secs || 2) * 1000)))
    const q = { command: 'STATUS', media_id: mediaId }
    const sr = await fetch(`${MEDIA_URL}?${new URLSearchParams(q)}`, {
      headers: { Authorization: oauth('GET', MEDIA_URL, q, e) },
    })
    const sb = await sr.json().catch(() => ({}))
    info = sb.processing_info
    if (!sr.ok) throw new Error(`X STATUS ${sr.status}`)
  }
  return { mediaId }
}

async function xTweet(text, mediaId, e) {
  const url = 'https://api.twitter.com/2/tweets'
  const body = { text }
  if (mediaId) body.media = { media_ids: [mediaId] }
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: oauth('POST', url, {}, e), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) {
    const err = new Error(`X tweet ${r.status}: ${JSON.stringify(d).slice(0, 300)}`)
    err.status = r.status
    throw err
  }
  return d
}

export async function xDeleteTweet(tweetId) {
  const e = xEnv()
  if (!e) return { ok: false, error: 'X credentials not configured' }
  const url = `https://api.twitter.com/2/tweets/${tweetId}`
  const r = await fetch(url, { method: 'DELETE', headers: { Authorization: oauth('DELETE', url, {}, e) } })
  return { ok: r.ok, body: await r.json().catch(() => ({})) }
}

// ── Telegram (broadcaster) ───────────────────────────────────────────────────

async function tg(method, payload) {
  const token = process.env.BROADCAST_BOT_TOKEN
  if (!token) throw new Error('BROADCAST_BOT_TOKEN not set')
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const d = await r.json().catch(() => ({}))
  if (!d.ok) throw new Error(`Telegram ${method}: ${JSON.stringify(d.description || d).slice(0, 200)}`)
  return d.result
}

export async function tgDeleteMessage(chatId, messageId) {
  try { await tg('deleteMessage', { chat_id: chatId, message_id: messageId }); return { ok: true } }
  catch (e) { return { ok: false, error: e.message } }
}

// ── Claude caption generation ────────────────────────────────────────────────

const CAPTION_SCHEMA = {
  type: 'object',
  properties: {
    captions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          angle:    { type: 'string', description: 'One-word label for this angle, e.g. "playful", "proof", "invite".' },
          text:     { type: 'string', description: 'The caption body, including the app link. No hashtags here.' },
          hashtags: { type: 'array', items: { type: 'string' }, description: 'Hashtags WITHOUT the leading #.' },
        },
        required: ['angle', 'text', 'hashtags'],
        additionalProperties: false,
      },
    },
  },
  required: ['captions'],
  additionalProperties: false,
}

// The rules here mirror lib/social/compliance.js on purpose. The engine is the
// enforcement layer (a caption that violates is refused); this is the steering
// layer, so the model mostly produces passing captions on the first try.
const SYSTEM_PROMPT = `You write social captions for Temptation Token ($TTS), a weekly "Hot or Not" style photo-voting game on Base. You are writing for the brand accounts @temptationtoken (X) and the Telegram channel.

FACTS — never contradict these:
- Prize split: 35% top voter, 35% winning profile, 10% charity (Polaris Project, anti-human-trafficking), 20% house. NEVER write any other figure near prize/pool/voter/winner.
- The prize pool is the WINNING profile's votes only. Losing-profile votes are burned. Never say all votes form the pool.
- Signup bonus is 500 TTS. Vote match is 1:1 up to 1,000 TTS. Transfer tax is 1%, fixed and permanent.
- Rounds run Monday 12:00 AM ET to Sunday 11:59 PM ET. Winner is picked by Chainlink VRF.
- The link is always app.temptationtoken.io.

HARD RULES — a caption breaking any of these is discarded:
- No earnings claims. No guarantees, no "risk-free", no price predictions, no multipliers (2x/100x), no "to the moon", no passive-income or make-money framing, no investment advice (including "not financial advice").
- Keep it SFW. This is a mainstream consumer game, not adult content. No sexualised language, nothing that could read as referring to minors.
- If the caption offers the reader an incentive (bonus, giveaway, airdrop, referral, free TTS, "claim your"), it MUST include #ad.
- Stay under 280 characters INCLUDING hashtags when the platform is X.

STYLE: confident, playful, human. No emoji spam (two max). No manufactured urgency. Vary the angle across the options you return.`

export async function generateCaptions({ brief, platform = 'x_tts', count = 3, requiresDisclosure = false }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const n = Math.min(3, Math.max(2, Number(count) || 3))
  const limit = platform === 'telegram' ? 4096 : 280

  const res = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: CAPTION_SCHEMA },
    },
    messages: [{
      role: 'user',
      content: [
        `Write exactly ${n} caption options for a ${platform === 'telegram' ? 'Telegram channel' : 'post on X'}.`,
        `Hard length limit: ${limit} characters including hashtags.`,
        requiresDisclosure ? 'This post is promotional — every option MUST include #ad.' : '',
        '',
        `What the post is about:`,
        brief,
      ].filter(Boolean).join('\n'),
    }],
  })

  const text = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    // Defensive: if structured output isn't honoured, salvage the first JSON object.
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('Claude returned no parseable JSON')
    parsed = JSON.parse(m[0])
  }

  const out = (parsed.captions || []).slice(0, n).map(c => {
    const tags = (c.hashtags || []).map(h => '#' + String(h).replace(/^#+/, '')).join(' ')
    const full = tags ? `${c.text.trim()}\n\n${tags}` : c.text.trim()
    return {
      angle: c.angle || '',
      text: full,
      compliance: evaluate(full, { platform, forceDisclosure: requiresDisclosure }),
    }
  })
  return { captions: out, model: res.model, usage: res.usage }
}

// ── The hard gate ────────────────────────────────────────────────────────────

export async function loadAsset(assetId) {
  const rows = await sbGet('social_assets', `id=eq.${encodeURIComponent(assetId)}&select=*&limit=1`)
  return Array.isArray(rows) && rows[0] ? rows[0] : null
}

/** Throws unless this asset is cleared for publication. */
export function assertPublishable(asset) {
  if (!asset) {
    const e = new Error('Asset not found'); e.code = 'no_asset'; throw e
  }
  if (asset.source !== 'admin_brand' && !CREATOR_MEDIA_ENABLED) {
    const e = new Error(
      'Blocked: this is creator/submitter media. Only admin-uploaded brand or announcement ' +
      'media may be posted until the consent copy covers marketing use (SOCIAL_CREATOR_MEDIA=false).'
    )
    e.code = 'creator_media_blocked'
    throw e
  }
  return true
}

// ── Logging — every attempt, including refusals ──────────────────────────────

async function logPost(row) {
  try { await sbInsert('social_post_log', row, false) } catch (e) { console.error('social_post_log:', e.message) }
}

// ── Publish core (shared by POST NOW and the scheduler) ──────────────────────
// Callers are responsible for the hard gate and the compliance check BEFORE
// calling this — it publishes what it is given.

export async function publish({ asset, caption, wantX, wantTG }) {
  const results = {}
  let anyError = null

  if (wantX) {
    const e = xEnv()
    if (!e) { results.x_error = 'X credentials not configured'; anyError = results.x_error }
    else {
      try {
        let mediaId = null
        if (asset) {
          const bytes = await downloadBytes(asset.storage_path)
          mediaId = asset.kind === 'video'
            ? (await xUploadVideo(bytes, asset.mime, e)).mediaId
            : await xUploadPhoto(bytes, asset.mime, e)
        }
        const tweet = await xTweet(caption, mediaId, e)
        results.x = {
          tweet_id: tweet?.data?.id,
          url: tweet?.data?.id ? `https://twitter.com/TemptationToken/status/${tweet.data.id}` : null,
        }
      } catch (err) {
        results.x_error = String(err.message).slice(0, 300)
        anyError = results.x_error
      }
    }
  }

  if (wantTG) {
    try {
      // Telegram fetches the signed URL itself — no buffering on our side.
      const mediaUrl = asset ? await signedDownloadUrl(asset.storage_path) : null
      const sent = []
      for (const chat of [MAIN_CHANNEL_ID, COMMUNITY_CHAT_ID]) {
        let msg
        if (!asset) msg = await tg('sendMessage', { chat_id: chat, text: caption, disable_web_page_preview: true })
        else if (asset.kind === 'video') msg = await tg('sendVideo', { chat_id: chat, video: mediaUrl, caption })
        else msg = await tg('sendPhoto', { chat_id: chat, photo: mediaUrl, caption })
        sent.push({ chat_id: chat, message_id: msg.message_id })
      }
      results.telegram = sent
    } catch (err) {
      results.telegram_error = String(err.message).slice(0, 300)
      anyError = results.telegram_error
    }
  }

  return { results, anyError }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/** POST ?action=composer-capabilities — can this X tier do chunked video upload? */
export async function handleCapabilities(req, res) {
  const e = xEnv()
  const report = {
    x_credentials: !!e,
    photo_upload: !!e,       // proven in production
    video_chunked_upload: false,
    video_probe: null,
    telegram: !!process.env.BROADCAST_BOT_TOKEN,
    creator_media_enabled: CREATOR_MEDIA_ENABLED,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    bucket: BUCKET,
  }
  if (!e) return res.status(200).json(report)
  try {
    // INIT a tiny tweet_video upload. If the tier allows chunked media the
    // call returns a media_id; we never FINALIZE, so it just expires.
    const probe = await xUploadVideo(Buffer.alloc(1024), 'video/mp4', e, { probeOnly: true })
    report.video_chunked_upload = !!probe.mediaId
    report.video_probe = { ok: true, media_id: probe.mediaId }
  } catch (err) {
    report.video_chunked_upload = false
    report.video_probe = { ok: false, status: err.status || null, error: String(err.message).slice(0, 300) }
  }
  return res.status(200).json(report)
}

/** POST ?action=composer-upload-url { filename, mime, kind, source, label } */
export async function handleUploadUrl(req, res, body) {
  if (!SERVICE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY missing' })
  const mime = String(body.mime || '')
  const kind = mime.startsWith('video/') ? 'video' : 'photo'
  const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']
  if (!ALLOWED.includes(mime)) return res.status(400).json({ error: `Unsupported type: ${mime}` })

  // source is admin-declared. Anything not explicitly 'admin_brand' lands as
  // 'creator' and is refused at post time by the hard gate.
  const source = body.source === 'admin_brand' ? 'admin_brand' : 'creator'
  const safe = String(body.filename || 'upload').replace(/[^\w.\-]/g, '_').slice(-80)
  const path = `${source}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safe}`

  try {
    const { url, token } = await signedUploadUrl(path)
    const [asset] = await sbInsert('social_assets', {
      storage_path: path, kind, mime,
      bytes: Number(body.bytes) || null,
      label: (body.label || '').toString().slice(0, 200) || null,
      source,
      uploaded_by: 'admin',
    })
    return res.status(200).json({ ok: true, upload_url: url, token, asset })
  } catch (e) {
    return res.status(500).json({ error: String(e.message).slice(0, 300) })
  }
}

/** POST ?action=composer-generate { brief, platform, count, requiresDisclosure } */
export async function handleGenerate(req, res, body) {
  const brief = String(body.brief || '').trim()
  if (!brief) return res.status(400).json({ error: 'brief is required' })
  try {
    const out = await generateCaptions({
      brief,
      platform: body.platform || 'x_tts',
      count: body.count,
      requiresDisclosure: !!body.requiresDisclosure,
    })
    return res.status(200).json({ ok: true, ...out })
  } catch (e) {
    return res.status(500).json({ error: String(e.message).slice(0, 300) })
  }
}

/** POST ?action=composer-post { assetId?, caption, platforms:[] } — POST NOW */
export async function handlePost(req, res, body) {
  const caption   = String(body.caption || '')
  const platforms = Array.isArray(body.platforms) ? body.platforms : []
  const wantX  = platforms.includes('x_tts')
  const wantTG = platforms.includes('telegram')
  if (!wantX && !wantTG) return res.status(400).json({ error: 'Pick at least one platform' })

  let asset = null
  try {
    if (body.assetId) {
      asset = await loadAsset(body.assetId)
      assertPublishable(asset)          // ← HARD GATE
    }
  } catch (e) {
    await logPost({
      asset_id: body.assetId || null, mode: 'now', platforms, caption,
      status: 'blocked', error: e.message, created_by: 'admin',
    })
    return res.status(403).json({ error: e.message, code: e.code || 'blocked' })
  }

  // Server-side compliance re-check. The browser preview is advisory only.
  const verdicts = {}
  for (const p of platforms) {
    const v = evaluate(caption, { platform: p, forceDisclosure: !!body.requiresDisclosure })
    verdicts[p] = v
    if (!v.ok) {
      await logPost({
        asset_id: asset?.id || null, mode: 'now', platforms, caption,
        compliance: verdicts, status: 'blocked',
        error: `compliance: ${v.blocking.map(b => b.id).join(',')}`, created_by: 'admin',
      })
      return res.status(422).json({ error: 'Caption blocked by compliance', platform: p, compliance: v })
    }
  }

  const { results, anyError } = await publish({ asset, caption, wantX, wantTG })

  const posted = (wantX ? !!results.x : true) && (wantTG ? !!results.telegram : true)
  await logPost({
    asset_id: asset?.id || null, mode: 'now', platforms, caption,
    compliance: verdicts,
    x_tweet_id: results.x?.tweet_id || null,
    telegram_msg_ids: results.telegram || null,
    status: posted ? 'posted' : (results.x || results.telegram ? 'partial' : 'failed'),
    error: anyError, created_by: 'admin',
  })

  return res.status(200).json({ ok: posted, results })
}

/** POST ?action=composer-schedule { assetId?, caption, platforms:[], scheduledAt } */
export async function handleSchedule(req, res, body) {
  const caption   = String(body.caption || '')
  const platforms = Array.isArray(body.platforms) ? body.platforms : []
  const when      = new Date(body.scheduledAt)
  if (!platforms.length) return res.status(400).json({ error: 'Pick at least one platform' })
  if (isNaN(when.getTime())) return res.status(400).json({ error: 'scheduledAt is not a valid date' })

  let asset = null
  try {
    if (body.assetId) { asset = await loadAsset(body.assetId); assertPublishable(asset) }  // ← HARD GATE
  } catch (e) {
    await logPost({ asset_id: body.assetId || null, mode: 'scheduled', platforms, caption, status: 'blocked', error: e.message, created_by: 'admin' })
    return res.status(403).json({ error: e.message, code: e.code || 'blocked' })
  }

  const verdicts = {}
  for (const p of platforms) {
    const v = evaluate(caption, { platform: p, forceDisclosure: !!body.requiresDisclosure })
    verdicts[p] = v
    if (!v.ok) {
      await logPost({ asset_id: asset?.id || null, mode: 'scheduled', platforms, caption, compliance: verdicts, status: 'blocked', error: `compliance: ${v.blocking.map(b => b.id).join(',')}`, created_by: 'admin' })
      return res.status(422).json({ error: 'Caption blocked by compliance', platform: p, compliance: v })
    }
  }

  // Mon-first day index, matching the existing scheduled_posts convention.
  const dow = (when.getUTCDay() + 6) % 7
  const weekStart = new Date(when)
  weekStart.setUTCDate(when.getUTCDate() - dow)
  weekStart.setUTCHours(0, 0, 0, 0)

  const rows = platforms.map(p => ({
    platform: p,
    post_type: 'composer',
    day_of_week: dow,
    scheduled_at: when.toISOString(),
    content: caption,
    status: 'approved',           // composer output is admin-authored + already checked
    week_start: weekStart.toISOString().slice(0, 10),
    media_asset_id: asset?.id || null,
  }))

  try {
    const inserted = await sbInsert('scheduled_posts', rows)
    await logPost({
      asset_id: asset?.id || null, mode: 'scheduled', platforms, caption,
      compliance: verdicts, scheduled_post_id: inserted?.[0]?.id || null,
      status: 'posted', created_by: 'admin',
    })
    return res.status(200).json({ ok: true, scheduled: inserted })
  } catch (e) {
    return res.status(500).json({ error: String(e.message).slice(0, 300) })
  }
}

/** POST ?action=composer-assets — recent uploads + recent log, for the tab. */
export async function handleAssets(req, res) {
  const [assets, log] = await Promise.all([
    sbGet('social_assets', 'select=*&order=created_at.desc&limit=40'),
    sbGet('social_post_log', 'select=*&order=created_at.desc&limit=25'),
  ])
  return res.status(200).json({ ok: true, assets, log, creator_media_enabled: CREATOR_MEDIA_ENABLED })
}

export const _internals = { signedDownloadUrl, downloadBytes, xUploadVideo, xUploadPhoto, xEnv }
