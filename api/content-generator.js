// GET/POST /api/content-generator
// Cron: every Monday 8am UTC — generates @temptationtoken posts for the week (3x/day, 21 total)
// POST { force: true }         — regenerate all posts for this week
// POST { tts_bootstrap: true } — same as force for @temptationtoken posts
//
// @CryptoFitJim posts manually — no auto-generation for Jim.

const SUPABASE_URL = 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'
const VOTING_ADDRESS = '0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6'
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
// data: { roundId, pool, voters, profiles, topVote, topVoterPrize }

const TTS_MORNING = {
  monday:    d => `🔥 Round ${d.roundId} is OFFICIALLY LIVE. ${d.profiles} profiles. ${d.pool} $TTS up for grabs. Vote NOW → app.temptationtoken.io $TTS #Base #Crypto #VoteToEarn\n\nWho's your pick this week? 👇`,
  tuesday:   d => `📊 MIDWEEK CHECK: ${d.pool} $TTS already in the pool. ${d.voters} unique voters. The competition is HEATING UP. → app.temptationtoken.io $TTS\n\nWho's your pick this week? 👇`,
  wednesday: d => `👑 Someone's about to win big $TTS this Sunday. Top voter takes 35% automatically — no middleman. Stack your votes → app.temptationtoken.io $TTS #Base\n\nWho's your pick this week? 👇`,
  thursday:  d => `⏰ 3 days left in Round ${d.roundId}. Prize pool: ${d.pool} $TTS. Top voter wins 35% ON-CHAIN. No delays. Just code. → app.temptationtoken.io $TTS\n\nWho's your pick this week? 👇`,
  friday:    d => `🚨 WEEKEND PUSH. Round ${d.roundId} ends Sunday night. Last chance to build your stack. → app.temptationtoken.io $TTS #Crypto\n\nWho's your pick this week? 👇`,
  saturday:  _d => `💎 Staking $TTS = bigger votes. Up to 3x multiplier for VIP stakers. Play smarter → app.temptationtoken.io $TTS #DeFi #Staking\n\nWho's your pick this week? 👇`,
  sunday:    d => `🏁 FINAL HOURS. Round ${d.roundId} closes TONIGHT. ${d.pool} $TTS on the line. Settlement is automatic via Chainlink VRF. → app.temptationtoken.io $TTS\n\nWho's your pick this week? 👇`,
}

const TTS_AFTERNOON = {
  monday:    _d => `New round, new chance. What's your voting strategy this week? Vote big on one profile or spread? 🤔 app.temptationtoken.io $TTS\n\nReply with your wallet — top commenter gets a vote match bonus 🎁`,
  tuesday:   _d => `The profiles competing this week are 🔥🔥🔥 Vote before the pool gets too big for your budget → app.temptationtoken.io $TTS\n\nReply with your wallet — top commenter gets a vote match bonus 🎁`,
  wednesday: _d => `Fun fact: every losing vote gets BURNED forever 🔥 That deflationary pressure is real. Stack $TTS before it's gone. #Base #Crypto $TTS\n\nReply with your wallet — top commenter gets a vote match bonus 🎁`,
  thursday:  _d => `We partner with @PolarisProject — 10% of EVERY prize pool fights human trafficking. Vote and do good 💙 app.temptationtoken.io $TTS\n\nReply with your wallet — top commenter gets a vote match bonus 🎁`,
  friday:    _d => `No signup. No email. No KYC. Connect wallet → vote. Web3 at its finest. app.temptationtoken.io $TTS #Base\n\nReply with your wallet — top commenter gets a vote match bonus 🎁`,
  saturday:  _d => `Audited by @solidproof_io ✅ LP locked 12 months ✅ Chainlink VRF ✅ This is what a legit crypto project looks like. $TTS\n\nReply with your wallet — top commenter gets a vote match bonus 🎁`,
  sunday:    _d => `Settlement happens automatically in minutes. Smart contract → Chainlink VRF → winners paid. Zero humans involved. That's DeFi. $TTS\n\nReply with your wallet — top commenter gets a vote match bonus 🎁`,
}

const TTS_EVENING = {
  monday:    d => `The profiles in Round ${d.roundId} are absolutely wild. You need to see this → app.temptationtoken.io 👀 $TTS\n\nLast chance to vote tonight — who's winning in your bracket? 🔥`,
  tuesday:   d => `Someone voted ${d.topVote} $TTS today alone. Who IS that? The competition is serious this week 👀 $TTS\n\nLast chance to vote tonight — who's winning in your bracket? 🔥`,
  wednesday: d => `Halfway through Round ${d.roundId}. Leaderboard is TIGHT. One big vote swing could change everything 💥 app.temptationtoken.io $TTS\n\nLast chance to vote tonight — who's winning in your bracket? 🔥`,
  thursday:  _d => `New profile just approved 👑 Competition just got harder. Check the leaderboard → app.temptationtoken.io $TTS\n\nLast chance to vote tonight — who's winning in your bracket? 🔥`,
  friday:    _d => `Weekend is here. The grind doesn't stop. See you in the voting booth → app.temptationtoken.io 🔥 $TTS\n\nLast chance to vote tonight — who's winning in your bracket? 🔥`,
  saturday:  _d => `The most beautiful thing about this game? Nobody can cheat. Chainlink VRF = provably fair. Forever. $TTS #Crypto\n\nLast chance to vote tonight — who's winning in your bracket? 🔥`,
  sunday:    d => `Tomorrow someone wakes up with ${d.topVoterPrize} $TTS in their wallet. Tonight you decide if that's you. → app.temptationtoken.io $TTS 🏆\n\nLast chance to vote tonight — who's winning in your bracket? 🔥`,
}

const DAYS_STR = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

function buildTTSRows(weekStart, weekStartStr, data) {
  const rows = []
  DAYS_STR.forEach((day, i) => {
    // 9am EDT = 13:00 UTC (morning)
    rows.push({
      platform: 'x_tts', post_type: 'tts_morning', day_of_week: i,
      scheduled_at: toISO(weekStart, i, 13),
      content: TTS_MORNING[day](data).slice(0, 280),
      instagram_captions: null, selected_caption: 0, image_hint: null,
      status: 'approved', week_start: weekStartStr
    })
    // 2pm EDT = 18:00 UTC (afternoon)
    rows.push({
      platform: 'x_tts', post_type: 'tts_afternoon', day_of_week: i,
      scheduled_at: toISO(weekStart, i, 18),
      content: TTS_AFTERNOON[day](data).slice(0, 280),
      instagram_captions: null, selected_caption: 0, image_hint: null,
      status: 'approved', week_start: weekStartStr
    })
    // 8pm EDT = 00:00 UTC next calendar day
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

  const forceRegen   = req.method === 'POST' && (req.body?.force === true || req.body?.tts_bootstrap === true)

  // --- Fetch round context from chain + Supabase ---
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

    const subs = await sbGet('submissions', `status=eq.approved&round_id=eq.${roundId}&select=display_name`)
    if (Array.isArray(subs) && subs.length > 0) profileCount = subs.length

    const votes = await sbGet('votes', `round_id=eq.${roundId}&select=voter_wallet,tts_amount`).catch(() => null)
    if (Array.isArray(votes) && votes.length > 0) {
      const wallets = new Set(votes.map(v => v.voter_wallet).filter(Boolean))
      voters = wallets.size
      topVoteTTS = Math.max(...votes.map(v => Number(v.tts_amount) || 0))
    }
  } catch {
    // non-fatal — use defaults
  }

  const poolFormatted    = Math.round(poolRaw).toLocaleString()
  const topVoteFormatted = topVoteTTS > 0 ? Math.round(topVoteTTS).toLocaleString() : 'thousands of'
  const topVoterPrize    = Math.round(poolRaw * 0.35).toLocaleString()

  const ttsData = {
    roundId, pool: poolFormatted, voters: voters || '0',
    profiles: profileCount, topVote: topVoteFormatted, topVoterPrize
  }

  const weekStart    = getWeekStart()
  const weekStartStr = weekStart.toISOString().split('T')[0]

  // Skip if already generated this week (unless forced)
  if (!forceRegen) {
    const existing = await sbGet('scheduled_posts', `week_start=eq.${weekStartStr}&platform=eq.x_tts&select=id&limit=1`)
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(200).json({ ok: true, skipped: 'already generated', weekStart: weekStartStr })
    }
  } else {
    await sbDelete('scheduled_posts', `week_start=eq.${weekStartStr}&platform=eq.x_tts`)
  }

  // Build and insert TTS rows
  const ttsRows = buildTTSRows(weekStart, weekStartStr, ttsData)
  const insertResp = await sbInsert('scheduled_posts', ttsRows)
  if (!insertResp.ok) {
    const errBody = await insertResp.text()
    return res.status(500).json({ error: 'Supabase insert failed', detail: errBody })
  }

  const adminToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BROADCAST_BOT_TOKEN
  await sendTelegram(
    ADMIN_CHAT_ID,
    `📅 Week of ${weekStartStr}: ${ttsRows.length} @temptationtoken posts scheduled (auto-approved). Round ${roundId} · Pool: ${poolFormatted} $TTS`,
    adminToken
  )

  return res.status(200).json({
    ok: true, tts_rows: ttsRows.length, weekStart: weekStartStr, roundId,
    preview: ttsRows.slice(0, 3).map(r => ({ time: r.scheduled_at, type: r.post_type, content: r.content }))
  })
}
