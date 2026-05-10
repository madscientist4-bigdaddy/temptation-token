// GET/POST /api/content-generator
// Cron: every Monday 8am UTC
// Output per run:
//   21 X posts + 21 Telegram posts (3/day × 7 days) → status='pending'
//    7 Instagram posts (1/day × 7 days)              → status='pending'
//   Total: 49 rows inserted into scheduled_posts
//
// POST { force: true | tts_bootstrap: true } — delete pending/rejected for this week, regenerate
// POST { dry_run: true }                      — generate + return all 49 posts, do NOT insert
//
// On Claude failure: falls back to 21 static X/TG template pairs + 7 static IG templates;
//   sends Telegram admin alert.

import Anthropic from '@anthropic-ai/sdk'

const SUPABASE_URL   = 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'
const VOTING_ADDRESS = '0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6'
const ADMIN_CHAT_ID  = process.env.ADMIN_CHAT_ID || '-5273368658'

const AUDIT_PUBLISHED = new Date('2026-05-06')
const LP_LOCKED_DATE  = new Date('2026-05-06')

// ── Supabase ──────────────────────────────────────────────────────────────────

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

function toISO(weekStart, dayOffset, hour) {
  const d = new Date(weekStart)
  d.setUTCDate(d.getUTCDate() + dayOffset)
  d.setUTCHours(hour, 0, 0, 0)
  return d.toISOString()
}

function daysSince(date) {
  return Math.floor((Date.now() - date.getTime()) / 86400000)
}

// Computes "Sunday, May 10, 11:59 PM EDT" for the next upcoming round close
function nextRoundCloseStr() {
  const utcMs   = Date.now()
  const edtMs   = utcMs - 4 * 3600000           // EDT = UTC-4
  const edtDate = new Date(edtMs)
  const edtDow  = edtDate.getUTCDay()            // 0=Sun … 6=Sat
  const edtHour = edtDate.getUTCHours()
  const edtMin  = edtDate.getUTCMinutes()

  // Days until the next Sunday 11:59 PM EDT
  let daysToSunday
  if (edtDow === 0) {
    // Today is Sunday — still open if before 11:59 PM, otherwise next week
    daysToSunday = (edtHour < 23 || (edtHour === 23 && edtMin < 59)) ? 0 : 7
  } else {
    daysToSunday = 7 - edtDow
  }

  // Build Sunday 23:59 in EDT offset space, then convert back to UTC for formatting
  const edtClose = new Date(edtMs)
  edtClose.setUTCDate(edtClose.getUTCDate() + daysToSunday)
  edtClose.setUTCHours(23, 59, 0, 0)
  const utcClose = new Date(edtClose.getTime() + 4 * 3600000)

  const datePart = utcClose.toLocaleString('en-US', {
    timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric',
  })
  return `${datePart}, 11:59 PM EDT`
}

// ── Live context ──────────────────────────────────────────────────────────────

async function fetchLiveContext() {
  const ctx = {
    roundId: 1, prizePoolTTS: 0, settlementTimestamp: null,
    lastTopVoterPayoutTTS: 0, lastWinnerProfilePayoutTTS: 0,
    approvedProfiles: 0, totalStakers: 0, stakersByTier: {},
    auditAgeDays: daysSince(AUDIT_PUBLISHED),
    lpLockDays:   daysSince(LP_LOCKED_DATE),
    recentSettlement: false,
    totalSupplyTTS: null,
    stakingLockBehavior: null,
    transferTaxPct: 1,
    transferTaxExemption: 'app.temptationtoken.io and Temptation Token protocol contracts (votes, staking, prize payouts, marketing wallet distributions)',
  }

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

  try {
    const votes = await sbGet('votes', `round_id=eq.${ctx.roundId}&select=tts_amount`)
    if (Array.isArray(votes) && votes.length > 0)
      ctx.prizePoolTTS = Math.round(votes.reduce((s, v) => s + (Number(v.tts_amount) || 0), 0))
  } catch {}

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

  try {
    const subs = await sbGet('submissions', `status=eq.approved&round_id=eq.${ctx.roundId}&select=id`)
    ctx.approvedProfiles = Array.isArray(subs) ? subs.length : 0
  } catch {}

  try {
    const stakes = await sbGet('stakes', 'select=tier')
    if (Array.isArray(stakes)) {
      ctx.totalStakers = stakes.length
      for (const s of stakes) {
        const t = s.tier || 'unknown'
        ctx.stakersByTier[t] = (ctx.stakersByTier[t] || 0) + 1
      }
    }
  } catch {}

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const settled = await sbGet('rounds', `status=eq.settled&updated_at=gte.${sevenDaysAgo}&select=id&limit=1`)
    ctx.recentSettlement = Array.isArray(settled) && settled.length > 0
  } catch {}

  // Live totalSupply from TTS token contract (ERC-20 standard selector 0x18160ddd)
  try {
    const TOKEN_ADDRESS = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
    const raw = await rpc({ method: 'eth_call', params: [{ to: TOKEN_ADDRESS, data: '0x18160ddd' }, 'latest'] })
    if (raw && raw !== '0x') {
      const divisor = BigInt('1000000000000000000')
      ctx.totalSupplyTTS = Number(BigInt(raw) / divisor)
    }
  } catch {}

  // Staking lock behavior — probe common selectors; fall back to codebase-derived description
  // if the UUPS proxy's unverified implementation doesn't respond
  try {
    const STAKING_ADDRESS = '0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc'
    const LOCK_SELECTORS = ['0x3fd8b02f', '0x4e71e0c8', '0x3c7cf0e1', '0x48f30e8c']
    let lockSeconds = 0
    for (const sel of LOCK_SELECTORS) {
      const raw = await rpc({ method: 'eth_call', params: [{ to: STAKING_ADDRESS, data: sel }, 'latest'] })
      if (raw && raw.length === 66) {
        const val = parseInt(raw, 16)
        if (val > 0) { lockSeconds = val; break }
      }
    }
    if (lockSeconds > 0) {
      const days = Math.round(lockSeconds / 86400)
      ctx.stakingLockBehavior = `Time-locked: ${days} days once staked. Staking is available anytime — not tied to round windows.`
    } else {
      // Codebase evidence: lockPd initialized to '3 months'; FAQ says "cannot be accessed early"
      ctx.stakingLockBehavior = 'Time-locked approximately 3 months once staked. Staking is available anytime — not tied to round open/close windows.'
    }
  } catch {
    ctx.stakingLockBehavior = 'Time-locked once staked (duration stored on-chain). Staking is available anytime — not tied to round windows.'
  }

  return ctx
}

// ── Claude generation — returns { posts: 21 weekly, igPosts: 7 instagram } ───

async function generateAllPosts(ctx) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in Vercel env')

  const client = new Anthropic({ apiKey })

  const roundCloseStr = nextRoundCloseStr()

  const stakerSummary = Object.entries(ctx.stakersByTier).length > 0
    ? Object.entries(ctx.stakersByTier).map(([t, n]) => `${n} ${t}`).join(', ')
    : null

  const stakerLine = ctx.totalStakers > 0
    ? `Total stakers: ${ctx.totalStakers} (${stakerSummary})`
    : `Total stakers: 0 — staking slots are open; frame this as opportunity per RULES, never as a negative fact`

  const contextBlock = [
    `Round: ${ctx.roundId}`,
    `Prize pool this round: ${ctx.prizePoolTTS.toLocaleString()} $TTS`,
    `CANONICAL ROUND SCHEDULE (use ONLY these — never invent other times):`,
    `  Round opens: Monday 12:00 AM EDT (every week)`,
    `  Round closes: ${roundCloseStr}`,
    `  Settlement: fires automatically via Chainlink within minutes of round close`,
    ctx.lastTopVoterPayoutTTS      ? `Last round — top voter won: ${ctx.lastTopVoterPayoutTTS.toLocaleString()} $TTS` : null,
    ctx.lastWinnerProfilePayoutTTS ? `Last round — winning profile won: ${ctx.lastWinnerProfilePayoutTTS.toLocaleString()} $TTS` : null,
    `Active profiles competing: ${ctx.approvedProfiles}`,
    stakerLine,
    `Solidproof audit published: ${ctx.auditAgeDays} day${ctx.auditAgeDays !== 1 ? 's' : ''} ago`,
    `LP locked: ${ctx.lpLockDays} day${ctx.lpLockDays !== 1 ? 's' : ''} ago (Team.Finance, until May 2027)`,
    ctx.recentSettlement ? 'A round settled in the last 7 days' : null,
    `Chain: Base mainnet`,
    `Staking: Bronze $50+ (8% APR, 1.1x) · Silver $100+ (12%, 1.25x) · Gold $250+ (18%, 1.5x) · Diamond $1k+ (32%, 2x) · VIP $5k+ (45%, 3x)`,
    `Prize split: 35% top voter · 35% winning profile · 10% charity (@PolarisProject) · 20% house`,
    `Total supply (live on-chain): ${ctx.totalSupplyTTS != null ? ctx.totalSupplyTTS.toLocaleString() + ' TTS' : '69,000,000,000 TTS (fallback)'}`,
    `Staking lock behavior: ${ctx.stakingLockBehavior || 'available anytime, time-locked once staked'}`,
    `Minimum vote: 5 $TTS`,
    `Transfer tax: ${ctx.transferTaxPct}% — permanent, hardcoded, cannot be removed. Exempt: ${ctx.transferTaxExemption}.`,
  ].filter(Boolean).join('\n')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 12000,
    messages: [{
      role: 'user',
      content: `Generate weekly content for @temptationtoken brand account using the live project state below.

LIVE PROJECT STATE:
${contextBlock}

CRITICAL RULES — NEVER VIOLATE THESE:

1. ROUND SCHEDULE — use ONLY the canonical values provided in LIVE PROJECT STATE above:
   - Round opens: Monday 12:00 AM EDT
   - Round closes: the specific date/time in "Round closes:" above (e.g. "Sunday, May 10, 11:59 PM EDT")
   - Settlement fires automatically via Chainlink within minutes of round close
   - NEVER invent or approximate settlement times. NEVER write "closes Wed", "closes at 11:23 PM", or any other time not in the canonical schedule. If a post references round timing, use ONLY the exact close date/time from the live context.

3. STAKING LOCK — staking is NOT tied to round open/close windows. Use the "Staking lock behavior" field above verbatim. NEVER say "staking closes with the round", "stake before the round ends", or imply any staking deadline tied to the round schedule. Staking can happen any day of the week.

4. TRANSFER TAX — the TTS token has a permanent, mandatory 1% transfer tax on ALL transfers EXCEPT those originating from app.temptationtoken.io and the Temptation Token smart contract system itself (votes, staking, prize payouts, marketing wallet distributions). This 1% tax is hardcoded and cannot be removed. Any post that touches tokenomics MUST treat the 1% tax as fact. Posts that write "no tax", "zero tax", or that explain tokenomics without mentioning the 1% tax are FORBIDDEN. Use the "Transfer tax:" field in LIVE PROJECT STATE above — do not soften, omit, or contradict it.

2. ZERO STAKERS — if total stakers = 0, NEVER state this as a current fact or negative. Instead frame it as opportunity:
   - Good: "Be the first Diamond staker — 32% APR and 2x vote weight from day one."
   - Good: "Staking tiers are live and unclaimed. VIP earns 45% APR with 3x vote weight."
   - Bad: "0 stakers" / "no stakers yet" / "staking has no participants"

Return ONLY a valid JSON object — no preamble, no explanation, no code fences. Structure:
{
  "weekly": [21 objects],
  "instagram": [7 objects]
}

────────────────────────────────────────────────
WEEKLY (21 objects — 3 per day Mon–Sun):
Each object: {"day":"monday","slot":"morning","x_content":"tweet","telegram_content":"HTML text"}

Days: monday tuesday wednesday thursday friday saturday sunday
Slots per day (in order): morning afternoon evening

X CONTENT RULES:
- Hard limit: 280 characters
- Must include CTA: "app.temptationtoken.io" and/or "$TTS"
- Brand voice: direct, confident, evidence-based, dopamine-driven urgency
- Zero emoji preferred — max 1 per tweet
- Reference live data where natural
- Monday morning: round is live and open for voting
- Mid-week: leaderboard dynamics, mid-round FOMO
- Fri/Sat/Sun: escalating urgency — round closes Sunday 11:59 PM EDT
- Topic rotation: voting mechanics, prize math, staking yield, audit, Chainlink VRF, charity, LP lock

TELEGRAM CONTENT RULES:
- 300–600 characters
- HTML tags: <b> for headers, <i> for emphasis, <a href="https://app.temptationtoken.io"> for CTA
- End every post with a standalone CTA link line
- Expand on the X post angle with one additional data point or mechanic

────────────────────────────────────────────────
INSTAGRAM (7 objects — 1 per day Mon–Sun):
Each object: {"day":"monday","ig_caption":"long form caption","ig_hashtags":"#TTS #Base ..."}

INSTAGRAM CAPTION RULES:
- 600–1500 characters
- Long-form storytelling / brand narrative, not just a tweet
- Conversational and engaging — this is Instagram, not X
- Can use 2–4 emojis where they add genuine impact
- Must end with: "Vote now → app.temptationtoken.io  $TTS"
- Reference live data (round number, prize pool, profiles, staking tiers) where natural
- Day themes follow the same weekly arc as X posts (Monday = round live, Wednesday = final push, etc.)

INSTAGRAM HASHTAG RULES:
- 25–30 hashtags as a single space-separated string in ig_hashtags
- Mix of: brand (#TemptationToken #TTS), niche (#Base #BaseChain #DeFi #Web3), audience (#CryptoTrading #NFT #Blockchain), reach (#Crypto #Altcoin), charity (#EndHumanTrafficking #PolarisProject)
- Same hashtag block pattern each day with minor rotation`
    }]
  })

  const raw = message.content[0]?.text || ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Claude did not return a JSON object. Raw: ${raw.slice(0, 300)}`)

  let parsed
  try { parsed = JSON.parse(jsonMatch[0]) }
  catch (e) { throw new Error(`JSON parse failed: ${e.message}. Raw: ${raw.slice(0, 300)}`) }

  if (!Array.isArray(parsed.weekly) || parsed.weekly.length < 21)
    throw new Error(`Expected weekly[21], got ${parsed.weekly?.length ?? 0}`)
  if (!Array.isArray(parsed.instagram) || parsed.instagram.length < 7)
    throw new Error(`Expected instagram[7], got ${parsed.instagram?.length ?? 0}`)

  return { posts: parsed.weekly.slice(0, 21), igPosts: parsed.instagram.slice(0, 7) }
}

// ── Static fallback templates ─────────────────────────────────────────────────

const FALLBACK_TEMPLATES = [
  { day:'monday', slot:'morning',
    x_content: 'A new round is live on Temptation Token. Profiles competing. Top voter takes 35% of the entire prize pool. Minimum vote: 5 $TTS. app.temptationtoken.io',
    telegram_content: '<b>New round is live.</b>\n\nProfiles are competing. The top voter wins 35% of the entire prize pool — automatically, on-chain, no claim needed.\n\nMinimum vote: 5 $TTS\n\n<a href="https://app.temptationtoken.io">Vote now at app.temptationtoken.io</a>' },
  { day:'monday', slot:'afternoon',
    x_content: 'Staking $TTS earns 8–45% APR depending on tier. Bronze starts at $50. VIP stakers vote with 3x weight. app.temptationtoken.io $TTS',
    telegram_content: '<b>Stake $TTS while you vote.</b>\n\n• Bronze $50+ — 8% APR, 1.1x vote boost\n• Silver $100+ — 12% APR, 1.25x\n• Gold $250+ — 18% APR, 1.5x\n• Diamond $1k+ — 32% APR, 2x\n• VIP $5k+ — 45% APR, 3x\n\n<a href="https://app.temptationtoken.io">Start at app.temptationtoken.io</a>' },
  { day:'monday', slot:'evening',
    x_content: 'Solidproof audit complete. LP 100% locked on Team.Finance until May 2027. Verifiable on-chain. $TTS app.temptationtoken.io',
    telegram_content: '<b>Temptation Token is audited and locked.</b>\n\nSolidproof audit: complete. LP: 100% locked until May 2027. Verifiable on Base mainnet.\n\n<a href="https://app.temptationtoken.io">Join at app.temptationtoken.io</a>' },
  { day:'tuesday', slot:'morning',
    x_content: 'The top voter wins 35% of the prize pool. One wallet. Not split. Vote heavy on the right profile and collect. app.temptationtoken.io $TTS',
    telegram_content: '<b>35% of every prize pool goes to the top voter.</b>\n\nNot split. Not a raffle. One wallet with the most votes on the winning profile takes it all.\n\n<a href="https://app.temptationtoken.io">Vote now at app.temptationtoken.io</a>' },
  { day:'tuesday', slot:'afternoon',
    x_content: 'Bronze tier: $50 minimum, 8% APR, 1.1x vote boost. Lowest entry to staking on $TTS. Tokens compound while you vote. app.temptationtoken.io',
    telegram_content: '<b>$50 is enough to start staking on Temptation Token.</b>\n\nBronze: 8% APR + 1.1x vote boost. Silver: 12% APR + 1.25x boost.\n\n<a href="https://app.temptationtoken.io">Stake at app.temptationtoken.io</a>' },
  { day:'tuesday', slot:'evening',
    x_content: '10% of every prize pool goes to @PolarisProject. Built into the contract. $TTS app.temptationtoken.io',
    telegram_content: '<b>10% of every round funds anti-trafficking work.</b>\n\nAutomatic. Every round. Built into the smart contract.\n\n<a href="https://app.temptationtoken.io">app.temptationtoken.io</a>' },
  { day:'wednesday', slot:'morning',
    x_content: 'Mid-round. Leaderboard not settled. Round closes Sunday 11:59 PM EDT. app.temptationtoken.io $TTS',
    telegram_content: '<b>Mid-round — nothing is decided yet.</b>\n\nThe leaderboard can shift with every new vote. Round closes Sunday 11:59 PM EDT.\n\n<a href="https://app.temptationtoken.io">Vote at app.temptationtoken.io</a>' },
  { day:'wednesday', slot:'afternoon',
    x_content: 'Gold tier: $250 minimum, 18% APR, 1.5x vote boost. Three advantages from one position. $TTS app.temptationtoken.io',
    telegram_content: '<b>Gold tier: $250+, 18% APR, 1.5x vote multiplier.</b>\n\nYour votes count 50% more than unstaked wallets.\n\n<a href="https://app.temptationtoken.io">Stake at app.temptationtoken.io</a>' },
  { day:'wednesday', slot:'evening',
    x_content: 'Round closes Sunday. Window to influence the leaderboard is narrowing. app.temptationtoken.io $TTS',
    telegram_content: '<b>The window is closing on this round.</b>\n\nRound closes Sunday 11:59 PM EDT. Chainlink VRF settlement fires automatically at close.\n\n<a href="https://app.temptationtoken.io">Vote now at app.temptationtoken.io</a>' },
  { day:'thursday', slot:'morning',
    x_content: 'Every payout fires automatically on Base mainnet. No claim form. No delay. No admin discretion. $TTS app.temptationtoken.io',
    telegram_content: '<b>On Temptation Token, payouts are automatic.</b>\n\nTop voter, winning profile, charity — all receive funds when Chainlink VRF settles. No waiting.\n\n<a href="https://app.temptationtoken.io">app.temptationtoken.io</a>' },
  { day:'thursday', slot:'afternoon',
    x_content: 'Chainlink VRF determines the winner. No admin can influence the result. Verifiable on-chain. $TTS app.temptationtoken.io',
    telegram_content: '<b>Chainlink VRF picks the round winner — not us.</b>\n\nVerifiable random function. On-chain proof. No admin key can change the outcome.\n\n<a href="https://app.temptationtoken.io">Verify at app.temptationtoken.io</a>' },
  { day:'thursday', slot:'evening',
    x_content: 'Diamond stakers earn 32% APR and vote with 2x weight every round. $1,000 minimum. app.temptationtoken.io $TTS',
    telegram_content: '<b>Diamond tier: $1,000+, 32% APR, 2x vote weight.</b>\n\nEvery round your votes count double. Between rounds, your $TTS compounds.\n\n<a href="https://app.temptationtoken.io">app.temptationtoken.io</a>' },
  { day:'friday', slot:'morning',
    x_content: 'LP locked 100% on Team.Finance until May 2027. Verify the lock address yourself. $TTS app.temptationtoken.io',
    telegram_content: '<b>Every LP token is locked until May 2027.</b>\n\n231.3 LP tokens. 100% of the Uniswap V2 pool. The lock address is public.\n\n<a href="https://app.temptationtoken.io">app.temptationtoken.io $TTS</a>' },
  { day:'friday', slot:'afternoon',
    x_content: 'Prize split: 35% top voter · 35% winning profile · 10% charity · 20% house. Hardcoded. $TTS app.temptationtoken.io',
    telegram_content: '<b>The prize split is fixed in the smart contract.</b>\n\n35% top voter · 35% winning profile · 10% @PolarisProject · 20% house.\n\n<a href="https://app.temptationtoken.io">app.temptationtoken.io</a>' },
  { day:'friday', slot:'evening',
    x_content: 'Silver tier: $100 minimum, 12% APR, 1.25x vote boost. $TTS app.temptationtoken.io',
    telegram_content: '<b>Silver tier: $100+, 12% APR, 1.25x vote multiplier.</b>\n\nYour $TTS earns while you vote. Your votes count more than unstaked wallets.\n\n<a href="https://app.temptationtoken.io">Stake at app.temptationtoken.io</a>' },
  { day:'saturday', slot:'morning',
    x_content: 'Solidproof audit complete. LP locked. Chainlink VRF. Automatic payouts. Proof is public. $TTS app.temptationtoken.io',
    telegram_content: '<b>Everything about $TTS is verifiable:</b>\n\n• Solidproof audit: complete\n• LP: locked until May 2027\n• Settlement: Chainlink VRF\n• Payouts: automatic on Base\n\n<a href="https://app.temptationtoken.io">app.temptationtoken.io</a>' },
  { day:'saturday', slot:'afternoon',
    x_content: 'VIP tier: $5,000 minimum, 45% APR, 3x vote weight. $TTS app.temptationtoken.io',
    telegram_content: '<b>VIP tier: $5,000+, 45% APR, 3x vote weight.</b>\n\nYour votes count three times as much as unstaked wallets.\n\n<a href="https://app.temptationtoken.io">app.temptationtoken.io</a>' },
  { day:'saturday', slot:'evening',
    x_content: 'Every round: profiles compete, votes decide, Chainlink VRF settles, payouts fire. $TTS app.temptationtoken.io',
    telegram_content: '<b>How Temptation Token works:</b>\n\n1. Profiles compete 2. Voters cast $TTS 3. Round closes Sunday 11:59 PM EDT 4. Chainlink VRF settles 5. Payouts fire automatically\n\n<a href="https://app.temptationtoken.io">Vote at app.temptationtoken.io</a>' },
  { day:'sunday', slot:'morning',
    x_content: 'New round opens Monday. Not staked = no vote multiplier. app.temptationtoken.io $TTS',
    telegram_content: '<b>New round opens Monday.</b>\n\nStakers enter with a vote multiplier from the first vote. Stake before Monday.\n\n<a href="https://app.temptationtoken.io">Stake at app.temptationtoken.io</a>' },
  { day:'sunday', slot:'afternoon',
    x_content: 'Top voter earns as much as the winning profile — 35% each. Pick correctly. $TTS app.temptationtoken.io',
    telegram_content: '<b>Voters earn as much as winners on Temptation Token.</b>\n\nTop voter: 35%. Winning profile: 35%. Pick correctly and vote heavy.\n\n<a href="https://app.temptationtoken.io">Vote at app.temptationtoken.io</a>' },
  { day:'sunday', slot:'evening',
    x_content: 'Round closes tonight — Sunday 11:59 PM EDT. Last chance. $TTS app.temptationtoken.io',
    telegram_content: '<b>Round closes TONIGHT — Sunday 11:59 PM EDT.</b>\n\nAfter close: voting locks, Chainlink VRF fires, payouts distribute automatically.\n\n<a href="https://app.temptationtoken.io">Vote now at app.temptationtoken.io</a>' },
]

const FALLBACK_IG_TEMPLATES = [
  { day:'monday', ig_caption: 'Round is live on Temptation Token. This week, profiles are competing for a slice of the prize pool — and so are the voters.\n\nThe top voter takes 35% of the entire pool. Not split between voters. Not averaged. One wallet, the one that voted the most on the winning profile, takes 35%.\n\nMinimum to enter: 5 $TTS.\n\nStaking lets you vote with a multiplier. Bronze starts at $50. VIP tier means your votes count 3x. Same round, different leverage.\n\nThe protocol runs on Base mainnet. Solidproof audited. LP locked until May 2027. Payouts fire automatically — no form, no delay.\n\nThis is not a game where the house always wins. 70% of every prize pool goes to the community: the top voter and the winning profile.\n\nVote now → app.temptationtoken.io  $TTS',
    ig_hashtags: '#TemptationToken #TTS #Base #BaseChain #DeFi #Web3 #CryptoTrading #NFT #Blockchain #Crypto #Altcoin #CryptoGems #Web3Gaming #OnChain #BaseNetwork #SolidproofAudit #LPLocked #ChainlinkVRF #TokenLaunch #CryptoVoting #EndHumanTrafficking #PolarisProject #CryptoYield #StakingRewards #DeFiProtocol #BuyBase #CryptoWin #AltcoinSeason #GemAlert #BaseEcosystem' },
  { day:'tuesday', ig_caption: 'The prize split on Temptation Token is fixed in the smart contract. No discretion. No adjustments between rounds.\n\n35% to the top voter. 35% to the winning profile. 10% to the Polaris Project — fighting human trafficking. 20% to the house.\n\n70% flows directly to the people competing. That is not typical in crypto gaming.\n\nChainlink VRF handles randomness. No one on the team can influence who wins. The contract executes. The randomness is verifiable. The payouts happen.\n\nSolidproof audit is published. LP is locked on Team.Finance until May 2027. These are not claims — they are on-chain facts you can verify right now.\n\nVote now → app.temptationtoken.io  $TTS',
    ig_hashtags: '#TemptationToken #TTS #Base #BaseChain #DeFi #Web3 #ChainlinkVRF #SmartContract #CryptoTrading #NFT #Blockchain #Crypto #Web3Gaming #SolidproofAudit #LPLocked #OnChain #DeFiProtocol #CryptoGaming #EndHumanTrafficking #PolarisProject #CryptoYield #BaseNetwork #TokenLaunch #AltcoinSeason #GemAlert #BuyBase #Web3Community #CryptoFair #BlockchainGaming #BaseEcosystem' },
  { day:'wednesday', ig_caption: 'We are at the midpoint of the round and the leaderboard is still live.\n\nVoting does not stop until Sunday 11:59 PM EDT. Every vote you cast before close contributes to who tops the leaderboard — and determines who takes 35% of the prize pool.\n\nIf you have been watching from the outside, this is when it gets interesting. Positions can shift. Late voters with higher staking tiers can change the outcome.\n\nStaking tier multipliers: Bronze 1.1x, Silver 1.25x, Gold 1.5x, Diamond 2x, VIP 3x. Your tier does not just earn yield — it amplifies your voting weight.\n\nBase mainnet. Solidproof audited. Automatic payouts on settlement.\n\nVote now → app.temptationtoken.io  $TTS',
    ig_hashtags: '#TemptationToken #TTS #Base #BaseChain #DeFi #Web3 #CryptoTrading #StakingRewards #NFT #Blockchain #Crypto #Web3Gaming #CryptoYield #OnChain #DeFiProtocol #BaseNetwork #SolidproofAudit #ChainlinkVRF #LPLocked #EndHumanTrafficking #PolarisProject #TokenLaunch #AltcoinSeason #GemAlert #BuyBase #CryptoGems #Web3Community #BlockchainGaming #BaseEcosystem #CryptoCommunity' },
  { day:'thursday', ig_caption: 'What does it mean when a crypto protocol says it is fair?\n\nOn Temptation Token, fairness is not a claim — it is a mechanism. Chainlink VRF generates verifiable randomness that no one, including the team, can predict or influence. The contract uses that randomness to determine winners.\n\nSolidproof audited the contracts. The report is public. The LP is locked on Team.Finance until May 2027. Every transaction happens on Base mainnet — publicly visible, permanently recorded.\n\nPayouts fire automatically when the round settles. 35% to the top voter. 35% to the winning profile. 10% to the Polaris Project.\n\nNo one asks you to trust us. The chain is the record.\n\nVote now → app.temptationtoken.io  $TTS',
    ig_hashtags: '#TemptationToken #TTS #Base #BaseChain #DeFi #Web3 #ChainlinkVRF #SolidproofAudit #LPLocked #SmartContract #CryptoTrading #NFT #Blockchain #Crypto #Web3Gaming #OnChain #DeFiProtocol #BaseNetwork #CryptoTrust #ProvablyFair #EndHumanTrafficking #PolarisProject #TokenLaunch #AltcoinSeason #GemAlert #BuyBase #CryptoGems #BlockchainGaming #BaseEcosystem #CryptoFair' },
  { day:'friday', ig_caption: 'Three days left in this round and the prize pool is still building.\n\nHere is the math: every vote you cast is $TTS going into the pool. 35% of that pool goes to the top voter. 35% to the winning profile. The top voter prize is not a flat amount — it scales with the pool.\n\nIf you are staking at Gold tier ($250+), your votes carry a 1.5x multiplier. At VIP ($5k+), it is 3x. The staking tier does not just earn you APR — it changes your competitive position in every round.\n\nLP is 100% locked on Team.Finance until May 2027. The protocol is not going anywhere. Round closes Sunday 11:59 PM EDT.\n\nVote now → app.temptationtoken.io  $TTS',
    ig_hashtags: '#TemptationToken #TTS #Base #BaseChain #DeFi #Web3 #CryptoTrading #StakingRewards #NFT #Blockchain #Crypto #Web3Gaming #CryptoYield #DeFiProtocol #OnChain #LPLocked #SolidproofAudit #BaseNetwork #ChainlinkVRF #EndHumanTrafficking #PolarisProject #TokenLaunch #AltcoinSeason #GemAlert #BuyBase #CryptoGems #Web3Community #CryptoCommunity #BlockchainGaming #BaseEcosystem' },
  { day:'saturday', ig_caption: 'One day left. Temptation Token round closes tomorrow night at 11:59 PM EDT.\n\nThe protocol has been running exactly as designed. Solidproof audit complete. LP locked. Chainlink VRF. Automatic on-chain payouts.\n\nHere is what happens at settlement: the round locks, Chainlink VRF generates the winner selection, the contract distributes the prize pool — 35% to the top voter, 35% to the winning profile, 10% to the Polaris Project, 20% to the house — and that is it. No manual steps. No waiting. It just happens.\n\nIf you are not in this round, the next one starts Monday.\n\nIf you are in, this is your last full day to build your position.\n\nVote now → app.temptationtoken.io  $TTS',
    ig_hashtags: '#TemptationToken #TTS #Base #BaseChain #DeFi #Web3 #CryptoTrading #NFT #Blockchain #Crypto #Web3Gaming #StakingRewards #OnChain #DeFiProtocol #SolidproofAudit #LPLocked #ChainlinkVRF #BaseNetwork #EndHumanTrafficking #PolarisProject #CryptoYield #TokenLaunch #AltcoinSeason #GemAlert #BuyBase #Web3Community #BlockchainGaming #CryptoCommunity #BaseEcosystem #CryptoFair' },
  { day:'sunday', ig_caption: 'Round closes tonight at 11:59 PM EDT. After that, the contract settles, prizes distribute, and the leaderboard resets for next week.\n\nNew round opens Monday. If you missed this one, Monday is your clean entry.\n\nHere is what does not change between rounds: LP stays locked until May 2027. Audit remains published. Staking APR continues accumulating. Chainlink VRF is ready. The protocol runs without pause.\n\nThis is the infrastructure. The rounds are the opportunity.\n\nStakers enter Monday with their vote multiplier already active. Bronze at $50. VIP at $5k. 8% to 45% APR. 1.1x to 3x vote weight.\n\nGet positioned before the round opens.\n\nVote now → app.temptationtoken.io  $TTS',
    ig_hashtags: '#TemptationToken #TTS #Base #BaseChain #DeFi #Web3 #CryptoTrading #StakingRewards #NFT #Blockchain #Crypto #Web3Gaming #CryptoYield #OnChain #DeFiProtocol #LPLocked #SolidproofAudit #BaseNetwork #ChainlinkVRF #EndHumanTrafficking #PolarisProject #TokenLaunch #AltcoinSeason #GemAlert #BuyBase #CryptoGems #Web3Community #BlockchainGaming #CryptoCommunity #BaseEcosystem' },
]

// ── Row builders ──────────────────────────────────────────────────────────────

const SLOT_HOURS = { morning: 13, afternoon: 18, evening: 0 }
const DAY_INDEX  = { monday:0, tuesday:1, wednesday:2, thursday:3, friday:4, saturday:5, sunday:6 }
const POST_TYPES = { morning:'tts_morning', afternoon:'tts_afternoon', evening:'tts_evening' }
const IG_IMAGE   = {
  monday:'post1_monday', tuesday:'post2_tuesday', wednesday:'post3_wednesday',
  thursday:'post4_thursday', friday:'post5_friday', saturday:'post6_saturday', sunday:'post7_sunday',
}

// Returns 42 rows: 21 X + 21 Telegram
function buildWeeklyRows(posts, weekStart, weekStartStr) {
  const rows = []
  for (const t of posts) {
    const dayIdx    = DAY_INDEX[t.day] ?? 0
    const hour      = SLOT_HOURS[t.slot] ?? 13
    const dayOffset = t.slot === 'evening' ? dayIdx + 1 : dayIdx
    const scheduled_at = toISO(weekStart, dayOffset, hour)
    const post_type    = POST_TYPES[t.slot] || `tts_${t.slot}`
    const common = { post_type, day_of_week: dayIdx, scheduled_at, instagram_captions: null, selected_caption: 0, image_hint: null, status: 'pending', week_start: weekStartStr }
    rows.push({ ...common, platform: 'x_tts',   content: String(t.x_content).slice(0, 280) })
    rows.push({ ...common, platform: 'telegram', content: String(t.telegram_content).slice(0, 1024) })
  }
  return rows
}

// Returns 7 rows: 1 per day at 12:00 UTC (8am EDT)
function buildIgRows(igPosts, weekStart, weekStartStr) {
  return igPosts.map(t => {
    const dayIdx = DAY_INDEX[t.day] ?? 0
    return {
      platform:           'instagram',
      post_type:          'tts_instagram',
      day_of_week:        dayIdx,
      scheduled_at:       toISO(weekStart, dayIdx, 12),   // 8am EDT = 12:00 UTC
      content:            String(t.ig_caption).slice(0, 2200),
      instagram_captions: JSON.stringify([String(t.ig_hashtags).slice(0, 500)]),
      selected_caption:   0,
      image_hint:         IG_IMAGE[t.day] || `post${dayIdx + 1}_${t.day}`,
      status:             'pending',
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

  // Skip if already generated this week (unless force/dry_run)
  if (!forceRegen && !isDryRun) {
    const existing = await sbGet('scheduled_posts', `week_start=eq.${weekStartStr}&platform=eq.x_tts&select=id&limit=1`)
    if (Array.isArray(existing) && existing.length > 0)
      return res.status(200).json({ ok: true, skipped: 'already generated this week', weekStart: weekStartStr })
  }

  const ctx = await fetchLiveContext()

  // ── Generate with Claude; fall back to static templates on any failure ────
  let posts, igPosts, usedFallback = false

  try {
    const result = await generateAllPosts(ctx)
    posts   = result.posts
    igPosts = result.igPosts
  } catch (e) {
    console.error('content-generator: Claude generation failed — using fallback templates:', e.message)
    posts         = FALLBACK_TEMPLATES
    igPosts       = FALLBACK_IG_TEMPLATES
    usedFallback  = true
    const adminToken = process.env.BROADCAST_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
    await sendTelegram(
      ADMIN_CHAT_ID,
      `⚠️ <b>Content generator AI fallback triggered — using static templates this week</b>\nWeek of ${weekStartStr}\nError: ${String(e.message).slice(0, 200)}`,
      adminToken
    )
  }

  const weeklyRows = buildWeeklyRows(posts, weekStart, weekStartStr)   // 42
  const igRows     = buildIgRows(igPosts, weekStart, weekStartStr)     // 7
  const allRows    = [...weeklyRows, ...igRows]                        // 49

  // ── Dry run: return all posts without inserting ───────────────────────────
  if (isDryRun) {
    const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
    console.log(`\n=== DRY RUN: ${weeklyRows.length} weekly rows (X+TG) + ${igRows.length} Instagram rows ===`)
    for (let i = 0; i < weeklyRows.length; i += 2) {
      const x = weeklyRows[i]; const tg = weeklyRows[i + 1]
      const day = DAYS[x.day_of_week]; const slot = x.post_type.replace('tts_', '')
      console.log(`\n[${(i / 2) + 1}] ${day} ${slot} (${x.scheduled_at})`)
      console.log(`  X  [${x.content.length}ch]: ${x.content}`)
      console.log(`  TG [${tg.content.length}ch]: ${tg.content.replace(/<[^>]+>/g, '').slice(0, 100)}...`)
    }
    console.log('\n--- INSTAGRAM ---')
    igRows.forEach((r, i) => {
      const hashtags = (() => { try { return JSON.parse(r.instagram_captions || '[]')[0] || '' } catch { return '' } })()
      console.log(`\n[IG ${i + 1}] ${DAYS[r.day_of_week]} (${r.scheduled_at}) image: ${r.image_hint}`)
      console.log(`  Caption [${r.content.length}ch]: ${r.content.slice(0, 120)}...`)
      console.log(`  Hashtags [${hashtags.length}ch]: ${hashtags.slice(0, 80)}...`)
    })
    console.log('\n=== END DRY RUN ===\n')
    return res.status(200).json({
      ok: true, dry_run: true,
      generated: { weekly: weeklyRows.length, instagram: igRows.length, total: allRows.length },
      used_fallback: usedFallback,
      context: { roundId: ctx.roundId, prizePoolTTS: ctx.prizePoolTTS, approvedProfiles: ctx.approvedProfiles, totalStakers: ctx.totalStakers, lpLockDays: ctx.lpLockDays, auditAgeDays: ctx.auditAgeDays, totalSupplyTTS: ctx.totalSupplyTTS, stakingLockBehavior: ctx.stakingLockBehavior, transferTaxPct: ctx.transferTaxPct, transferTaxExemption: ctx.transferTaxExemption },
      weekStart: weekStartStr,
      weekly_posts: weeklyRows.map((r, i) => ({
        n: Math.floor(i / 2) + 1, platform: r.platform,
        day: DAYS[r.day_of_week], slot: r.post_type.replace('tts_', ''),
        scheduled_at: r.scheduled_at, chars: r.content.length, content: r.content,
      })),
      instagram_posts: igRows.map((r, i) => {
        const hashtags = (() => { try { return JSON.parse(r.instagram_captions || '[]')[0] || '' } catch { return '' } })()
        return {
          n: i + 1, day: DAYS[r.day_of_week], scheduled_at: r.scheduled_at,
          image: r.image_hint, caption_chars: r.content.length,
          hashtag_count: hashtags.split(' ').filter(Boolean).length,
          caption: r.content, hashtags,
        }
      }),
    })
  }

  // ── Delete pending/rejected for this week if regenerating ────────────────
  if (forceRegen)
    await sbDelete('scheduled_posts', `week_start=eq.${weekStartStr}&status=in.(pending,rejected)`)

  // ── Insert all 49 rows ────────────────────────────────────────────────────
  const insertResp = await sbInsert('scheduled_posts', allRows)
  if (!insertResp.ok) {
    const errBody = await insertResp.text()
    return res.status(500).json({ error: 'Supabase insert failed', detail: errBody })
  }

  // ── Telegram admin alert ──────────────────────────────────────────────────
  const adminToken   = process.env.BROADCAST_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const fallbackNote = usedFallback ? ' (⚠️ AI fallback — static templates)' : ''
  await sendTelegram(
    ADMIN_CHAT_ID,
    `📅 <b>21 X + 21 Telegram + 7 Instagram posts ready for review${fallbackNote}</b>\nWeek of ${weekStartStr} · Round ${ctx.roundId} · Pool: ${ctx.prizePoolTTS.toLocaleString()} $TTS\n\nApprove at <a href="https://app.temptationtoken.io/admin">app.temptationtoken.io/admin</a> → Content Calendar\n\nReview by Sunday 8pm EDT to keep next week's queue armed.`,
    adminToken
  )

  console.log(`content-generator: inserted ${allRows.length} rows (${weeklyRows.length} weekly + ${igRows.length} instagram) for week of ${weekStartStr}${usedFallback ? ' [FALLBACK]' : ''}`)

  return res.status(200).json({
    ok: true, generated: allRows.length,
    breakdown: { x_posts: weeklyRows.length / 2, telegram_posts: weeklyRows.length / 2, instagram_posts: igRows.length },
    used_fallback: usedFallback, weekStart: weekStartStr,
    roundId: ctx.roundId, prizePoolTTS: ctx.prizePoolTTS,
  })
}
