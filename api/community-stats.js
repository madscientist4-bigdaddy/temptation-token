// GET /api/community-stats — Telegram member count + live social stats + bot health
// ?quick=true  — Telegram only (used by 60s auto-refresh in admin dashboard)
// (no param)   — full: Telegram + X followers + engagement + last post (5-min refresh)
//
// POST /api/community-stats?action=heartbeat — records bot heartbeat in admin_config
// GET  /api/community-stats?action=heartbeat — returns { alive, lastSeen, secAgo }
// (mapped from /api/bot-health via vercel.json rewrite)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'

async function sbGet(table, query = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
  return r.json()
}

const HEARTBEAT_KEY = 'bot_last_heartbeat'
const HEARTBEAT_STALE_SEC = 600

export default async function handler(req, res) {
  // ── Bot heartbeat (from /api/bot-health rewrite) ────────────────────────
  if (req.query?.action === 'heartbeat') {
    if (req.method === 'POST') {
      const now = new Date().toISOString()
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/admin_config`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify({ key: HEARTBEAT_KEY, value: now }),
        })
        return res.status(200).json({ ok: true, recorded: now })
      } catch (e) {
        return res.status(500).json({ error: 'Failed to record heartbeat' })
      }
    }
    if (req.method === 'GET') {
      try {
        const r = await sbGet('admin_config', `key=eq.${HEARTBEAT_KEY}&select=value`)
        if (!Array.isArray(r) || r.length === 0) return res.status(200).json({ alive: false, lastSeen: null, secAgo: null })
        const lastSeen = r[0].value
        const secAgo   = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000)
        return res.status(200).json({ alive: secAgo < HEARTBEAT_STALE_SEC, lastSeen, secAgo })
      } catch {
        return res.status(200).json({ alive: false, lastSeen: null, secAgo: null })
      }
    }
    return res.status(405).end()
  }

  const quick = req.query?.quick === 'true'

  // ── Telegram member count (always) ────────────────────────────────────────────
  const token  = process.env.BROADCAST_BOT_TOKEN
  const chatId = process.env.COMMUNITY_CHAT_ID || '-1003930752060'
  let members = null
  if (token) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getChatMembersCount?chat_id=${chatId}`)
      const d = await r.json()
      members = d.result || null
    } catch {}
  }

  if (quick) return res.status(200).json({ ok: true, members })

  // ── Full stats: X + engagement + last post ────────────────────────────────────
  const result = { ok: true, members }

  // X app-only Bearer token + public metrics
  const apiKey    = process.env.X_API_KEY
  const apiSecret = process.env.X_API_SECRET
  if (apiKey && apiSecret) {
    try {
      const creds = Buffer.from(
        `${encodeURIComponent(apiKey)}:${encodeURIComponent(apiSecret)}`
      ).toString('base64')
      const tokenR = await fetch('https://api.twitter.com/oauth2/token', {
        method: 'POST',
        headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
      })
      const tokenD = await tokenR.json()
      if (tokenD.access_token) {
        const userR = await fetch(
          'https://api.twitter.com/2/users/by/username/temptationtoken?user.fields=public_metrics',
          { headers: { Authorization: `Bearer ${tokenD.access_token}` } }
        )
        const userD = await userR.json()
        if (userD.data?.public_metrics) {
          result.x_followers   = userD.data.public_metrics.followers_count
          result.x_tweet_count = userD.data.public_metrics.tweet_count
        } else {
          result.x_error = userD.errors?.[0]?.detail || 'X API error'
        }
      } else {
        result.x_error = tokenD.error_description || 'Bearer token fetch failed'
      }
    } catch (e) {
      result.x_error = e.message
    }
  } else {
    result.x_error = 'X credentials not configured'
  }

  // Engagement: votes + unique voters for current round
  try {
    const rounds = await sbGet('rounds', 'order=id.desc&limit=1&select=id')
    if (Array.isArray(rounds) && rounds.length > 0) {
      const roundId = rounds[0].id
      const votes = await sbGet('votes', `round_id=eq.${roundId}&select=voter_wallet`)
      if (Array.isArray(votes)) {
        const uniqueVoters = new Set(votes.map(v => v.voter_wallet).filter(Boolean)).size
        result.votes_this_round = votes.length
        result.unique_voters    = uniqueVoters
        result.round_id         = roundId
      }
    }
  } catch {}

  // Last posted @temptationtoken X post
  try {
    const posts = await sbGet(
      'scheduled_posts',
      'platform=eq.x_tts&status=eq.posted&order=scheduled_at.desc&limit=1&select=content,scheduled_at,post_type'
    )
    if (Array.isArray(posts) && posts.length > 0) result.last_x_post = posts[0]
  } catch {}

  result.fetched_at = new Date().toISOString()
  return res.status(200).json(result)
}
