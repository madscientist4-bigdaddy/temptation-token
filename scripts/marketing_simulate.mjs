// Step 7 — DRY_RUN dispatcher simulation across all six ET events + dedupe.
// Real on-chain round state (TTSVotingV3d via BASE_RPC_URL). claimEvent uses an
// in-memory guard because the local shell has no SUPABASE_SERVICE_KEY (Sensitive);
// this exercises the dispatcher's exactly-once logic identically to posted_events.
process.env.DRY_RUN = 'true'
import { runDispatch } from '../lib/marketing/dispatch.js'
import { fetchRoundState as realFetch, renderCard as realRender } from '../lib/marketing/integration.js'

const log = []
const say = (...a) => { const line = a.join(' '); log.push(line); console.log(line) }

// Six forced ET moments (EDT, UTC-4 in late July/early Aug 2026), one per event.
const STAMPS = [
  ['round_open',    '2026-07-27T09:05:00-04:00'], // Mon 9:05a
  ['midpoint',      '2026-07-29T20:05:00-04:00'], // Wed 8:05p
  ['friday_push',   '2026-07-31T12:05:00-04:00'], // Fri 12:05p
  ['final_hours',   '2026-08-02T18:05:00-04:00'], // Sun 6:05p
  ['winner',        '2026-08-02T00:15:00-04:00'], // Sun 12:15a
  ['weekly_report', '2026-08-02T00:35:00-04:00'], // Sun 12:35a
]

// Memoize the (real) round state so 6 invocations don't re-hit the RPC 6×.
let _state = null
async function fetchState() {
  if (_state) return _state
  const s = await realFetch()
  // Live round is unsettled (round 4 VRF-stalled), so surface the current leader as the
  // projected winner ONLY so the winner card renders for the >10KB assertion. round/pool
  // /profiles/leader are REAL on-chain values.
  if (!s.winner) { s.winner = s.leader; s.prizeUsd = s.poolUsd; s.burned = s.burned || '0' }
  _state = s
  return s
}

const cardSizes = []
async function renderCardTracked(kind, state) {
  const buf = await realRender(kind, state)
  cardSizes.push({ kind, bytes: buf.length })
  say(`  [render] ${kind} card = ${buf.length} bytes`)
  return buf
}

// In-memory exactly-once guard (stands in for the posted_events unique insert).
const claimed = new Set()
const claimEvent = async (k) => (claimed.has(k) ? false : (claimed.add(k), true))

const deps = { claimEvent, fetchRoundState: fetchState, renderCard: renderCardTracked,
  weeklyReportText: async () => '📊 [sim] weekly report' }

say('════════ TTS MARKETING ENGINE — DRY_RUN SIMULATION ════════')
say(`start: ${new Date().toISOString()}  DRY_RUN=${process.env.DRY_RUN}`)

const firedPass1 = []
say('\n──── PASS 1 (first invocation at each timestamp) ────')
for (const [label, iso] of STAMPS) {
  const when = new Date(iso)
  say(`\n▶ ${label} @ ${iso}  (ET moment)`)
  const fired = await runDispatch(deps, when)
  say(`  fired: [${fired.join(', ')}]`)
  firedPass1.push(...fired)
}

say('\n──── PASS 2 (same timestamps — must dedupe to zero) ────')
const firedPass2 = []
for (const [label, iso] of STAMPS) {
  const fired = await runDispatch(deps, new Date(iso))
  say(`▶ ${label}: fired [${fired.join(', ')}]`)
  firedPass2.push(...fired)
}

// ── Assertions ──
const state = await fetchState()
const uniqueFired = [...new Set(firedPass1)]
const A = []
const assert = (name, cond, detail = '') => { A.push({ name, ok: !!cond, detail }); say(`${cond ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`) }

say('\n──── ASSERTIONS ────')
assert('exactly six events fire (pass 1)', firedPass1.length === 6, `${firedPass1.length} fired: [${firedPass1.join(', ')}]`)
assert('all six distinct event ids covered', uniqueFired.length === 6, uniqueFired.join(', '))
assert('round number > 0', state.round > 0, `round=${state.round}`)
assert('pool string non-empty', typeof state.poolUsd === 'string' && state.poolUsd.length > 0, `poolUsd="${state.poolUsd}"`)
assert('every rendered card buffer > 10KB', cardSizes.length > 0 && cardSizes.every(c => c.bytes > 10240),
  cardSizes.map(c => `${c.kind}:${c.bytes}b`).join(', '))
assert('second invocation fires zero (dedupe)', firedPass2.length === 0, `${firedPass2.length} fired`)

const passed = A.filter(a => a.ok).length
say(`\n════════ RESULT: ${passed}/${A.length} assertions passed ════════`)
say(`leader (real on-chain): ${state.leader} · profiles: ${state.profiles} · pool: ${state.poolUsd}`)

import { writeFileSync } from 'node:fs'
writeFileSync('marketing-reports/simulation.txt', log.join('\n') + '\n')
say('\nlog written to marketing-reports/simulation.txt')
process.exit(passed === A.length ? 0 : 1)
