// GET/POST /api/content-generator
// Cron: every Monday 8am UTC — generates @CryptoFitJim week + @temptationtoken 3x/day posts
// POST { force: true }       — regenerate all pending posts for this week
// POST { tts_bootstrap: true } — generate/replace only TTS posts for this week

import Anthropic from '@anthropic-ai/sdk'

const SUPABASE_URL = 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'
const VOTING_ADDRESS = '0xbc54432BB2D1Ef95e940e024dA604dbb9e9846F8'
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

function getWeekStart(from = new Date()) {
  const d = new Date(from)
  const day = d.getUTCDay()
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

// ── @temptationtoken templates ────────────────────────────────────────────────
// data: { roundId, pool, voters, profiles }
// pool = formatted TTS string e.g. "12,450"

const TTS_MORNING = {
  monday:    d => `🔥 Round ${d.roundId} is OFFICIALLY LIVE. ${d.profiles} profiles. ${d.pool} $TTS up for grabs. Who's walking away with 35%? Voting starts NOW → app.temptationtoken.io $TTS #Base #Crypto #VoteToEarn`,
  tuesday:   d => `📊 MIDWEEK CHECK: ${d.pool} $TTS already in the pool. ${d.voters} unique voters. The competition is HEATING UP. Don't sleep on this. → app.temptationtoken.io $TTS`,
  wednesday: d => `👑 Someone's about to win big $TTS this Sunday. Could be YOU if you're the top voter. Stack your votes → app.temptationtoken.io $TTS #Base`,
  thursday:  d => `⏰ 3 days left in Round ${d.roundId}. Prize pool sitting at ${d.pool} $TTS. Top voter takes 35% AUTOMATICALLY. No middleman. No delays. Just code. $TTS`,
  friday:    d => `🚨 WEEKEND PUSH. Round ${d.roundId} ends Sunday night. Last chance to build your vote stack. Don't finish 2nd. → app.temptationtoken.io $TTS #Crypto`,
  saturday:  _d => `💎 Staking $TTS = bigger votes. Up to 3x multiplier for VIP stakers. Play smarter, not just harder → app.temptationtoken.io $TTS #DeFi #Staking`,
  sunday:    d => `🏁 FINAL HOURS. Round ${d.roundId} closes TONIGHT. Prize pool: ${d.pool} $TTS. Settlement is automatic via Chainlink VRF. Watch live → app.temptationtoken.io $TTS`,
}

const TTS_AFTERNOON = {
  monday:    _d => `New round, new chance. What's your voting strategy this week? Vote big on one profile or spread across multiple? 🤔 $TTS`,
  tuesday:   _d => `The profiles competing this week are 🔥🔥🔥 Go vote before the pool gets too big for your budget → app.temptationtoken.io`,
  wednesday: _d => `Fun fact: every losing vote gets BURNED forever 🔥 That deflationary pressure is real. Stack $TTS before it's gone. #Base #Crypto`,
  thursday:  _d => `We partner with @PolarisProject — 10% of EVERY prize pool funds the fight against human trafficking. Vote and do good. 💙 $TTS`,
  friday:    _d => `No signup. No email. No KYC. Just connect your wallet and vote. Web3 at its finest. app.temptationtoken.io $TTS #Base`,
  saturday:  _d => `Audited by @solidproof_io ✅ Liquidity locked 12 months ✅ Chainlink VRF ✅ This is what a legit crypto project looks like. $TTS`,
  sunday:    _d => `Settlement happens automatically in minutes. Smart contract → Chainlink VRF → winners paid. Zero humans involved. That's the beauty of DeFi. $TTS`,
}

const TTS_EVENING = {
  monday:    d => `The profiles in Round ${d.roundId} are absolutely wild. You need to see this → app.temptationtoken.io 👀 $TTS`,
  tuesday:   d => `Someone voted ${d.topVote} $TTS today alone. Who IS that? The competition is serious this week. 👀 $TTS`,
  wednesday: d => `Halfway through Round ${d.roundId}. Leaderboard is tight. One big vote swing could change EVERYTHING. 💥 $TTS`,
  thursday:  _d => `New profile just approved 👑 Competition just got harder. Check the leaderboard → app.temptationtoken.io $TTS`,
  friday:    _d => `Weekend is here. The grind doesn't stop. See you in the voting booth → app.temptationtoken.io 🔥 $TTS`,
  saturday:  _d => `The most beautiful thing about this game? Nobody can cheat. Chainlink VRF makes it provably fair. Forever. $TTS #Crypto`,
  sunday:    d => `Tomorrow someone wakes up with ${d.topVoterPrize} $TTS in their wallet. Tonight you decide if that's you. → app.temptationtoken.io $TTS 🏆`,
}

const DAYS_STR = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

function buildTTSRows(weekStart, weekStartStr, data) {
  const rows = []
  DAYS_STR.forEach((day, i) => {
    rows.push({
      platform: 'x_tts', post_type: 'tts_morning', day_of_week: i,
      scheduled_at: toISO(weekStart, i, 13),
      content: TTS_MORNING[day](data).slice(0, 280),
      instagram_captions: null, selected_caption: 0, image_hint: null,
      status: 'approved', week_start: weekStartStr
    })
    rows.push({
      platform: 'x_tts', post_type: 'tts_afternoon', day_of_week: i,
      scheduled_at: toISO(weekStart, i, 18),
      content: TTS_AFTERNOON[day](data).slice(0, 280),
      instagram_captions: null, selected_caption: 0, image_hint: null,
      status: 'approved', week_start: weekStartStr
    })
    // 8pm EDT = midnight UTC = next calendar day
    rows.push({
      platform: 'x_tts', post_type: 'tts_evening', day_of_week: i,
      scheduled_at: toISO(weekStart, i + 1, 0),
      content: TTS_EVENING[day](data).slice(0, 280),
      instagram_captions: null, selected_caption: 0, image_hint: null,
      status: 'approved', week_start: weekStartStr
    })
  })
  return rows
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  const forceRegen     = req.method === 'POST' && req.body?.force === true
  const ttsBootstrap   = req.method === 'POST' && req.body?.tts_bootstrap === true

  // --- Fetch round context ---
  let roundId = 1, poolRaw = 0, profileCount = 14, voters = 0, topVoteTTS = 0
  try {
    const r1 = await rpc({ method: 'eth_call', params: [{ to: VOTING_ADDRESS, data: '0x9cbe5efd' }, 'latest'] })
    if (r1 && r1 !== '0x') roundId = parseInt(r1, 16)

    const padded = roundId.toString(16).padStart(64, '0')
    const r2 = await rpc({ method: 'eth_call', params: [{ to: VOTING_ADDRESS, data: '0x8f1327c0' + padded }, 'latest'] })
    if (r2 && r2 !== '0x') {
      const hex = r2.slice(2)
      const chunks = []
      for (let i = 0; i < hex.length; i += 64) chunks.push(hex.slice(i, i + 64))
      poolRaw = Number(BigInt('0x' + chunks[3])) / 1e18
    }

    // Profile count from Supabase
    const subs = await sbGet('submissions', `status=eq.approved&round_id=eq.${roundId}&select=display_name`)
    if (Array.isArray(subs) && subs.length > 0) profileCount = subs.length

    // Voter count + top vote from Supabase votes
    const votes = await sbGet('votes', `round_id=eq.${roundId}&select=voter_wallet,tts_amount`).catch(() => null)
    if (Array.isArray(votes) && votes.length > 0) {
      const wallets = new Set(votes.map(v => v.voter_wallet).filter(Boolean))
      voters = wallets.size
      topVoteTTS = Math.max(...votes.map(v => Number(v.tts_amount) || 0))
    }
  } catch {
    // non-fatal — generate with defaults
  }

  const poolFormatted      = Math.round(poolRaw).toLocaleString()
  const topVoteFormatted   = topVoteTTS > 0 ? Math.round(topVoteTTS).toLocaleString() : 'thousands of'
  const topVoterPrize      = Math.round(poolRaw * 0.35).toLocaleString()
  const profileNames       = `${profileCount} profiles`

  const ttsData = {
    roundId, pool: poolFormatted, voters: voters || '0',
    profiles: profileCount, topVote: topVoteFormatted, topVoterPrize
  }

  const weekStart    = getWeekStart()
  const weekStartStr = weekStart.toISOString().split('T')[0]

  // ── TTS Bootstrap mode: regenerate only x_tts posts ─────────────────────────
  if (ttsBootstrap) {
    await sbDelete('scheduled_posts', `week_start=eq.${weekStartStr}&platform=eq.x_tts`)
    const ttsRows = buildTTSRows(weekStart, weekStartStr, ttsData)
    const insertResp = await sbInsert('scheduled_posts', ttsRows)
    if (!insertResp.ok) {
      const errBody = await insertResp.text()
      return res.status(500).json({ error: 'Supabase insert failed', detail: errBody })
    }
    const preview = ttsRows.slice(0, 3).map(r => ({ time: r.scheduled_at, type: r.post_type, content: r.content }))
    return res.status(200).json({ ok: true, generated: ttsRows.length, weekStart: weekStartStr, roundId, preview })
  }

  // Skip if already generated this week (unless forced)
  if (!forceRegen) {
    const existing = await sbGet('scheduled_posts', `week_start=eq.${weekStartStr}&select=id&limit=1`)
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(200).json({ ok: true, skipped: 'already generated', weekStart: weekStartStr })
    }
  } else {
    await sbDelete('scheduled_posts', `week_start=eq.${weekStartStr}&status=eq.pending`)
    await sbDelete('scheduled_posts', `week_start=eq.${weekStartStr}&platform=eq.x_tts`)
  }

  // --- Generate @CryptoFitJim content via Claude ---
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })
  }

  const prompt = `You are the social media manager for Temptation Token ($TTS), a Web3 "Hot or Not" voting game on Base blockchain. Users vote for profiles by spending $TTS tokens. Stakers earn yield. The game is provocative but SFW. Round schedule: Monday 12:00 AM EDT → Sunday 11:59 PM EDT. Prize split: 35% top voter / 35% winning profile / 10% Polaris charity / 20% house.

Context for this week:
- Round ${roundId} is active
- Profiles: ${profileNames}
- Current pool: ${poolFormatted} $TTS
- App: app.temptationtoken.io
- Community: t.me/TTSCommunityChat
- Bot: t.me/TTSGameBot

Generate a full week of social media content for @CryptoFitJim (personal voice — energetic, personal, passionate). Return ONLY a raw JSON object (no markdown, no explanation):

{
  "x": {
    "monday": "Round start tweet ≤280 chars. End with #TTS #Base",
    "tuesday": "Leaderboard update tweet ≤280 chars. End with #TTS #Base",
    "wednesday": "Midpoint urgency tweet ≤280 chars. End with #TTS #Base",
    "thursday": "Profile spotlight tweet ≤280 chars. End with #TTS #Base",
    "friday": "Weekend push tweet ≤280 chars, 48hrs left. End with #TTS #Base",
    "saturday": "Community engagement tweet ≤280 chars. End with #TTS #Base",
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
      "image_hint": "Describe what visual to use"
    },
    "wednesday": {
      "caption_1": "...", "caption_2": "...", "caption_3": "...", "image_hint": "..."
    },
    "sunday": {
      "caption_1": "...", "caption_2": "...", "caption_3": "...", "image_hint": "..."
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

  // --- Build @CryptoFitJim rows ---
  const JIM_POST_TYPES = ['round_start','leaderboard','midpoint','spotlight','weekend_push','community','round_end']
  const JIM_HOUR       = 19 // 2pm EST (existing schedule)
  const IG_DAYS        = new Set(['monday','wednesday','sunday'])

  const jimRows = []
  DAYS_STR.forEach((day, i) => {
    if (generated.x?.[day]) {
      jimRows.push({
        platform: 'x', post_type: JIM_POST_TYPES[i], day_of_week: i,
        scheduled_at: toISO(weekStart, i, JIM_HOUR),
        content: generated.x[day].slice(0, 280),
        instagram_captions: null, selected_caption: 0, image_hint: null,
        status: 'pending', week_start: weekStartStr
      })
    }
    if (generated.telegram?.[day]) {
      jimRows.push({
        platform: 'telegram', post_type: JIM_POST_TYPES[i], day_of_week: i,
        scheduled_at: toISO(weekStart, i, JIM_HOUR),
        content: generated.telegram[day],
        instagram_captions: null, selected_caption: 0, image_hint: null,
        status: 'pending', week_start: weekStartStr
      })
    }
    if (IG_DAYS.has(day) && generated.instagram?.[day]) {
      const ig = generated.instagram[day]
      const captions = [ig.caption_1, ig.caption_2, ig.caption_3].filter(Boolean)
      jimRows.push({
        platform: 'instagram', post_type: JIM_POST_TYPES[i], day_of_week: i,
        scheduled_at: toISO(weekStart, i, 19),
        content: captions[0] || '',
        instagram_captions: captions, selected_caption: 0, image_hint: ig.image_hint || '',
        status: 'pending', week_start: weekStartStr
      })
    }
  })

  // --- Build @temptationtoken rows (auto-approved, no review needed) ---
  const ttsRows = buildTTSRows(weekStart, weekStartStr, ttsData)

  const allRows = [...jimRows, ...ttsRows]

  const insertResp = await sbInsert('scheduled_posts', allRows)
  if (!insertResp.ok) {
    const errBody = await insertResp.text()
    return res.status(500).json({ error: 'Supabase insert failed', detail: errBody })
  }

  const adminToken = process.env.TELEGRAM_BOT_TOKEN
  await sendTelegram(
    ADMIN_CHAT_ID,
    `📅 This week's content is ready. @CryptoFitJim posts need approval → app.temptationtoken.io/admin\n@temptationtoken: 21 posts auto-approved and scheduled.`,
    adminToken
  )

  return res.status(200).json({
    ok: true, jim_rows: jimRows.length, tts_rows: ttsRows.length,
    total: allRows.length, weekStart: weekStartStr, roundId
  })
}
