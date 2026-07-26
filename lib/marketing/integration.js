// The three integration points wired to THIS project's real data:
//   fetchRoundState — current round from TTSVotingV3d + Supabase names + USD pool
//   getStandings    — top voter per profile in the live round (on-chain)
//   claimEvent      — exactly-once insert into posted_events (Supabase, service key)
// Plus weeklyReportText and outbid_watchers helpers, and renderCard re-export.
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { base } from 'viem/chains'
import { cfg } from './config.js'
import { renderCard } from './render/cards.js'

const V3D = '0x783b8cd80b586b723188c93ef94ee1beede617b4'
const V3_ABI = parseAbi([
  'function currentRoundId() view returns (uint256)',
  'function getRound(uint256) view returns (uint256 startTime,uint256 endTime,uint256 totalTickets,uint256 totalRawVotes,bool settled,bool vrfPending,uint256 profileCount)',
  'function getProfiles(uint256) view returns (string[])',
  'function getProfile(uint256,string) view returns (address wallet,uint256 totalTickets,uint256 rawVotes,address topVoter,bool approved)',
])

const publicClient = () => createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org') })

const usd = (ttsBig) => {
  const tts = Number(formatUnits(ttsBig, 18))
  const d = tts * cfg.ttsUsd
  return '$' + (d >= 1 ? Math.round(d).toLocaleString() : d.toFixed(2))
}
const ttsNum = (b) => Number(formatUnits(b, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })

function sb(path, opts = {}) {
  return fetch(`${cfg.supabase.url}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: cfg.supabase.serviceKey, Authorization: `Bearer ${cfg.supabase.serviceKey}`,
      'Content-Type': 'application/json', ...(opts.headers || {}),
    },
  })
}

// Map submission id → display_name (best-effort; needs service key).
async function nameMap(ids) {
  const out = {}
  if (!cfg.supabase.serviceKey || ids.length === 0) return out
  try {
    const inList = ids.map(encodeURIComponent).join(',')
    const r = await sb(`/submissions?id=in.(${inList})&select=id,display_name`)
    const rows = await r.json().catch(() => [])
    for (const x of rows || []) out[String(x.id)] = x.display_name || 'Anonymous'
  } catch {}
  return out
}

// ── fetchRoundState ─────────────────────────────────────────────────────────
export async function fetchRoundState() {
  const c = publicClient()
  const round = Number(await c.readContract({ address: V3D, abi: V3_ABI, functionName: 'currentRoundId' }))
  const r = await c.readContract({ address: V3D, abi: V3_ABI, functionName: 'getRound', args: [BigInt(round)] })
  const totalRaw = r[3], settled = r[4], profiles = Number(r[6])
  const ids = await c.readContract({ address: V3D, abi: V3_ABI, functionName: 'getProfiles', args: [BigInt(round)] }).catch(() => [])
  let leaderId = null, leaderVotes = 0n, winnerId = null
  for (const id of ids) {
    const p = await c.readContract({ address: V3D, abi: V3_ABI, functionName: 'getProfile', args: [BigInt(round), id] }).catch(() => null)
    if (p && p[2] > leaderVotes) { leaderVotes = p[2]; leaderId = String(id) }
  }
  if (settled) winnerId = leaderId // post-settlement the winning profile holds the pool
  const names = await nameMap([leaderId].filter(Boolean).map(String))
  const leaderName = leaderId ? (names[leaderId] || `#${leaderId.slice(0, 6)}`) : '—'
  // Pool = winning-profile pool at settlement; pre-settlement we surface total round votes.
  const poolBig = settled ? leaderVotes : totalRaw
  const burnedBig = settled ? (totalRaw > leaderVotes ? totalRaw - leaderVotes : 0n) : 0n
  return {
    round, profiles,
    poolUsd: usd(poolBig),
    leader: leaderName, leaderVotes: ttsNum(leaderVotes),
    ...(settled ? { winner: leaderName, prizeUsd: usd(poolBig), burned: ttsNum(burnedBig) } : {}),
  }
}

// ── getStandings ────────────────────────────────────────────────────────────
export async function getStandings() {
  const c = publicClient()
  const round = Number(await c.readContract({ address: V3D, abi: V3_ABI, functionName: 'currentRoundId' }))
  const ids = await c.readContract({ address: V3D, abi: V3_ABI, functionName: 'getProfiles', args: [BigInt(round)] }).catch(() => [])
  const names = await nameMap(ids.map(String))
  const out = []
  for (const id of ids) {
    const p = await c.readContract({ address: V3D, abi: V3_ABI, functionName: 'getProfile', args: [BigInt(round), id] }).catch(() => null)
    if (!p) continue
    out.push({ profileId: String(id), profileName: names[String(id)] || `#${String(id).slice(0, 6)}`,
      topWallet: p[3], topVotes: Number(formatUnits(p[2], 18)) })
  }
  return out
}

// ── claimEvent ──────────────────────────────────────────────────────────────
// Insert into posted_events; return false on unique-violation (already posted).
export async function claimEvent(eventKey) {
  if (!cfg.supabase.serviceKey) throw new Error('claimEvent needs SUPABASE_SERVICE_KEY')
  const r = await sb('/posted_events', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ event_key: eventKey, posted_at: new Date().toISOString() }),
  })
  if (r.status === 201 || r.status === 200) return true
  if (r.status === 409) return false // primary-key/unique violation → already claimed
  const t = await r.text().catch(() => '')
  if (/duplicate key|already exists/i.test(t)) return false
  throw new Error(`claimEvent insert failed: ${r.status} ${t.slice(0, 120)}`)
}

// ── weeklyReportText ─────────────────────────────────────────────────────────
export async function weeklyReportText() {
  const s = await fetchRoundState().catch(() => null)
  if (!s) return '📊 Weekly report: round state unavailable.'
  return [`📊 <b>TTS weekly report</b>`,
    `Round ${s.round} · ${s.profiles} profiles · pool ${s.poolUsd}`,
    s.winner ? `Winner: ${s.winner} (${s.prizeUsd}); burned ${s.burned} $TTS` : `Leader: ${s.leader} (${s.leaderVotes} votes)`,
  ].join('\n')
}

// ── outbid_watchers helpers ──────────────────────────────────────────────────
export async function getWatchers() {
  if (!cfg.supabase.serviceKey) return []
  const r = await sb('/outbid_watchers?select=wallet,tg_chat_id,profile_id,last_rank,last_notified')
  const rows = await r.json().catch(() => [])
  return (rows || []).map((w) => ({ wallet: w.wallet, tgChatId: w.tg_chat_id, profileId: w.profile_id,
    lastRank: w.last_rank, lastNotified: w.last_notified ? new Date(w.last_notified) : null }))
}
export async function saveWatcher(w) {
  if (!cfg.supabase.serviceKey) return
  await sb('/outbid_watchers', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ wallet: w.wallet, tg_chat_id: w.tgChatId, profile_id: w.profileId,
      last_rank: w.lastRank, last_notified: w.lastNotified ? new Date(w.lastNotified).toISOString() : null }),
  }).catch(() => {})
}
export async function upsertWatcher(wallet, tgChatId, profileId) {
  if (!cfg.supabase.serviceKey) return false
  const r = await sb('/outbid_watchers', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ wallet, tg_chat_id: String(tgChatId), profile_id: profileId }),
  }).catch(() => null)
  return !!(r && r.ok)
}

export { renderCard }

// Assemble the dispatcher deps object.
export function makeDeps() {
  return { claimEvent, fetchRoundState, renderCard, weeklyReportText }
}
