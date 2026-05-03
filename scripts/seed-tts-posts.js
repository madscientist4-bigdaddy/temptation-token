// Generates this week's @temptationtoken posts and inserts into Supabase
// Run: node scripts/seed-tts-posts.js

const SUPABASE_URL = 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'
const VOTING_ADDRESS = '0xbc54432BB2D1Ef95e940e024dA604dbb9e9846F8'

async function sbGet(table, query = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
  return r.json()
}

async function sbDelete(table, query) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
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

async function rpc(data) {
  const r = await fetch('https://mainnet.base.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, ...data })
  })
  const j = await r.json()
  return j.result
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

const DAYS_STR = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

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

async function main() {
  console.log('Fetching round data from chain...')

  let roundId = 1, poolRaw = 0, profileCount = 14, voters = 0, topVoteTTS = 0

  try {
    const r1 = await rpc({ method: 'eth_call', params: [{ to: VOTING_ADDRESS, data: '0x9cbe5efd' }, 'latest'] })
    if (r1 && r1 !== '0x') roundId = parseInt(r1, 16)
    console.log(`  Round ID: ${roundId}`)

    const padded = roundId.toString(16).padStart(64, '0')
    const r2 = await rpc({ method: 'eth_call', params: [{ to: VOTING_ADDRESS, data: '0x8f1327c0' + padded }, 'latest'] })
    if (r2 && r2 !== '0x') {
      const hex = r2.slice(2)
      const chunks = []
      for (let i = 0; i < hex.length; i += 64) chunks.push(hex.slice(i, i + 64))
      poolRaw = Number(BigInt('0x' + chunks[3])) / 1e18
    }
    console.log(`  Pool: ${Math.round(poolRaw).toLocaleString()} TTS`)

    const subs = await sbGet('submissions', `status=eq.approved&round_id=eq.${roundId}&select=id`)
    if (Array.isArray(subs) && subs.length > 0) profileCount = subs.length
    console.log(`  Profiles: ${profileCount}`)

    const votes = await sbGet('votes', `round_id=eq.${roundId}&select=voter_wallet,tts_amount`).catch(() => null)
    if (Array.isArray(votes) && votes.length > 0) {
      voters = new Set(votes.map(v => v.voter_wallet).filter(Boolean)).size
      topVoteTTS = Math.max(...votes.map(v => Number(v.tts_amount) || 0))
    }
    console.log(`  Voters: ${voters}, Top vote: ${topVoteTTS}`)
  } catch (e) {
    console.log('  Chain fetch failed, using defaults:', e.message)
  }

  const poolFormatted    = Math.round(poolRaw).toLocaleString()
  const topVoteFormatted = topVoteTTS > 0 ? Math.round(topVoteTTS).toLocaleString() : 'thousands of'
  const topVoterPrize    = Math.round(poolRaw * 0.35).toLocaleString()

  const data = { roundId, pool: poolFormatted, voters: voters || '0', profiles: profileCount, topVote: topVoteFormatted, topVoterPrize }

  const weekStart    = getWeekStart()
  const weekStartStr = weekStart.toISOString().split('T')[0]
  console.log(`\nWeek start: ${weekStartStr}`)

  // Delete existing x_tts posts for this week
  console.log('Clearing existing TTS posts...')
  await sbDelete('scheduled_posts', `week_start=eq.${weekStartStr}&platform=eq.x_tts`)

  // Build rows
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
    rows.push({
      platform: 'x_tts', post_type: 'tts_evening', day_of_week: i,
      scheduled_at: toISO(weekStart, i + 1, 0),
      content: TTS_EVENING[day](data).slice(0, 280),
      instagram_captions: null, selected_caption: 0, image_hint: null,
      status: 'approved', week_start: weekStartStr
    })
  })

  console.log(`\nInserting ${rows.length} posts...`)
  const r = await sbInsert('scheduled_posts', rows)
  if (!r.ok) {
    const err = await r.text()
    console.error('Insert failed:', err)
    process.exit(1)
  }
  console.log('✅ Inserted successfully\n')

  // Show first 3
  console.log('━━━ FIRST 3 POSTS ━━━\n')
  rows.slice(0, 3).forEach((p, i) => {
    console.log(`[${i + 1}] ${p.post_type.toUpperCase()} — ${new Date(p.scheduled_at).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} EDT`)
    console.log(`    ${p.content}`)
    console.log()
  })
}

main().catch(console.error)
