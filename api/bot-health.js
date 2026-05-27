// GET /api/bot-health
// Returns { alive, lastSeen, secAgo } — reads bot_last_heartbeat from admin_config.
// alive = true if last heartbeat was within 10 minutes.
//
// POST /api/bot-health (called by tts_bot.py every 5 min)
// Upserts bot_last_heartbeat timestamp in admin_config.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'

const HEARTBEAT_KEY = 'bot_last_heartbeat'
const STALE_SEC = 600 // 10 minutes — bot pings every 5 min, so 10 min = definitely dead

function sbFetch(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const r = await sbFetch(`/admin_config?key=eq.${HEARTBEAT_KEY}&select=value`)
      const rows = await r.json()
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(200).json({ alive: false, lastSeen: null, secAgo: null })
      }
      const lastSeen = rows[0].value
      const secAgo = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000)
      return res.status(200).json({ alive: secAgo < STALE_SEC, lastSeen, secAgo })
    } catch {
      return res.status(200).json({ alive: false, lastSeen: null, secAgo: null })
    }
  }

  if (req.method === 'POST') {
    const now = new Date().toISOString()
    try {
      await sbFetch('/admin_config', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key: HEARTBEAT_KEY, value: now }),
      })
      return res.status(200).json({ ok: true, recorded: now })
    } catch (e) {
      console.error('bot-health heartbeat write failed:', e.message)
      return res.status(500).json({ error: 'Failed to record heartbeat' })
    }
  }

  return res.status(405).end()
}
