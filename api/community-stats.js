// GET /api/community-stats — Telegram member count + live social stats
// ?quick=true  — Telegram only (used by 60s auto-refresh in admin dashboard)
// (no param)   — full: Telegram + X followers + engagement + last post (5-min refresh)

const SUPABASE_URL = 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'

async function sbGet(table, query = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
  return r.json()
}

export default async function handler(req, res) {
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
