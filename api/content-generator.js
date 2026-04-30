// GET/POST /api/content-generator
// Called by Vercel cron every Monday 8am UTC — generates a full week of content
// and saves to the scheduled_posts table. Also callable manually from admin dashboard.

import Anthropic from '@anthropic-ai/sdk'
import crypto from 'crypto'

const SUPABASE_URL = 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'
const VOTING_ADDRESS = '0xEC339baD1900447833C9fe905C4A768D1f0cA912'
const ADMIN_CHAT_ID  = process.env.ADMIN_CHAT_ID || '-5273368658'

async function sbGet(table, query = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
  return r.json()
}

async function sbInsert(table, rows) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal'
    },
    body: JSON.stringify(rows)
  })
}

async function sbDelete(table, query) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
}

async function rpc(data) {
  const r = await fetch('https://mainnet.base.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, ...data })
  })
  const j = await r.json()
  return j.result
}

async function sendTelegram(chatId, text, token) {
  if (!chatId || !token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  }).catch(() => {})
}

// Monday of the current UTC week
function getWeekStart(from = new Date()) {
  const d = new Date(from)
  const day = d.getUTCDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function toISO(weekStart, dayOffset, hour) {
  const d = new Date(weekStart)
  d.setUTCDate(d.getUTCDate() + dayOffset)
  d.setUTCHours(hour, 0, 0, 0)
  return d.toISOString()
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  const forceRegen = req.method === 'POST' && req.body?.force === true

  // --- Fetch round context ---
  let roundId = 1, poolTTS = '0', profileNames = 'new profiles'
  try {
    const r1 = await rpc({ method: 'eth_call', params: [{ to: VOTING_ADDRESS, data: '0x9cbe5efd' }, 'latest'] })
    if (r1 && r1 !== '0x') roundId = parseInt(r1, 16)

    const padded = roundId.toString(16).padStart(64, '0')
    const r2 = await rpc({ method: 'eth_call', params: [{ to: VOTING_ADDRESS, data: '0x8f1327c0' + padded }, 'latest'] })
    if (r2 && r2 !== '0x') {
      const hex = r2.slice(2)
      const chunks = []
      for (let i = 0; i < hex.length; i += 64) chunks.push(hex.slice(i, i + 64))
      poolTTS = Math.round(Number(BigInt('0x' + chunks[3])) / 1e18).toLocaleString()
    }

    const subs = await sbGet('submissions', `status=eq.approved&round_id=eq.${roundId}&select=display_name`)
    if (Array.isArray(subs) && subs.length > 0) {
      profileNames = subs.map(s => s.display_name).join(', ')
    }
  } catch (e) {
    // non-fatal — generate with defaults
  }

  const weekStart    = getWeekStart()
  const weekStartStr = weekStart.toISOString().split('T')[0]

  // Skip if already generated this week (unless forced)
  if (!forceRegen) {
    const existing = await sbGet('scheduled_posts', `week_start=eq.${weekStartStr}&select=id&limit=1`)
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(200).json({ ok: true, skipped: 'already generated', weekStart: weekStartStr })
    }
  } else {
    // Delete existing posts for this week that are still pending
    await sbDelete('scheduled_posts', `week_start=eq.${weekStartStr}&status=eq.pending`)
  }

  // --- Generate content via Claude ---
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })
  }

  const prompt = `You are the social media manager for Temptation Token ($TTS), a Web3 "Hot or Not" voting game on Base blockchain. Users vote for profiles by spending $TTS tokens. Stakers earn yield. The game is provocative but SFW.

Context for this week:
- Round ${roundId} is active
- Profiles: ${profileNames}
- Current pool: ${poolTTS} $TTS
- App: app.temptationtoken.io
- Community: t.me/TTSCommunityChat
- Bot: t.me/TTSGameBot

Generate a full week of social media content. Return ONLY a raw JSON object (no markdown, no explanation):

{
  "x": {
    "monday": "Round start tweet ≤280 chars. End with #TTS #Base",
    "tuesday": "Leaderboard update tweet ≤280 chars. End with #TTS #Base",
    "wednesday": "Midpoint urgency tweet ≤280 chars. End with #TTS #Base",
    "thursday": "Profile spotlight tweet ≤280 chars featuring one of: ${profileNames}. End with #TTS #Base",
    "friday": "Weekend push tweet ≤280 chars, 48hrs left. End with #TTS #Base",
    "saturday": "Community engagement tweet ≤280 chars — ask a question or run a poll. End with #TTS #Base",
    "sunday": "Final hours tweet ≤280 chars. End with #TTS #Base"
  },
  "telegram": {
    "monday": "Round start message. Conversational, emojis, HTML safe, include app link",
    "tuesday": "Leaderboard update. Conversational, emojis",
    "wednesday": "Midpoint urgency. Conversational, emojis, mention pool size",
    "thursday": "Profile spotlight. Conversational, feature a profile",
    "friday": "Weekend push. Conversational, emojis",
    "saturday": "Community question. Engaging, conversational",
    "sunday": "Final hours. Urgency + excitement"
  },
  "instagram": {
    "monday": {
      "caption_1": "Energetic caption for round start reel/post. Include CTA",
      "caption_2": "Mysterious/provocative caption for same post",
      "caption_3": "Playful caption with hashtags #TTS #Web3 #Crypto #Base #NFT",
      "image_hint": "Describe what visual to use (e.g. collage of approved profile photos with vote counter overlay)"
    },
    "wednesday": {
      "caption_1": "...",
      "caption_2": "...",
      "caption_3": "...",
      "image_hint": "..."
    },
    "sunday": {
      "caption_1": "...",
      "caption_2": "...",
      "caption_3": "...",
      "image_hint": "..."
    }
  }
}`

  let generated
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })
    let text = response.content[0].text.trim()
    if (text.includes('```')) text = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    generated = JSON.parse(text)
  } catch (e) {
    return res.status(500).json({ error: 'Generation/parse failed', detail: e.message })
  }

  // --- Build rows ---
  const DAYS        = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const POST_TYPES  = ['round_start','leaderboard','midpoint','spotlight','weekend_push','community','round_end']
  const HOURS       = [19, 19, 19, 19, 19, 19, 19] // 2pm EST (19:00 UTC) daily
  const IG_DAYS     = new Set(['monday','wednesday','sunday'])

  const rows = []

  DAYS.forEach((day, i) => {
    if (generated.x?.[day]) {
      rows.push({
        platform: 'x', post_type: POST_TYPES[i], day_of_week: i,
        scheduled_at: toISO(weekStart, i, HOURS[i]),
        content: generated.x[day].slice(0, 280),
        status: 'pending', week_start: weekStartStr
      })
    }
    if (generated.telegram?.[day]) {
      rows.push({
        platform: 'telegram', post_type: POST_TYPES[i], day_of_week: i,
        scheduled_at: toISO(weekStart, i, HOURS[i]),
        content: generated.telegram[day],
        status: 'pending', week_start: weekStartStr
      })
    }
    if (IG_DAYS.has(day) && generated.instagram?.[day]) {
      const ig = generated.instagram[day]
      const captions = [ig.caption_1, ig.caption_2, ig.caption_3].filter(Boolean)
      rows.push({
        platform: 'instagram', post_type: POST_TYPES[i], day_of_week: i,
        scheduled_at: toISO(weekStart, i, 19),
        content: captions[0] || '',
        instagram_captions: captions,
        selected_caption: 0,
        image_hint: ig.image_hint || '',
        status: 'pending', week_start: weekStartStr
      })
    }
  })

  const insertResp = await sbInsert('scheduled_posts', rows)
  if (!insertResp.ok) {
    const errBody = await insertResp.text()
    return res.status(500).json({ error: 'Supabase insert failed', detail: errBody })
  }

  // Notify admin
  const adminToken = process.env.TELEGRAM_BOT_TOKEN
  await sendTelegram(
    ADMIN_CHAT_ID,
    `📅 This week's content is ready for review → app.temptationtoken.io/admin`,
    adminToken
  )

  return res.status(200).json({ ok: true, generated: rows.length, weekStart: weekStartStr, roundId })
}
