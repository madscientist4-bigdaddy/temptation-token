// GET/POST /api/content-generator
// Cron: every Monday 8am UTC — generates @temptationtoken posts for the week (3x/day, 21 slots)
// Each slot produces ONE X post + ONE Telegram post → 42 rows inserted per run.
//
// POST { force: true }     — delete pending/rejected for this week, regenerate
// POST { dry_run: true }   — generate + return 42 posts in response WITHOUT inserting
// POST { tts_bootstrap: true } — same as force
//
// All posts inserted with status='pending'. Admin must approve in Content Calendar.
// If Anthropic API fails, falls back to 21 static template pairs.

import Anthropic from '@anthropic-ai/sdk'

const SUPABASE_URL   = 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'
const VOTING_ADDRESS = '0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6'
const ADMIN_CHAT_ID  = process.env.ADMIN_CHAT_ID || '-5273368658'

const AUDIT_PUBLISHED = new Date('2026-05-06')
const LP_LOCKED_DATE  = new Date('2026-05-06')

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
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
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

// dayOffset=0 → Monday of weekStart; evening posts use dayOffset=dayIdx+1 (00:00 UTC next day)
function toISO(weekStart, dayOffset, hour) {
  const d = new Date(weekStart)
  d.setUTCDate(d.getUTCDate() + dayOffset)
  d.setUTCHours(hour, 0, 0, 0)
  return d.toISOString()
}

function daysSince(date) {
  return Math.floor((Date.now() - date.getTime()) / 86400000)
}

// ── Live context ──────────────────────────────────────────────────────────────

async function fetchLiveContext() {
  const ctx = {
    roundId:                    1,
    prizePoolTTS:               0,
    settlementTimestamp:        null,
    lastTopVoterPayoutTTS:      0,
    lastWinnerProfilePayoutTTS: 0,
    approvedProfiles:           0,
    totalStakers:               0,
    stakersByTier:              {},
    auditAgeDays:               daysSince(AUDIT_PUBLISHED),
    lpLockDays:                 daysSince(LP_LOCKED_DATE),
    recentSettlement:           false,
  }

  // Current round ID + settlement timestamp from chain
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

  // Prize pool: sum of all votes this round
  try {
    const votes = await sbGet('votes', `round_id=eq.${ctx.roundId}&select=tts_amount`)
    if (Array.isArray(votes) && votes.length > 0) {
      ctx.prizePoolTTS = Math.round(votes.reduce((s, v) => s + (Number(v.tts_amount) || 0), 0))
    }
  } catch {}

  // Last round payouts: top voter 35%, winning profile 35% of previous round pool
  try {
    if (ctx.roundId > 1) {
      const prevVotes = await sbGet('votes', `round_id=eq.${ctx.roundId - 1}&select=tts_amount`)
      if (Array.isArray(prevVotes) && prevVotes.length > 0) {
        const prevPool = prevVotes.reduce((s, v) => s + (Number(v.tts_amount) || 0), 0)
        ctx.lastTopVoterPayoutTTS      = Math.round(prevPool * 0.35)
        ctx.lastWinnerProfilePayoutTTS = Math.round(prevPool * 0.35)
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

  // Recent settlement: any round settled in the last 7 days
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const settled = await sbGet('rounds', `status=eq.settled&updated_at=gte.${sevenDaysAgo}&select=id&limit=1`)
    ctx.recentSettlement = Array.isArray(settled) && settled.length > 0
  } catch {}

  return ctx
}

// ── Claude generation ─────────────────────────────────────────────────────────

async function generatePosts(ctx) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in Vercel env')

  const client = new Anthropic({ apiKey })

  const settlementStr = ctx.settlementTimestamp
    ? new Date(ctx.settlementTimestamp * 1000).toLocaleString('en-US', {
        timeZone: 'America/New_York', weekday: 'long', month: 'short',
        day: 'numeric', hour: 'numeric', minute: '2-digit'
      }) + ' EDT'
    : 'Sunday 11:59 PM EDT'

  const stakerSummary = Object.entries(ctx.stakersByTier).length > 0
    ? Object.entries(ctx.stakersByTier).map(([tier, n]) => `${n} ${tier}`).join(', ')
    : 'none yet'

  const contextBlock = [
    `Round: ${ctx.roundId}`,
    `Prize pool this round: ${ctx.prizePoolTTS.toLocaleString()} $TTS`,
    `Round closes / settlement: ${settlementStr}`,
    ctx.lastTopVoterPayoutTTS      ? `Last round — top voter won: ${ctx.lastTopVoterPayoutTTS.toLocaleString()} $TTS` : null,
    ctx.lastWinnerProfilePayoutTTS ? `Last round — winning profile won: ${ctx.lastWinnerProfilePayoutTTS.toLocaleString()} $TTS` : null,
    `Active profiles competing: ${ctx.approvedProfiles}`,
    `Total stakers: ${ctx.totalStakers}${ctx.totalStakers > 0 ? ` (${stakerSummary})` : ''}`,
    `Solidproof audit published: ${ctx.auditAgeDays} day${ctx.auditAgeDays !== 1 ? 's' : ''} ago`,
    `LP locked: ${ctx.lpLockDays} day${ctx.lpLockDays !== 1 ? 's' : ''} ago (Team.Finance, until May 2027)`,
    ctx.recentSettlement ? 'Recent settlement: yes — a round settled in the last 7 days' : null,
    `Chain: Base mainnet`,
    `Staking tiers: Bronze $50+ (8% APR, 1.1x) · Silver $100+ (12%, 1.25x) · Gold $250+ (18%, 1.5x) · Diamond $1k+ (32%, 2x) · VIP $5k+ (45%, 3x)`,
    `Prize split: 35% top voter · 35% winning profile · 10% charity (@PolarisProject) · 20% house`,
    `Minimum vote: 5 $TTS · Transfer tax: 1% permanent · Total supply: 69B $TTS (fixed)`,
  ].filter(Boolean).join('\n')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `Generate 21 posts for @temptationtoken brand account for the upcoming week. 3 posts per day, Monday through Sunday.

LIVE PROJECT STATE:
${contextBlock}

Return ONLY a valid JSON array with exactly 21 objects. No preamble, no explanation, no code fences.

Each object must have exactly these fields:
{"day":"monday","slot":"morning","x_content":"tweet text","telegram_content":"HTML telegram text"}

Days (in order): monday, tuesday, wednesday, thursday, friday, saturday, sunday
Slots per day (in order): morning, afternoon, evening

X CONTENT RULES:
- Hard limit: 280 characters — count carefully
- Must include CTA: "app.temptationtoken.io" and/or "$TTS"
- Brand voice: direct, confident, evidence-based, dopamine-driven urgency
- Zero emoji preferred — max 1 per tweet if it adds impact
- Reference live data (round number, prize pool, profiles, staker count) where natural
- Monday morning: round is live and open for voting
- Mid-week: momentum, leaderboard dynamics, mid-round FOMO
- Fri/Sat/Sun: escalating urgency — round closes Sunday 11:59 PM EDT
- Topic rotation: voting mechanics, prize math, staking yield, audit trust, Chainlink VRF, charity, LP lock

TELEGRAM CONTENT RULES:
- Slightly longer form (300–600 characters)
- Use HTML tags: <b> for headers, <i> for emphasis, <a href="https://app.temptationtoken.io"> for CTAs
- End every post with a standalone CTA link line
- Can expand on the X post angle with one additional data point or mechanic
- Match the same topic as the paired X post`
    }]
  })

  const raw = message.content[0]?.text || ''
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error(`Claude did not return a JSON array. Raw: ${raw.slice(0, 300)}`)

  let posts
  try { posts = JSON.parse(jsonMatch[0]) }
  catch (e) { throw new Error(`JSON parse failed: ${e.message}. Raw: ${raw.slice(0, 300)}`) }

  if (!Array.isArray(posts) || posts.length < 21) {
    throw new Error(`Expected 21 posts, got ${posts?.length ?? 0}`)
  }

  return posts.slice(0, 21)
}

// ── Static fallback templates (used if Claude generation fails) ───────────────

const FALLBACK_TEMPLATES = [
  { day:'monday', slot:'morning',
    x_content: 'A new round is live on Temptation Token. Profiles competing. Top voter takes 35% of the entire prize pool. Minimum vote: 5 $TTS. app.temptationtoken.io',
    telegram_content: '<b>New round is live.</b>\n\nProfiles are competing. The top voter wins 35% of the entire prize pool — automatically, on-chain, no claim needed.\n\nMinimum vote: 5 $TTS\n\n<a href="https://app.temptationtoken.io">Vote now at app.temptationtoken.io</a>' },
  { day:'monday', slot:'afternoon',
    x_content: 'Staking $TTS earns 8–45% APR depending on tier. Bronze starts at $50. VIP stakers vote with 3x weight. app.temptationtoken.io $TTS',
    telegram_content: '<b>Stake $TTS while you vote.</b>\n\n• Bronze $50+ — 8% APR, 1.1x vote boost\n• Silver $100+ — 12% APR, 1.25x\n• Gold $250+ — 18% APR, 1.5x\n• Diamond $1k+ — 32% APR, 2x\n• VIP $5k+ — 45% APR, 3x\n\nOne position. Two returns.\n\n<a href="https://app.temptationtoken.io">Start at app.temptationtoken.io</a>' },
  { day:'monday', slot:'evening',
    x_content: 'Solidproof audit complete. LP 100% locked on Team.Finance until May 2027. Verifiable on-chain — not marketing. $TTS app.temptationtoken.io',
    telegram_content: '<b>Temptation Token is audited and locked.</b>\n\nSolidproof audit: complete.\nLP: 100% locked on Team.Finance until May 2027.\nAll contracts verifiable on Base mainnet.\n\nThis is infrastructure, not a promise.\n\n<a href="https://app.temptationtoken.io">Join at app.temptationtoken.io</a>' },
  { day:'tuesday', slot:'morning',
    x_content: 'The top voter wins 35% of the prize pool. One wallet. Not split. Vote heavy on the right profile and collect. app.temptationtoken.io $TTS',
    telegram_content: '<b>35% of every prize pool goes to the top voter.</b>\n\nNot split among voters. Not a raffle. One wallet with the most votes on the winning profile takes it all.\n\nPick correctly. Vote heavy.\n\n<a href="https://app.temptationtoken.io">Vote now at app.temptationtoken.io</a>' },
  { day:'tuesday', slot:'afternoon',
    x_content: 'Bronze tier: $50 minimum, 8% APR, 1.1x vote boost. Lowest entry to staking on $TTS. Tokens compound while you vote. app.temptationtoken.io',
    telegram_content: '<b>$50 is enough to start staking on Temptation Token.</b>\n\nBronze tier: 8% APR + 1.1x vote boost.\nSilver tier: 12% APR + 1.25x vote boost.\n\nYour $TTS earns yield every round, regardless of who wins.\n\n<a href="https://app.temptationtoken.io">Stake at app.temptationtoken.io</a>' },
  { day:'tuesday', slot:'evening',
    x_content: '10% of every prize pool goes to @PolarisProject. Built into the contract — not a pledge. $TTS app.temptationtoken.io',
    telegram_content: '<b>10% of every round funds anti-trafficking work.</b>\n\nTemptation Token sends 10% of every prize pool to @PolarisProject automatically. No discretion. No delay. It\'s in the contract.\n\nYou vote. They receive funding.\n\n<a href="https://app.temptationtoken.io">app.temptationtoken.io</a>' },
  { day:'wednesday', slot:'morning',
    x_content: 'Mid-round. Leaderboard is not settled. Positions shift with every vote. Round closes Sunday 11:59 PM EDT. app.temptationtoken.io $TTS',
    telegram_content: '<b>Mid-round — nothing is decided yet.</b>\n\nThe leaderboard can shift with every new vote. The top voter position can change. There\'s still time to stack votes on the right profile.\n\nRound closes Sunday 11:59 PM EDT.\n\n<a href="https://app.temptationtoken.io">Vote at app.temptationtoken.io</a>' },
  { day:'wednesday', slot:'afternoon',
    x_content: 'Gold tier: $250 minimum, 18% APR, 1.5x vote boost. Three advantages from one position in $TTS. app.temptationtoken.io',
    telegram_content: '<b>Gold tier: the inflection point for $TTS stakers.</b>\n\n$250 minimum. 18% APR. 1.5x vote weight multiplier.\n\nYour votes count 50% more than unstaked wallets. Your $TTS compounds every round.\n\n<a href="https://app.temptationtoken.io">Stake at app.temptationtoken.io</a>' },
  { day:'wednesday', slot:'evening',
    x_content: 'Round closes Sunday. Window to influence the leaderboard is narrowing. Every vote matters now. app.temptationtoken.io $TTS',
    telegram_content: '<b>The window is closing on this round.</b>\n\nRound closes Sunday 11:59 PM EDT. Chainlink VRF settlement fires automatically at close.\n\nIf you haven\'t voted, you\'re leaving prize pool exposure on the table.\n\n<a href="https://app.temptationtoken.io">Vote now at app.temptationtoken.io</a>' },
  { day:'thursday', slot:'morning',
    x_content: 'Every payout on Temptation Token fires automatically on Base mainnet. No claim form. No delay. No admin discretion. $TTS app.temptationtoken.io',
    telegram_content: '<b>On Temptation Token, payouts are automatic.</b>\n\nTop voter, winning profile, charity wallet — all receive funds the moment Chainlink VRF settles. No claim form. No waiting. No admin override.\n\nThis is what on-chain settlement looks like.\n\n<a href="https://app.temptationtoken.io">app.temptationtoken.io</a>' },
  { day:'thursday', slot:'afternoon',
    x_content: 'Chainlink VRF determines the winner. No admin can influence the result after voting closes. Randomness is verifiable on-chain. $TTS app.temptationtoken.io',
    telegram_content: '<b>Chainlink VRF picks the round winner — not us.</b>\n\nVerifiable random function. On-chain proof. No admin key can change the outcome after voting closes.\n\nThat\'s what provably fair means.\n\n<a href="https://app.temptationtoken.io">Verify at app.temptationtoken.io</a>' },
  { day:'thursday', slot:'evening',
    x_content: 'Diamond stakers earn 32% APR and vote with 2x weight every round. $1,000 minimum. Both advantages stack. app.temptationtoken.io $TTS',
    telegram_content: '<b>Diamond tier: the compounding position.</b>\n\n$1,000 minimum. 32% APR. 2x vote weight.\n\nEvery round, your votes count double. Between rounds, your $TTS compounds at 32% annually.\n\n<a href="https://app.temptationtoken.io">app.temptationtoken.io</a>' },
  { day:'friday', slot:'morning',
    x_content: 'LP locked 100% on Team.Finance until May 2027. Verify the lock address yourself. That\'s a constraint, not a commitment. $TTS app.temptationtoken.io',
    telegram_content: '<b>Every LP token is locked until May 2027.</b>\n\n231.3 LP tokens. 100% of the Uniswap V2 pool. Locked on Team.Finance.\n\nThe lock address is public. Check it yourself.\n\n<a href="https://app.temptationtoken.io">app.temptationtoken.io $TTS</a>' },
  { day:'friday', slot:'afternoon',
    x_content: 'Prize split: 35% top voter · 35% winning profile · 10% charity · 20% house. Hardcoded. No adjustments. $TTS app.temptationtoken.io',
    telegram_content: '<b>The prize split is fixed in the smart contract.</b>\n\n• 35% → Top voter\n• 35% → Winning profile\n• 10% → @PolarisProject\n• 20% → House\n\nNo discretion. No surprises. Read the contract.\n\n<a href="https://app.temptationtoken.io">app.temptationtoken.io</a>' },
  { day:'friday', slot:'evening',
    x_content: 'Silver tier: $100 minimum, 12% APR, 1.25x vote boost. One of the tightest yield-per-dollar entries in the staking table. $TTS app.temptationtoken.io',
    telegram_content: '<b>Silver tier: $100 to start compounding.</b>\n\n12% APR. 1.25x vote multiplier. $100 minimum.\n\nYour $TTS earns while you vote. Your votes count more than unstaked wallets.\n\n<a href="https://app.temptationtoken.io">Stake at app.temptationtoken.io</a>' },
  { day:'saturday', slot:'morning',
    x_content: 'Solidproof audit complete. LP locked. Chainlink VRF. Automatic payouts. The proof is public — not marketing. $TTS app.temptationtoken.io',
    telegram_content: '<b>Here is what\'s verifiable about Temptation Token:</b>\n\n• Solidproof audit: complete (public report)\n• LP: 100% locked Team.Finance until May 2027\n• Settlement: Chainlink VRF — no admin influence\n• Payouts: automatic on Base mainnet\n\nAll of it is on-chain. Check it yourself.\n\n<a href="https://app.temptationtoken.io">app.temptationtoken.io</a>' },
  { day:'saturday', slot:'afternoon',
    x_content: 'VIP tier: $5,000 minimum, 45% APR, 3x vote weight. The maximum position in Temptation Token staking. $TTS app.temptationtoken.io',
    telegram_content: '<b>VIP tier: the top of the staking table.</b>\n\n$5,000 minimum. 45% APR. 3x vote weight.\n\nYour votes count three times as much as unstaked wallets. Your $TTS compounds at the highest rate in the protocol.\n\n<a href="https://app.temptationtoken.io">app.temptationtoken.io</a>' },
  { day:'saturday', slot:'evening',
    x_content: 'Every round: profiles compete, votes determine the leader, Chainlink VRF settles, payouts fire automatically. That\'s the full loop. $TTS app.temptationtoken.io',
    telegram_content: '<b>How Temptation Token works:</b>\n\n1. Profiles compete each week\n2. Voters spend $TTS to vote\n3. Round closes Sunday 11:59 PM EDT\n4. Chainlink VRF picks the winner\n5. Payouts fire to top voter, winner, charity, house — automatically\n\n<a href="https://app.temptationtoken.io">Vote at app.temptationtoken.io</a>' },
  { day:'sunday', slot:'morning',
    x_content: 'New round opens Monday. If you\'re not staked, you enter with no vote multiplier. app.temptationtoken.io $TTS',
    telegram_content: '<b>New round opens Monday.</b>\n\nStakers enter with a vote multiplier from the first vote. Unstaked wallets vote at base weight.\n\nStake before Monday to maximise your position in the next round.\n\n<a href="https://app.temptationtoken.io">Stake at app.temptationtoken.io</a>' },
  { day:'sunday', slot:'afternoon',
    x_content: 'The top voter earns as much as the winning profile — 35% each. You don\'t need to compete. You need to pick correctly. $TTS app.temptationtoken.io',
    telegram_content: '<b>Voters earn as much as winners on Temptation Token.</b>\n\nTop voter: 35% of the prize pool.\nWinning profile: 35% of the prize pool.\n\nYou don\'t have to be on camera. You have to pick correctly and vote heavy.\n\n<a href="https://app.temptationtoken.io">Vote at app.temptationtoken.io</a>' },
  { day:'sunday', slot:'evening',
    x_content: 'Round closes tonight — Sunday 11:59 PM EDT. After close, voting locks and settlement fires. Last chance. $TTS app.temptationtoken.io',
    telegram_content: '<b>Round closes TONIGHT — Sunday 11:59 PM EDT.</b>\n\nAfter close: voting locks, Chainlink VRF fires, payouts distribute automatically.\n\nIf you haven\'t voted, this is the last window.\n\n<a href="https://app.temptationtoken.io">Vote now at app.temptationtoken.io</a>' },
]

// ── Row builder — 42 rows (21 X + 21 Telegram) ───────────────────────────────

const SLOT_HOURS  = { morning: 13, afternoon: 18, evening: 0 }
const DAY_INDEX   = { monday:0, tuesday:1, wednesday:2, thursday:3, friday:4, saturday:5, sunday:6 }
const POST_TYPES  = { morning:'tts_morning', afternoon:'tts_afternoon', evening:'tts_evening' }

function buildRows(posts, weekStart, weekStartStr) {
  const rows = []
  for (const t of posts) {
    const dayIdx    = DAY_INDEX[t.day] ?? 0
    const hour      = SLOT_HOURS[t.slot] ?? 13
    const dayOffset = t.slot === 'evening' ? dayIdx + 1 : dayIdx
    const scheduled_at = toISO(weekStart, dayOffset, hour)
    const post_type    = POST_TYPES[t.slot] || `tts_${t.slot}`
    const common = { post_type, day_of_week: dayIdx, scheduled_at, instagram_captions: null, selected_caption: 0, image_hint: null, status: 'pending', week_start: weekStartStr }

    rows.push({ ...common, platform: 'x_tts',    content: String(t.x_content).slice(0, 280) })
    rows.push({ ...common, platform: 'telegram',  content: String(t.telegram_content).slice(0, 1024) })
  }
  return rows  // 42 rows: 21 X + 21 Telegram, paired by slot
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  const isDryRun   = req.method === 'POST' && req.body?.dry_run === true
  const forceRegen = req.method === 'POST' && (req.body?.force === true || req.body?.tts_bootstrap === true)

  const weekStart    = getWeekStart()
  const weekStartStr = weekStart.toISOString().split('T')[0]

  // Skip if already generated this week (unless force/dry_run)
  if (!forceRegen && !isDryRun) {
    const existing = await sbGet('scheduled_posts', `week_start=eq.${weekStartStr}&platform=eq.x_tts&select=id&limit=1`)
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(200).json({ ok: true, skipped: 'already generated this week', weekStart: weekStartStr })
    }
  }

  const ctx = await fetchLiveContext()

  // ── Generate with Claude; fall back to static templates on failure ────────
  let posts
  let usedFallback = false

  try {
    posts = await generatePosts(ctx)
  } catch (e) {
    console.error('content-generator: Claude generation failed — using fallback templates:', e.message)
    posts = FALLBACK_TEMPLATES
    usedFallback = true

    // Alert admin that fallback was triggered
    const adminToken = process.env.BROADCAST_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
    await sendTelegram(
      ADMIN_CHAT_ID,
      `⚠️ <b>Content generator AI fallback triggered — using templates this week</b>\nWeek of ${weekStartStr}\nError: ${String(e.message).slice(0, 200)}`,
      adminToken
    )
  }

  const rows = buildRows(posts, weekStart, weekStartStr)  // 42 rows

  // ── Dry run: return posts for review without inserting ────────────────────
  if (isDryRun) {
    const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
    console.log(`\n=== DRY RUN: ${rows.length} generated rows (${rows.length / 2} X + ${rows.length / 2} Telegram) ===`)
    for (let i = 0; i < rows.length; i += 2) {
      const x = rows[i]
      const tg = rows[i + 1]
      const day  = DAYS[x.day_of_week]
      const slot = x.post_type.replace('tts_', '')
      console.log(`\n[${(i / 2) + 1}] ${day} ${slot} (${x.scheduled_at})`)
      console.log(`  X  [${x.content.length}ch]: ${x.content}`)
      console.log(`  TG [${tg.content.length}ch]: ${tg.content.replace(/<[^>]+>/g, '').slice(0, 120)}...`)
    }
    console.log('\n=== END DRY RUN ===\n')
    return res.status(200).json({
      ok: true, dry_run: true, generated: rows.length, used_fallback: usedFallback,
      context: { roundId: ctx.roundId, prizePoolTTS: ctx.prizePoolTTS, approvedProfiles: ctx.approvedProfiles, totalStakers: ctx.totalStakers, lpLockDays: ctx.lpLockDays, auditAgeDays: ctx.auditAgeDays },
      weekStart: weekStartStr,
      posts: rows.map((r, i) => ({
        n:            Math.floor(i / 2) + 1,
        platform:     r.platform,
        day:          ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'][r.day_of_week],
        slot:         r.post_type.replace('tts_', ''),
        scheduled_at: r.scheduled_at,
        chars:        r.content.length,
        content:      r.content,
      }))
    })
  }

  // ── Delete existing pending/rejected posts if regenerating ────────────────
  if (forceRegen) {
    await sbDelete('scheduled_posts', `week_start=eq.${weekStartStr}&status=in.(pending,rejected)`)
  }

  // ── Insert all 42 rows as pending ─────────────────────────────────────────
  const insertResp = await sbInsert('scheduled_posts', rows)
  if (!insertResp.ok) {
    const errBody = await insertResp.text()
    return res.status(500).json({ error: 'Supabase insert failed', detail: errBody })
  }

  // ── Telegram admin alert ──────────────────────────────────────────────────
  const adminToken = process.env.BROADCAST_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const fallbackNote = usedFallback ? ' (⚠️ AI fallback — static templates)' : ''
  await sendTelegram(
    ADMIN_CHAT_ID,
    `📅 <b>21 X + 21 Telegram posts ready for review${fallbackNote}</b>\nWeek of ${weekStartStr} · Round ${ctx.roundId} · Pool: ${ctx.prizePoolTTS.toLocaleString()} $TTS\n\nApprove at <a href="https://app.temptationtoken.io/admin">app.temptationtoken.io/admin</a> → Content Calendar\n\nReview by Sunday 8pm EDT to keep next week\'s queue armed.`,
    adminToken
  )

  console.log(`content-generator: inserted ${rows.length} pending posts (${rows.length / 2} X + ${rows.length / 2} Telegram) for week of ${weekStartStr}${usedFallback ? ' [FALLBACK]' : ''}`)

  return res.status(200).json({
    ok: true, generated: rows.length, x_posts: rows.length / 2, telegram_posts: rows.length / 2,
    used_fallback: usedFallback, weekStart: weekStartStr,
    roundId: ctx.roundId, prizePoolTTS: ctx.prizePoolTTS,
    preview: rows.slice(0, 4).map(r => ({ platform: r.platform, time: r.scheduled_at, type: r.post_type, chars: r.content.length, content: r.content }))
  })
}
