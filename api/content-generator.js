// GET/POST /api/content-generator
// Cron: every Monday 8am UTC — generates @temptationtoken posts for the week (3x/day, 21 total)
// POST { force: true }      — regenerate: delete pending for this week, re-insert as pending
// POST { dry_run: true }    — generate + return 21 posts in response WITHOUT inserting (for review)
// @CryptoFitJim posts manually — no auto-generation for Jim.
//
// Generated posts inserted with status='pending'. Admin reviews + approves in Content Calendar.

import Anthropic from '@anthropic-ai/sdk'

const SUPABASE_URL   = 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'
const VOTING_ADDRESS = '0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6'
const ADMIN_CHAT_ID  = process.env.ADMIN_CHAT_ID || '-5273368658'

// Solidproof audit publication date — for age calculation in prompt context
const AUDIT_PUBLISHED = new Date('2026-05-06')

// ── Supabase helpers ──────────────────────────────────────────────────────────

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

// ── On-chain RPC ──────────────────────────────────────────────────────────────

async function rpc(data) {
  const r = await fetch('https://mainnet.base.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, ...data })
  })
  const j = await r.json()
  return j.result
}

// ── Telegram ──────────────────────────────────────────────────────────────────

async function sendTelegram(chatId, text, token) {
  if (!chatId || !token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  }).catch(() => {})
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function getWeekStart(from = new Date()) {
  const d = new Date(from)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

// dayOffset=0 → Monday of weekStart; slot=evening uses dayOffset=dayIdx+1 (00:00 UTC next day)
function toISO(weekStart, dayOffset, hour) {
  const d = new Date(weekStart)
  d.setUTCDate(d.getUTCDate() + dayOffset)
  d.setUTCHours(hour, 0, 0, 0)
  return d.toISOString()
}

// ── Live context from Supabase + on-chain ─────────────────────────────────────

async function fetchLiveContext() {
  const ctx = {
    roundId:             1,
    prizePoolTTS:        0,
    settlementTimestamp: null,
    lastWinnerPayoutTTS: 0,
    approvedProfiles:    0,
    totalStakers:        0,
    stakersByTier:       {},
  }

  // Current round ID + settlement time from chain
  try {
    const r1 = await rpc({ method: 'eth_call', params: [{ to: VOTING_ADDRESS, data: '0x9cbe5efd' }, 'latest'] })
    if (r1 && r1 !== '0x') {
      ctx.roundId = parseInt(r1, 16)
      const padded = ctx.roundId.toString(16).padStart(64, '0')
      const r2 = await rpc({ method: 'eth_call', params: [{ to: VOTING_ADDRESS, data: '0x8f1327c0' + padded }, 'latest'] })
      if (r2 && r2 !== '0x') {
        const chunks = []
        for (let i = 2; i < r2.length; i += 64) chunks.push(r2.slice(i, i + 64))
        ctx.settlementTimestamp = parseInt(chunks[1], 16)
      }
    }
  } catch {}

  // Prize pool: sum of all votes this round from Supabase
  try {
    const votes = await sbGet('votes', `round_id=eq.${ctx.roundId}&select=tts_amount`)
    if (Array.isArray(votes) && votes.length > 0) {
      ctx.prizePoolTTS = Math.round(votes.reduce((s, v) => s + (Number(v.tts_amount) || 0), 0))
    }
  } catch {}

  // Last round winner payout: 35% of previous round's pool
  try {
    if (ctx.roundId > 1) {
      const prevVotes = await sbGet('votes', `round_id=eq.${ctx.roundId - 1}&select=tts_amount`)
      if (Array.isArray(prevVotes) && prevVotes.length > 0) {
        const prevPool = prevVotes.reduce((s, v) => s + (Number(v.tts_amount) || 0), 0)
        ctx.lastWinnerPayoutTTS = Math.round(prevPool * 0.35)
      }
    }
  } catch {}

  // Approved profiles competing this round
  try {
    const subs = await sbGet('submissions', `status=eq.approved&round_id=eq.${ctx.roundId}&select=id`)
    ctx.approvedProfiles = Array.isArray(subs) ? subs.length : 0
  } catch {}

  // Active stakers by tier
  try {
    const stakes = await sbGet('stakes', 'select=tier')
    if (Array.isArray(stakes)) {
      ctx.totalStakers = stakes.length
      for (const s of stakes) {
        const tier = s.tier || 'unknown'
        ctx.stakersByTier[tier] = (ctx.stakersByTier[tier] || 0) + 1
      }
    }
  } catch {}

  return ctx
}

// ── Claude generation ─────────────────────────────────────────────────────────

async function generateTweets(ctx) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in Vercel env')

  const client = new Anthropic({ apiKey })

  const settlementStr = ctx.settlementTimestamp
    ? new Date(ctx.settlementTimestamp * 1000).toLocaleString('en-US', {
        timeZone: 'America/New_York', weekday: 'long', month: 'short',
        day: 'numeric', hour: 'numeric', minute: '2-digit'
      }) + ' EDT'
    : 'Sunday 11:59 PM EDT'

  const auditAgeDays = Math.floor((Date.now() - AUDIT_PUBLISHED.getTime()) / 86400000)

  const stakerSummary = Object.entries(ctx.stakersByTier).length > 0
    ? Object.entries(ctx.stakersByTier).map(([tier, count]) => `${count} ${tier}`).join(', ')
    : 'none yet'

  const contextBlock = [
    `Round: ${ctx.roundId}`,
    `Prize pool this round: ${ctx.prizePoolTTS.toLocaleString()} $TTS`,
    `Settlement / round close: ${settlementStr}`,
    ctx.lastWinnerPayoutTTS
      ? `Last round top voter won: ${ctx.lastWinnerPayoutTTS.toLocaleString()} $TTS (35% of pool)`
      : null,
    `Active profiles competing: ${ctx.approvedProfiles}`,
    `Total stakers: ${ctx.totalStakers}${ctx.totalStakers > 0 ? ` (${stakerSummary})` : ''}`,
    `Solidproof audit published: ${auditAgeDays} day${auditAgeDays !== 1 ? 's' : ''} ago`,
    `Chain: Base mainnet`,
    `Staking tiers: Bronze $50+ (8% APR, 1.1x vote boost) · Silver $100+ (12%, 1.25x) · Gold $250+ (18%, 1.5x) · Diamond $1k+ (32%, 2x) · VIP $5k+ (45%, 3x)`,
    `Prize split: 35% top voter · 35% winning profile · 10% charity (@PolarisProject) · 20% house`,
    `LP: 100% locked Team.Finance until May 2027`,
    `Minimum vote: 5 $TTS`,
  ].filter(Boolean).join('\n')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Generate 21 tweets for the upcoming week for @temptationtoken brand account. 3 posts per day, Monday through Sunday.

LIVE PROJECT STATE:
${contextBlock}

Return ONLY a valid JSON array with exactly 21 objects. No preamble, no explanation, no code fences — just the raw JSON array.

Each object must have exactly these fields:
{"day":"monday","slot":"morning","content":"tweet text here"}

Days (in order): monday, tuesday, wednesday, thursday, friday, saturday, sunday
Slots per day (in order): morning, afternoon, evening

RULES:
- Max 280 characters per tweet — count carefully, this is a hard limit
- Every tweet must include a CTA: "app.temptationtoken.io" and/or "$TTS"
- Brand voice: direct, confident, evidence-based, dopamine-driven urgency
- Zero emoji preferred — max 1 per tweet if genuinely adds impact
- Reference live data (round number, prize pool, profiles, staker count) where natural
- Monday morning: announce the round is live and open for voting
- Mid-week (Wed/Thu): momentum, leaderboard dynamics, mid-round FOMO
- Fri/Sat/Sun: escalating urgency — round closes Sunday 11:59 PM EDT
- Topic rotation across the week: voting mechanics, prize math (35% top voter), staking yield, audit trust, on-chain fairness (Chainlink VRF), charity angle, LP lock
- Avoid repeating the same hook within the same day`
    }]
  })

  const raw = message.content[0]?.text || ''

  // Strip code fences if Claude wrapped it
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error(`Claude did not return a JSON array. Raw: ${raw.slice(0, 300)}`)

  let tweets
  try {
    tweets = JSON.parse(jsonMatch[0])
  } catch (e) {
    throw new Error(`JSON parse failed: ${e.message}. Raw: ${raw.slice(0, 300)}`)
  }

  if (!Array.isArray(tweets) || tweets.length < 21) {
    throw new Error(`Expected 21 tweets, got ${tweets?.length ?? 0}. Raw: ${raw.slice(0, 200)}`)
  }

  return tweets.slice(0, 21)
}

// ── Row builder ───────────────────────────────────────────────────────────────

const SLOT_HOURS = { morning: 13, afternoon: 18, evening: 0 }
const DAY_INDEX  = { monday:0, tuesday:1, wednesday:2, thursday:3, friday:4, saturday:5, sunday:6 }
const POST_TYPES = { morning:'tts_morning', afternoon:'tts_afternoon', evening:'tts_evening' }

function buildRows(tweets, weekStart, weekStartStr) {
  return tweets.map(t => {
    const dayIdx    = DAY_INDEX[t.day] ?? 0
    const hour      = SLOT_HOURS[t.slot] ?? 13
    // Evening posts fire at 00:00 UTC the NEXT calendar day (8pm EDT)
    const dayOffset = t.slot === 'evening' ? dayIdx + 1 : dayIdx
    return {
      platform:           'x_tts',
      post_type:          POST_TYPES[t.slot] || `tts_${t.slot}`,
      day_of_week:        dayIdx,           // Mon-first: Mon=0..Sun=6
      scheduled_at:       toISO(weekStart, dayOffset, hour),
      content:            String(t.content).slice(0, 280),
      instagram_captions: null,
      selected_caption:   0,
      image_hint:         null,
      status:             'pending',        // admin must approve before scheduler fires
      week_start:         weekStartStr,
    }
  })
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  const isDryRun   = req.method === 'POST' && req.body?.dry_run === true
  const forceRegen = req.method === 'POST' && (req.body?.force === true || req.body?.tts_bootstrap === true)

  const weekStart    = getWeekStart()
  const weekStartStr = weekStart.toISOString().split('T')[0]

  // Skip generation if already exists this week (unless force/dry_run)
  if (!forceRegen && !isDryRun) {
    const existing = await sbGet('scheduled_posts', `week_start=eq.${weekStartStr}&platform=eq.x_tts&select=id&limit=1`)
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(200).json({ ok: true, skipped: 'already generated this week', weekStart: weekStartStr })
    }
  }

  // Pull live context from Supabase + on-chain
  const ctx = await fetchLiveContext()

  // Generate with Claude
  let tweets
  try {
    tweets = await generateTweets(ctx)
  } catch (e) {
    console.error('content-generator: Claude generation failed:', e.message)
    return res.status(500).json({ error: 'Claude generation failed', detail: e.message })
  }

  const rows = buildRows(tweets, weekStart, weekStartStr)

  // ── Dry run: return posts for review without inserting ────────────────────
  if (isDryRun) {
    const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
    console.log('\n=== DRY RUN: 21 generated posts ===')
    rows.forEach((r, i) => {
      const day  = DAYS[r.day_of_week]
      const slot = r.post_type.replace('tts_', '')
      console.log(`\n[${i+1}] ${day} ${slot} (${r.scheduled_at}) [${r.content.length}ch]\n${r.content}`)
    })
    console.log('\n=== END DRY RUN ===\n')
    return res.status(200).json({
      ok: true, dry_run: true, generated: rows.length,
      context: { roundId: ctx.roundId, prizePoolTTS: ctx.prizePoolTTS, approvedProfiles: ctx.approvedProfiles, totalStakers: ctx.totalStakers },
      weekStart: weekStartStr,
      posts: rows.map((r, i) => ({
        n:            i + 1,
        day:          DAYS[r.day_of_week],
        slot:         r.post_type.replace('tts_', ''),
        scheduled_at: r.scheduled_at,
        chars:        r.content.length,
        content:      r.content,
      }))
    })
  }

  // ── Delete existing pending posts if regenerating ─────────────────────────
  if (forceRegen) {
    await sbDelete('scheduled_posts', `week_start=eq.${weekStartStr}&platform=eq.x_tts&status=in.(pending,rejected)`)
  }

  // ── Insert all 21 posts as pending ────────────────────────────────────────
  const insertResp = await sbInsert('scheduled_posts', rows)
  if (!insertResp.ok) {
    const errBody = await insertResp.text()
    return res.status(500).json({ error: 'Supabase insert failed', detail: errBody })
  }

  // ── Telegram admin alert ──────────────────────────────────────────────────
  const adminToken = process.env.BROADCAST_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  await sendTelegram(
    ADMIN_CHAT_ID,
    `📅 <b>21 posts ready for review</b>\nWeek of ${weekStartStr} · Round ${ctx.roundId} · Pool: ${ctx.prizePoolTTS.toLocaleString()} $TTS\n\nApprove at <a href="https://app.temptationtoken.io/admin">app.temptationtoken.io/admin</a> → Content Calendar`,
    adminToken
  )

  console.log(`content-generator: inserted ${rows.length} pending posts for week of ${weekStartStr}`)

  return res.status(200).json({
    ok: true, generated: rows.length, weekStart: weekStartStr,
    roundId: ctx.roundId, prizePoolTTS: ctx.prizePoolTTS,
    preview: rows.slice(0, 3).map(r => ({ time: r.scheduled_at, type: r.post_type, chars: r.content.length, content: r.content }))
  })
}
