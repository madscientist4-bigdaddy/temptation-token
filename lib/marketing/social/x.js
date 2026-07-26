// X API v2 tweet + v1.1 media upload, OAuth 1.0a user context (ported from x.ts).
// DRY_RUN logs instead of posting.
import crypto from 'node:crypto'
import { cfg } from '../config.js'

function oauthHeader(method, url, extraParams = {}) {
  const o = {
    oauth_consumer_key: cfg.x.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: cfg.x.accessToken,
    oauth_version: '1.0',
  }
  const enc = (s) => encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  const all = { ...o, ...extraParams }
  const base = [method.toUpperCase(), enc(url),
    enc(Object.keys(all).sort().map((k) => `${enc(k)}=${enc(all[k])}`).join('&'))].join('&')
  const key = `${enc(cfg.x.apiSecret)}&${enc(cfg.x.accessSecret)}`
  o.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64')
  return 'OAuth ' + Object.keys(o).sort().map((k) => `${enc(k)}="${enc(o[k])}"`).join(', ')
}

export async function uploadMedia(png) {
  if (cfg.dryRun) { console.log(`[DRY] X media upload (${png.length}b)`); return 'DRY_MEDIA_ID' }
  const url = 'https://upload.twitter.com/1.1/media/upload.json'
  const form = new FormData()
  form.append('media', new Blob([new Uint8Array(png)]), 'card.png')
  const r = await fetch(url, { method: 'POST', headers: { Authorization: oauthHeader('POST', url) }, body: form })
  if (!r.ok) { console.error('X media upload failed', r.status, await r.text()); return null }
  return (await r.json()).media_id_string
}

export async function tweet(text, mediaId) {
  if (cfg.dryRun) { console.log(`[DRY] X tweet: ${text.slice(0, 80)}… media=${mediaId ?? 'none'}`); return true }
  const url = 'https://api.twitter.com/2/tweets'
  const body = { text }
  if (mediaId) body.media = { media_ids: [mediaId] }
  const r = await fetch(url, { method: 'POST',
    headers: { Authorization: oauthHeader('POST', url), 'Content-Type': 'application/json' },
    body: JSON.stringify(body) })
  if (!r.ok) console.error('X tweet failed', r.status, await r.text())
  return r.ok
}
