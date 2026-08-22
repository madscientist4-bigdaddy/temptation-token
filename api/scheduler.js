// GET /api/scheduler — runs every hour via Vercel cron (vercel.json)
// Two jobs in one handler:
//   1. EVERY HOUR: fire approved scheduled_posts whose scheduled_at has passed
//   2. AT 10AM UTC daily: post round status update to Telegram

import crypto from 'crypto'
import { createWalletClient, createPublicClient, http, parseAbi, encodeAbiParameters } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { evaluateAutoFund } from './_lib/autofund.js'
import { evaluateVrfAutoFund } from './_lib/vrf_autofund.js'
import { evaluateKeeperAutopilot, ACTION as ACTION_NAME } from './_lib/keeper_autopilot.js'

const SUPABASE_URL   = 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'
const VOTING_ADDRESS  = '0x783b8cd80b586b723188c93ef94ee1beede617b4'

// ── Referral-wallet auto-funder (Marketing → referral wallet; NEVER Bank) ──────
const TTS_ADDRESS        = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
const REFERRAL_WALLET    = '0x216a4555E11dcA788a78Cfe6F47277ADf396FF40'
const MARKETING_WALLET   = '0x7a9ff2f584248744cBbA32c737D660ED6f077fCB'
const TTS_TRANSFER_ABI   = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
])
const numv = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d }
// Service-key Supabase (cron context) — falls back to anon if unset.
function sbService(path, opts = {}) {
  const key = process.env.SUPABASE_SERVICE_KEY || SUPABASE_KEY
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
}

// ── admin_audit_log writer ───────────────────────────────────────────────────
// The real schema is (id, created_at, changed_by, config_key NOT NULL, old_value,
// new_value) — see api/admin.js:164 and TTAdminDashboard's Audit Log view. Three
// callers here were posting {action, source, detail} instead, which PostgREST rejects
// (unknown columns + NOT NULL config_key), and every one swallowed the failure with
// `.catch(() => {})`. Result: not one auto-funder row was ever written, and the VRF
// funder's rolling 7-day LINK cap has been reading an empty table — i.e. not enforced.
// One writer, one shape, so the next caller cannot get it wrong.
function auditLog(job, wallet, detail, opts = {}) {
  return sbService('/admin_audit_log', {
    method: 'POST', headers: { Prefer: opts.representation ? 'return=representation' : 'return=minimal' },
    body: JSON.stringify({ config_key: job, changed_by: wallet, new_value: JSON.stringify(detail), created_at: new Date().toISOString() }),
  })
}
const auditQuery = (job, sinceISO, select = 'new_value') =>
  `/admin_audit_log?config_key=eq.${job}&created_at=gte.${sinceISO}&select=${select}`

// Runs daily. Disabled by default (auto_fund_enabled=false) and REFUSES without
// MARKETING_WALLET_PRIVATE_KEY. All clamps/solvency live in evaluateAutoFund().
async function runAutoFunder() {
  let s = {}
  try { const d = await (await sbService('/referral_settings?id=eq.1&select=*&limit=1')).json(); if (Array.isArray(d) && d[0]) s = d[0] } catch {}
  if (s.auto_fund_enabled !== true) return { skipped: 'auto-funder disabled' } // kill switch — no on-chain reads

  const hasMarketingKey = !!process.env.MARKETING_WALLET_PRIVATE_KEY

  // trailing-7-day average referral payout (burn rate)
  let dailyAvgPayout = 0
  try {
    const ago = new Date(Date.now() - 7 * 864e5).toISOString()
    const credits = await (await sbService(`/referral_credits?created_at=gte.${ago}&select=amount_tts`)).json()
    const sum = Array.isArray(credits) ? credits.reduce((a, c) => a + (Number(c.amount_tts) || 0), 0) : 0
    dailyAvgPayout = sum / 7
  } catch {}

  // on-chain balances
  const pub = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
  let refWalletBalance = 0, marketingBalance = 0
  try { refWalletBalance = Number(await pub.readContract({ address: TTS_ADDRESS, abi: TTS_TRANSFER_ABI, functionName: 'balanceOf', args: [REFERRAL_WALLET] })) / 1e18 } catch {}
  try { marketingBalance = Number(await pub.readContract({ address: TTS_ADDRESS, abi: TTS_TRANSFER_ABI, functionName: 'balanceOf', args: [MARKETING_WALLET] })) / 1e18 } catch {}

  const decision = evaluateAutoFund({
    enabled: true, hasMarketingKey,
    refWalletBalance, dailyAvgPayout,
    dailyCapTts: numv(s.program_daily_cap_tts, 10000),
    maxDailyTopupTts: numv(s.max_daily_topup_tts, 25000),
    maxWalletBalanceTts: numv(s.max_wallet_balance_tts, 50000),
    marketingBalance,
    marketingReserveFloorTts: numv(s.marketing_reserve_floor_tts, 100000),
  })
  if (!decision.topUp) return { skipped: decision.reason, refWalletBalance, marketingBalance }

  // SEND from MARKETING only — never the Bank/DEPLOYER key.
  const pk = process.env.MARKETING_WALLET_PRIVATE_KEY
  const pkHex = pk.startsWith('0x') ? pk : `0x${pk}`
  const account = privateKeyToAccount(pkHex)
  const wallet = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') })
  const amountWei = BigInt(Math.floor(decision.amount * 1e18))
  const txHash = await wallet.writeContract({ address: TTS_ADDRESS, abi: TTS_TRANSFER_ABI, functionName: 'transfer', args: [REFERRAL_WALLET, amountWei] })
  await pub.waitForTransactionReceipt({ hash: txHash })
  const newBalance = refWalletBalance + decision.amount

  // audit log (amount, source, trigger, new balance)
  await auditLog('referral_auto_fund', 'marketing_wallet', { amount: decision.amount, target: decision.target, trigger: 'below_half_target', new_balance: newBalance, tx_hash: txHash }).catch(() => {})

  return { topUp: true, amount: decision.amount, target: decision.target, txHash, newBalance }
}
const MAIN_CHANNEL_ID   = process.env.MAIN_CHANNEL_ID   || '-1002207667493'
const COMMUNITY_CHAT_ID = process.env.COMMUNITY_CHAT_ID || '-1003930752060'

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function sbGet(table, query = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
  return r.json()
}

async function sbPatch(table, query, body) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal'
    },
    body: JSON.stringify(body)
  })
}

// ── RPC / on-chain helpers ────────────────────────────────────────────────────

async function rpcCall(method, params) {
  const r = await fetch('https://mainnet.base.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const { result } = await r.json()
  return result
}

async function getCurrentRoundId() {
  const result = await rpcCall('eth_call', [{ to: VOTING_ADDRESS, data: '0x9cbe5efd' }, 'latest'])
  if (!result || result === '0x') return null
  return parseInt(result, 16)
}

async function getRound(roundId) {
  const padded = roundId.toString(16).padStart(64, '0')
  const result = await rpcCall('eth_call', [{ to: VOTING_ADDRESS, data: '0x8f1327c0' + padded }, 'latest'])
  if (!result || result === '0x') return null
  const hex = result.slice(2)
  const chunks = []
  for (let i = 0; i < hex.length; i += 64) chunks.push(hex.slice(i, i + 64))
  return {
    startTime:     parseInt(chunks[0], 16),
    endTime:       parseInt(chunks[1], 16),
    totalRawVotes: BigInt('0x' + chunks[3]),
    settled:       chunks[4] !== '0'.padStart(64, '0'),
    profileCount:  parseInt(chunks[6], 16),
  }
}

function formatCountdown(endTime) {
  const ms = endTime * 1000 - Date.now()
  if (ms <= 0) return 'ended'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`
}

// ── Posting helpers ───────────────────────────────────────────────────────────

async function sendTelegram(chatId, text, token) {
  if (!chatId || !token) return null
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  return r.json()
}

// ── VRF stall + subscription-funding monitor ──────────────────────────────────
// A settlement request that the Chainlink DON never fulfills leaves the round
// vrfPending forever (this is exactly what stranded Round 4 for 6 days). We flag:
//   (1) STALL   — vrfPending=true AND now > endTime + 60 min (a genuine stall,
//                 distinct from a round that just ended and is awaiting VRF).
//   (2) SUB LOW — the VRF subscription's LINK balance is below the funding buffer.
// (2) is the real guard against a gas-price spike stranding a request: VRF v2.5
// will not fulfill unless the sub can cover the WORST-CASE gas at fulfillment
// time, so a spike + thin balance = stranded. Keeping a buffer (alert to top up)
// removes that failure mode. (The callback gas limit is already a generous 2.5M,
// so the Round-4 analysis found NO contract gas-lane bug to fix — the durable fix
// is funding-buffer monitoring, implemented here.)
const VRF_COORDINATOR = '0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634'
const VRF_SUB_ID      = 58222014484560539249027457203866883376041731162442592604288474822166186263722n
const VRF_STALL_SECONDS = 3600   // 60 min past endTime
// Per-request LINK RESERVE the DON holds before it will fulfill:
//   callbackGasLimit (2.5M) × lane max gas price (30 gwei) = 0.075 ETH worth of LINK
//   ≈ 15 LINK at ~$3.8k ETH / ~$19 LINK. Empirically confirmed: Round 4 STRANDED
//   twice at ~8 LINK and FULFILLED at ~32 LINK.
// The old 2-LINK threshold was far below the reserve, so it never fired even while
// the sub was too thin to fulfill (silent strand). We now alert at reserve + 25%,
// set GENEROUSLY HIGH (25) so an ETH/LINK price swing can't quietly drop us under
// the reserve without warning. Bump if the lane cap or callback gas limit changes.
const VRF_CALLBACK_GAS   = 2_500_000
const VRF_LANE_MAX_GWEI  = 30
const VRF_RESERVE_ETH    = VRF_CALLBACK_GAS * VRF_LANE_MAX_GWEI * 1e-9   // 0.075 ETH/request
// Reserve in ETH is fixed (0.075). Its LINK value is PRICE-AWARE: reserveLink =
// reserveEth × (ETH/USD ÷ LINK/USD), read live from Chainlink feeds on Base so the
// monitor threshold + auto-funder trigger scale when ETH rises or LINK falls. If a feed
// read fails/looks stale we fall back to this fixed estimate. 25/30 LINK stay as hard floors.
const VRF_RESERVE_LINK_FALLBACK = 15
const VRF_SUB_LINK_WARN  = 25    // hard MINIMUM alert floor (dynamic threshold = max(25, reserveLink×1.25))
const CHAINLINK_ETH_USD  = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70'
const CHAINLINK_LINK_USD = '0x17CAb8FE31E32f08326e5E27412894e49B0f9D65'
const AGG_ABI = parseAbi([
  'function latestRoundData() view returns (uint80,int256 answer,uint256,uint256 updatedAt,uint80)',
  'function decimals() view returns (uint8)',
])
// Live worst-case reserve in LINK (price-aware, with a safe fallback + staleness guard).
async function computeReserveLink() {
  try {
    const pub = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
    const read = async (a) => {
      const [dec, rd] = await Promise.all([
        pub.readContract({ address: a, abi: AGG_ABI, functionName: 'decimals' }),
        pub.readContract({ address: a, abi: AGG_ABI, functionName: 'latestRoundData' }),
      ])
      const price = Number(rd[1]) / 10 ** Number(dec)
      const ageSec = Math.floor(Date.now() / 1000) - Number(rd[3])
      return { price, ageSec }
    }
    const [eth, link] = await Promise.all([read(CHAINLINK_ETH_USD), read(CHAINLINK_LINK_USD)])
    // reject bad/stale data (>24h) → fall back
    if (!(eth.price > 0) || !(link.price > 0) || eth.ageSec > 86400 || link.ageSec > 86400) return VRF_RESERVE_LINK_FALLBACK
    const reserveLink = VRF_RESERVE_ETH * (eth.price / link.price)
    // sanity clamp so a feed glitch can't produce an absurd threshold
    if (!(reserveLink > 1) || reserveLink > 500) return VRF_RESERVE_LINK_FALLBACK
    return reserveLink
  } catch { return VRF_RESERVE_LINK_FALLBACK }
}

// VRF auto-funder — Bank tops up OUR sub via LINK ERC-677 transferAndCall. Destination
// is the coordinator + hard-coded subId: funds can only ever land in our own sub.
const LINK_TOKEN     = '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196'  // Base mainnet LINK
const BANK_WALLET    = '0xb1e991bf617459b58964eef7756b350e675c53b5'
const LINK_ABI       = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transferAndCall(address to, uint256 value, bytes data) returns (bool)',
])
const VRF_ALERT_COOLDOWN_MS = 6 * 3600 * 1000

// Pure read — no alert, no write. Used by ?action=vrf-status and checkVrfHealth.
async function computeVrfStatus() {
  const idHex = await rpcCall('eth_call', [{ to: VOTING_ADDRESS, data: '0x9cbe5efd' }, 'latest'])
  if (!idHex || idHex === '0x') return { error: 'currentRoundId read failed' }
  const roundId = parseInt(idHex, 16)
  const rData = await rpcCall('eth_call', [{ to: VOTING_ADDRESS, data: '0x8f1327c0' + roundId.toString(16).padStart(64, '0') }, 'latest'])
  if (!rData || rData === '0x') return { roundId, error: 'getRound read failed' }
  const c = []
  for (let i = 0; i < rData.slice(2).length; i += 64) c.push(rData.slice(2 + i, 2 + i + 64))
  const ZERO = '0'.repeat(64)
  const endTime    = parseInt(c[1], 16)
  const settled    = c[4] !== ZERO
  const vrfPending = c[5] !== ZERO
  const nowSec     = Math.floor(Date.now() / 1000)
  const secPastEnd = (!settled && vrfPending) ? Math.max(0, nowSec - endTime) : 0
  const stalled    = !settled && vrfPending && secPastEnd > VRF_STALL_SECONDS

  let subLinkBalance = null
  try {
    const subRes = await rpcCall('eth_call', [{ to: VRF_COORDINATOR, data: '0xdc311dd3' + VRF_SUB_ID.toString(16).padStart(64, '0') }, 'latest'])
    if (subRes && subRes !== '0x' && subRes.length >= 66) subLinkBalance = Number(BigInt('0x' + subRes.slice(2, 66))) / 1e18
  } catch {}
  // Price-aware alert threshold: max(25, reserveLink × 1.25). 25 stays as a hard floor.
  const reserveLink = await computeReserveLink()
  const warnThreshold = Math.max(VRF_SUB_LINK_WARN, reserveLink * 1.25)
  const subLow = subLinkBalance != null && subLinkBalance < warnThreshold

  return { checkedAt: new Date().toISOString(), roundId, endTime, settled, vrfPending, secPastEnd, stalled, subLinkBalance, subLow, reserveLink: Math.round(reserveLink * 100) / 100, warnThreshold: Math.round(warnThreshold * 100) / 100 }
}

// Read → (de-duped) alert → persist to admin_config.vrf_status (surfaced in System Health).
async function checkVrfHealth(adminChatId) {
  const status = await computeVrfStatus()
  if (status.error) return status

  // de-dupe on the last alert time stored alongside the status
  let prior = {}
  try { const pr = await (await sbService('/admin_config?key=eq.vrf_status&select=value&limit=1')).json(); if (Array.isArray(pr) && pr[0]?.value) prior = JSON.parse(pr[0].value) } catch {}
  const lastAlertAt = Number(prior.lastAlertAt) || 0

  let alertSent = false
  const token = process.env.BROADCAST_BOT_TOKEN
  if ((status.stalled || status.subLow) && token && (Date.now() - lastAlertAt > VRF_ALERT_COOLDOWN_MS)) {
    const h = Math.floor(status.secPastEnd / 3600), m = Math.floor((status.secPastEnd % 3600) / 60)
    const lines = ['🚨 <b>VRF ALERT — Temptation Token</b>']
    if (status.stalled) lines.push(`⛔ Round ${status.roundId} settlement STALLED — vrfPending ${h}h ${m}m past round end (&gt;60&nbsp;min). Recovery: <code>outputs/round4_vrf_recovery_runbook.md</code>`)
    if (status.subLow)  lines.push(`⚠️ VRF subscription LINK low: ${status.subLinkBalance.toFixed(3)} LINK — below the ${status.warnThreshold}-LINK threshold (live reserve ~${status.reserveLink} LINK from Chainlink price feeds; 2.5M callback × 30-gwei lane). Top up at vrf.chain.link/base so a fulfillment can't strand.`)
    lines.push(`Round end: ${new Date(status.endTime * 1000).toISOString()}`)
    try { await sendTelegram(adminChatId, lines.join('\n\n'), token); alertSent = true } catch {}
  }

  const persisted = { ...status, lastAlertAt: alertSent ? Date.now() : lastAlertAt }
  try {
    await sbService('/admin_config', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'vrf_status', value: JSON.stringify(persisted) }) })
  } catch {}
  return persisted
}

// ── VRF SUBSCRIPTION AUTO-FUNDER ──────────────────────────────────────────────
// Keeps the sub above the per-request reserve so a draw can never strand for LINK.
// Sends from BANK via LINK.transferAndCall(coordinator, amount, encode(subId)) — the
// destination is our own sub and CANNOT be redirected. All caps/floor live in the pure
// evaluateVrfAutoFund(). Kill switch: admin_config.vrf_autofund_enabled (default TRUE).
// New trophy contract (V3d mints here from Round 6 on). One-shot verifier: on the first
// mint, confirm tokenURI(1) → our API and the image is a valid SVG (renders in wallets).
const TROPHY_NFT = '0x02DDd0e63DC2A5F66Fdb5a46F5981191959AC9A5'
const TROPHY_ABI = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function tokenURI(uint256) view returns (string)',
])
async function checkTrophyMint() {
  // one-shot guard
  try {
    const d = await (await sbService('/admin_config?key=eq.trophy_mint_verified&select=value&limit=1')).json()
    if (Array.isArray(d) && d[0]?.value) { try { if (JSON.parse(d[0].value).done) return { skipped: 'already verified' } } catch {} }
  } catch {}

  const pub = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
  let supply
  try { supply = Number(await pub.readContract({ address: TROPHY_NFT, abi: TROPHY_ABI, functionName: 'totalSupply' })) } catch { return { error: 'totalSupply read failed' } }
  if (supply < 1) return { skipped: 'no trophy minted yet', supply }

  // First mint has happened — verify token #1 end-to-end.
  let ok = true, detail = ''
  try {
    const uri = await pub.readContract({ address: TROPHY_NFT, abi: TROPHY_ABI, functionName: 'tokenURI', args: [1n] })
    if (!/\/api\/nft\/1$/.test(uri)) { ok = false; detail = `tokenURI(1) unexpected: ${uri}` }
    else {
      const r = await fetch(uri)
      if (!r.ok) { ok = false; detail = `metadata HTTP ${r.status}` }
      else {
        const j = await r.json().catch(() => ({}))
        const imgOk = typeof j.image === 'string' && j.image.startsWith('data:image/svg+xml;base64,')
        let svgOk = false
        if (imgOk) { try { const svg = Buffer.from(j.image.split(',')[1], 'base64').toString(); svgOk = svg.includes('<svg') && svg.includes('</svg>') } catch {} }
        if (!j.name || !imgOk || !svgOk) { ok = false; detail = `metadata incomplete (name:${!!j.name} img:${imgOk} svg:${svgOk})` }
        else detail = `${j.name} · image renders`
      }
    }
  } catch (e) { ok = false; detail = `verify error: ${String(e.message || e).slice(0, 120)}` }

  const token = process.env.BROADCAST_BOT_TOKEN
  const adminChatId = process.env.ADMIN_CHAT_ID || '-5273368658'
  const safe = String(detail).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const msg = ok
    ? `🏆 <b>First branded trophy minted &amp; verified</b>\nThe new contract minted token #1 at settlement.\n${safe}\ntokenURI resolves to our API and the art renders in-wallet.\nView: https://basescan.org/nft/${TROPHY_NFT}/1`
    : `⚠️ <b>Trophy mint verify FAILED</b>\nA token minted on the new contract but the metadata/art check failed:\n<code>${safe}</code>\nCheck https://app.temptationtoken.io/api/nft/1`
  await sendTelegram(adminChatId, msg, token).catch(() => {})

  // mark done either way so it alerts exactly once
  try {
    await sbService('/admin_config', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'trophy_mint_verified', value: JSON.stringify({ done: true, ok, detail, at: new Date().toISOString() }) }) })
  } catch {}
  return { verified: ok, detail }
}

async function runVrfAutoFunder() {
  // Kill switch (default TRUE — own-sub destination makes on-by-default acceptable).
  let enabled = true
  try {
    const d = await (await sbService('/admin_config?key=eq.vrf_autofund_enabled&select=value&limit=1')).json()
    if (Array.isArray(d) && d[0] && (d[0].value === 'false' || d[0].value === false)) enabled = false
  } catch {}
  if (!enabled) return { skipped: 'vrf auto-funder disabled' } // no reads/writes when off

  const hasBankKey = !!process.env.DEPLOYER_PRIVATE_KEY

  // Sub balance (reuse the monitor's read) + Bank LINK fuel + trailing-7d top-up total.
  const vstat = await computeVrfStatus()
  const subBalance = vstat.subLinkBalance
  if (subBalance == null) return { skipped: 'sub balance read failed' }

  const pub = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
  let bankLink = 0
  try { bankLink = Number(await pub.readContract({ address: LINK_TOKEN, abi: LINK_ABI, functionName: 'balanceOf', args: [BANK_WALLET] })) / 1e18 } catch {}

  let sevenDayTopupTotal = 0
  try {
    const ago = new Date(Date.now() - 7 * 864e5).toISOString()
    const rows = await (await sbService(auditQuery('vrf_auto_fund', ago))).json()
    if (Array.isArray(rows)) for (const r of rows) { try { sevenDayTopupTotal += Number(JSON.parse(r.new_value)?.amount) || 0 } catch {} }
  } catch {}

  const reserveLink = await computeReserveLink() // price-aware (Chainlink ETH/USD ÷ LINK/USD)
  const decision = evaluateVrfAutoFund({ enabled, hasBankKey, subBalance, reserveLink, bankLinkBalance: bankLink, sevenDayTopupTotal })

  // Persist status for the System Health card every run (whether or not we top up).
  const statusBlob = {
    checkedAt: new Date().toISOString(), enabled, subBalance, reserveLink: Math.round(reserveLink * 100) / 100,
    bankLink, sevenDayTopupTotal, sevenDayCap: 60,
    lastDecision: decision.topUp ? `top-up ${decision.amount} LINK` : decision.reason,
  }
  const persistStatus = async (extra = {}) => {
    try { await sbService('/admin_config', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'vrf_autofund_status', value: JSON.stringify({ ...statusBlob, ...extra }) }) }) } catch {}
  }

  if (!decision.topUp) { await persistStatus(); return { skipped: decision.reason, subBalance, bankLink, sevenDayTopupTotal } }

  // SEND — from Bank, ERC-677 transferAndCall to the coordinator with abi.encode(subId).
  // Destination is HARD-CODED to our sub; nothing here is user- or config-controlled.
  const pk = process.env.DEPLOYER_PRIVATE_KEY
  const pkHex = pk.startsWith('0x') ? pk : `0x${pk}`
  const account = privateKeyToAccount(pkHex)
  const wallet = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') })
  const amountWei = BigInt(Math.floor(decision.amount * 1e18))
  const data = encodeAbiParameters([{ type: 'uint256' }], [VRF_SUB_ID])
  let txHash
  try {
    txHash = await wallet.writeContract({ address: LINK_TOKEN, abi: LINK_ABI, functionName: 'transferAndCall', args: [VRF_COORDINATOR, amountWei, data] })
    await pub.waitForTransactionReceipt({ hash: txHash })
  } catch (e) {
    await persistStatus({ lastError: String(e.message || e).slice(0, 160) })
    return { error: `transferAndCall failed: ${String(e.message || e).slice(0, 160)}` }
  }
  const newSub = subBalance + decision.amount

  // Telegram receipt on EVERY top-up + audit log.
  const token = process.env.BROADCAST_BOT_TOKEN
  const adminChatId = process.env.ADMIN_CHAT_ID || '-5273368658'
  await sendTelegram(adminChatId,
    `⛽ <b>VRF sub auto-funded</b>\n+${decision.amount} LINK → subscription (destination hard-coded to our subId — cannot be redirected)\nBalance ${subBalance.toFixed(2)} → ${newSub.toFixed(2)} LINK · live reserve ~${Math.round(reserveLink * 10) / 10}\ntx <code>${txHash.slice(0, 16)}…</code>`,
    token).catch(() => {})
  await auditLog('vrf_auto_fund', 'bank_wallet', { amount: decision.amount, old: subBalance, new: newSub, target: decision.target, tx_hash: txHash }).catch(() => {})

  await persistStatus({ lastTopupAt: new Date().toISOString(), lastTopupAmount: decision.amount, lastTopupTx: txHash })
  return { topUp: true, amount: decision.amount, old: subBalance, new: newSub, txHash }
}

// ── Keeper autopilot (Chainlink Automation replacement) ──────────────────────
// Chainlink Automation registry 2.3.0 on Base has performed NO upkeep for ANY of its
// ~191 upkeeps since 2026-08-05. Ours is funded, unpaused and correctly wired; the DON
// simply stopped. Rounds 6→7 and 7→8 were closed by hand from the Bank ~17.7h late.
// This closes them on time instead. Decision core: api/_lib/keeper_autopilot.js.
// DISARMED unless admin_config.keeper_autopilot_enabled = true.
const KEEPER3_ADDRESS = '0x363Ce4960E3B459f5892587A37Ae1fF2ED04442C'
const KEEPER3_ABI = parseAbi([
  'function checkUpkeep(bytes) view returns (bool upkeepNeeded, bytes performData)',
  'function manualExecute(uint256 action)',
  'function owner() view returns (address)',
])
// The public Base RPC rate-limits; settlement must not hinge on that. Prefer the
// project's Alchemy endpoint and fall back to public only if it is unset.
const KEEPER_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
const V3D_ROUND_ABI = parseAbi([
  'function currentRoundId() view returns (uint256)',
  'function getRound(uint256) view returns (uint256 startTime,uint256 endTime,uint256 totalTickets,uint256 totalRawVotes,bool settled,bool vrfPending,uint256 profileCount)',
])

// Is the autopilot armed? Default FALSE — it spends Bank gas, so it stays inert until
// someone deliberately flips the row.
async function readKeeperArmed() {
  try {
    const d = await (await sbService('/admin_config?key=eq.keeper_autopilot_enabled&select=value&limit=1')).json()
    // Coerce: `arr && arr[0] && …` yields undefined when the row is absent, and
    // JSON.stringify DROPS undefined — which silently deleted `enabled` from the
    // status payload, the one field an operator reads it for.
    return !!(Array.isArray(d) && d[0] && (d[0].value === 'true' || d[0].value === true))
  } catch { return false }
}

// Trailing-24h action history — feeds the runaway guard and the min-interval rule.
async function readKeeperHistory() {
  try {
    const ago = new Date(Date.now() - 864e5).toISOString()
    const rows = await (await sbService(auditQuery('keeper_autopilot', ago, 'created_at'))).json()
    if (!Array.isArray(rows)) return { actionsLast24h: 0, lastActionAtSec: 0 }
    let lastActionAtSec = 0
    for (const r of rows) { const t = Math.floor(new Date(r.created_at).getTime() / 1000); if (t > lastActionAtSec) lastActionAtSec = t }
    return { actionsLast24h: rows.length, lastActionAtSec }
  } catch { return { actionsLast24h: 0, lastActionAtSec: 0 } }
}

// ── Bank-signer mutex ────────────────────────────────────────────────────────
// runKeeperAutopilot() has TWO drivers (the 10-min Railway ping and every Vercel cron
// tick), and runVrfAutoFunder() sends from the SAME Bank key immediately before it on
// the cron path. Neither sets an explicit nonce, so viem reads pending count per call:
// two concurrent Bank sends can draw the same nonce and one dies "nonce too low".
// Invisible in normal operation — the cron hours never coincide with the few minutes
// upkeepNeeded is true — but the whole point of this autopilot is the case where a
// swallowed revert keeps upkeepNeeded true for HOURS, and then a 12:00 UTC cron is
// GUARANTEED to overlap a bot tick.
//
// PostgREST executes UPDATE … WHERE atomically, so a conditional update on an expiry
// timestamp is a real compare-and-set. Epoch-ms as text compares correctly with `lt.`
// (13 digits until year 2286), so no schema change is needed.
const KEEPER_LOCK_KEY = 'keeper_autopilot_lock'
const KEEPER_LOCK_TTL_MS = 180000   // > worst-case send + receipt wait

async function acquireKeeperLock() {
  const now = Date.now()
  const expiry = String(now + KEEPER_LOCK_TTL_MS)
  try {
    // CAS: only succeeds if the stored expiry is in the past (or we seed it).
    const res = await sbService(`/admin_config?key=eq.${KEEPER_LOCK_KEY}&value=lt.${String(now)}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ value: expiry }),
    })
    if (res.ok) {
      const rows = await res.json()
      if (Array.isArray(rows) && rows.length > 0) return true
    }
    // No row updated: either someone holds it, or the row has never existed. Seeding
    // must not clobber a live holder, so insert-if-absent only.
    const seed = await sbService('/admin_config', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ key: KEEPER_LOCK_KEY, value: expiry }),
    })
    return seed.ok && seed.status !== 409
  } catch { return false }
}

async function releaseKeeperLock() {
  try { await sbService(`/admin_config?key=eq.${KEEPER_LOCK_KEY}`, { method: 'PATCH', body: JSON.stringify({ value: '0' }) }) } catch {}
}

// ── Fail-closed slot reservation ─────────────────────────────────────────────
// The 24h runaway cap reads admin_audit_log, which was only written AFTER a send and
// with the failure swallowed. A successful action is self-limiting (chain state flips
// checkUpkeep to false) — but the loop the cap exists to stop is the swallowed-revert
// one, where it does NOT flip. Flaky DB + swallowed revert used to mean unbounded
// 10-min gas burn. Reserve the slot BEFORE sending and refuse to send if the reserve
// fails, so a broken audit trail fails CLOSED.
async function reserveKeeperSlot(actionName, reason) {
  try {
    const res = await auditLog('keeper_autopilot', 'bank_wallet', { status: 'pending', keeperAction: actionName, reason }, { representation: true })
    if (!res.ok) return null
    const rows = await res.json()
    // Return the row id so the outcome can be reconciled by primary key. A successful
    // insert with no id still counts as a reservation (the slot IS booked).
    return Array.isArray(rows) && rows[0] && typeof rows[0].id === 'number' ? rows[0].id : true
  } catch { return null }
}

// Read-only snapshot of everything the decision needs. No writes, no alerts.
// `enabled` is included deliberately: armed-vs-disarmed is the single most important
// thing an operator needs to see, and without it here the only way to know is DB access.
async function computeKeeperStatus() {
  const pub = createPublicClient({ chain: base, transport: http(KEEPER_RPC) })
  const [needed, performData] = await pub.readContract({ address: KEEPER3_ADDRESS, abi: KEEPER3_ABI, functionName: 'checkUpkeep', args: ['0x'] })
  let action = null
  if (needed && performData && performData !== '0x') {
    try { action = Number(decodeAbiParameters([{ type: 'uint256' }], performData)[0]) } catch {}
  }
  const roundId = await pub.readContract({ address: VOTING_ADDRESS, abi: V3D_ROUND_ABI, functionName: 'currentRoundId' })
  const r = await pub.readContract({ address: VOTING_ADDRESS, abi: V3D_ROUND_ABI, functionName: 'getRound', args: [roundId] })
  const enabled = await readKeeperArmed()
  const hist = await readKeeperHistory()
  // Last tick — is anything actually DRIVING this? A keeper nobody calls is exactly the
  // failure we just spent two weeks not noticing with Chainlink. Every tick (armed or
  // not) writes keeper_autopilot_status.checkedAt, so a stale value here means the
  // 10-min Railway ping has stopped, whatever the rest of the payload says.
  let lastTickAt = null
  try {
    const d = await (await sbService('/admin_config?key=eq.keeper_autopilot_status&select=value&limit=1')).json()
    if (Array.isArray(d) && d[0]) lastTickAt = JSON.parse(d[0].value)?.checkedAt ?? null
  } catch {}
  const tickAgeSec = lastTickAt ? Math.floor((Date.now() - new Date(lastTickAt).getTime()) / 1000) : null
  return {
    enabled,
    lastTickAt,
    tickAgeSec,
    // The ping is every 10 min; 30 min of silence means the driver is down.
    driverAlive: tickAgeSec != null && tickAgeSec < 1800,
    armedHint: enabled ? 'ARMED — closes the round automatically' : "DISARMED — set admin_config.keeper_autopilot_enabled='true' to arm",
    hasBankKey: !!process.env.DEPLOYER_PRIVATE_KEY,
    actionsLast24h: hist.actionsLast24h,
    lastActionAt: hist.lastActionAtSec ? new Date(hist.lastActionAtSec * 1000).toISOString() : null,
    lastActionAtSec: hist.lastActionAtSec,
    roundId: Number(roundId),
    endTime: Number(r[1]),
    settled: r[4],
    vrfPending: r[5],
    profileCount: Number(r[6]),
    upkeepNeeded: needed,
    action,
    actionName: ACTION_NAME[action] || null,
    nowSec: Math.floor(Date.now() / 1000),
  }
}

async function runKeeperAutopilot() {
  // One snapshot feeds both the decision and ?action=keeper-status, so what an operator
  // reads is exactly what the autopilot acted on.
  const status = await computeKeeperStatus()
  const { enabled, actionsLast24h, lastActionAtSec } = status

  const decision = evaluateKeeperAutopilot({
    enabled,
    hasBankKey: status.hasBankKey,
    upkeepNeeded: status.upkeepNeeded,
    action: status.action,
    nowSec: status.nowSec,
    endTime: status.endTime,
    vrfPending: status.vrfPending,
    actionsLast24h,
    lastActionAtSec,
  })

  const token = process.env.BROADCAST_BOT_TOKEN
  const adminChatId = process.env.ADMIN_CHAT_ID || '-5273368658'

  const persistStatus = async (extra = {}) => {
    try {
      await sbService('/admin_config', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key: 'keeper_autopilot_status', value: JSON.stringify({
          checkedAt: new Date().toISOString(), enabled, round: status.roundId,
          endTime: new Date(status.endTime * 1000).toISOString(),
          upkeepNeeded: status.upkeepNeeded, action: status.actionName,
          vrfPending: status.vrfPending, actionsLast24h,
          lastDecision: decision.act ? `execute ${ACTION_NAME[decision.action]}` : decision.reason,
          ...extra,
        }) }),
      })
    } catch {}
  }

  // An alert can fire whether or not we act (VRF stall, runaway cap, unknown action).
  // Cooldown so a stuck state pings once every 6h, not every tick.
  if (decision.alert) {
    let last = 0
    try {
      const d = await (await sbService('/admin_config?key=eq.keeper_autopilot_alert_at&select=value&limit=1')).json()
      if (Array.isArray(d) && d[0]) last = Number(d[0].value) || 0
    } catch {}
    if (Date.now() - last > 6 * 3600 * 1000) {
      await sendTelegram(adminChatId, `🚨 <b>Keeper autopilot</b>\n${decision.alert}`, token).catch(() => {})
      try { await sbService('/admin_config', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'keeper_autopilot_alert_at', value: String(Date.now()) }) }) } catch {}
    }
  }

  if (!decision.act) { await persistStatus(); return { acted: false, reason: decision.reason, status } }

  // MUTEX — only one Bank send at a time across both drivers.
  if (!(await acquireKeeperLock())) {
    await persistStatus({ lastSkip: 'lock held by another tick' })
    return { acted: false, reason: 'another tick holds the Bank signer lock', status }
  }

  // Everything from here runs under one finally, so the lock is freed no matter how we
  // leave — including a throw out of an unguarded RPC read. Structure, not a small TTL,
  // is what guarantees the signer is never stranded.
  try {
    // Refuse if we are not actually the keeper owner — a rewired keeper or a wrong key
    // on Vercel must not be driven by a stale assumption. This runs BEFORE the slot
    // reservation on purpose: a persistent owner mismatch would otherwise book a cap
    // slot every tick without ever sending, and trip a runaway alert that says
    // "something is looping" when nothing looped and the signer was simply wrong.
    const pk = process.env.DEPLOYER_PRIVATE_KEY
    const pkHex = pk.startsWith('0x') ? pk : `0x${pk}`
    const account = privateKeyToAccount(pkHex)
    const pub = createPublicClient({ chain: base, transport: http(KEEPER_RPC) })
    const keeperOwner = await pub.readContract({ address: KEEPER3_ADDRESS, abi: KEEPER3_ABI, functionName: 'owner' })
    if (keeperOwner.toLowerCase() !== account.address.toLowerCase()) {
      await sendTelegram(adminChatId, `🚨 <b>Keeper autopilot</b>\nRefusing to act: Keeper3.owner() is ${keeperOwner} but the configured signer is ${account.address}.`, token).catch(() => {})
      await persistStatus({ lastError: 'signer is not Keeper3.owner()' })
      return { acted: false, reason: 'signer is not Keeper3.owner()', status }
    }

    // RESERVE — book the slot against the 24h cap before spending gas, so a DB outage
    // cannot silently uncap the runaway guard.
    const reserved = await reserveKeeperSlot(ACTION_NAME[decision.action], decision.reason)
    if (!reserved) {
      await sendTelegram(adminChatId, `🚨 <b>Keeper autopilot</b>\nRefusing to act: could not record the action in admin_audit_log, and the 24h runaway guard reads that table. Failing closed rather than acting uncapped. Round ${status.roundId} still needs ${ACTION_NAME[decision.action]}.`, token).catch(() => {})
      await persistStatus({ lastError: 'audit reservation failed — failed closed' })
      return { acted: false, reason: 'audit reservation failed — failing closed', status }
    }

    // SEND — manualExecute(action) from the Bank. The action came from the keeper's own
    // checkUpkeep, and manualExecute can only ever call startRound/settleRound/rollover
    // on the wired voting contract; there is no value transfer and no attacker-controlled
    // parameter anywhere in this path.
    const wallet = createWalletClient({ account, chain: base, transport: http(KEEPER_RPC) })
    let txHash, receipt
    try {
      txHash = await wallet.writeContract({ address: KEEPER3_ADDRESS, abi: KEEPER3_ABI, functionName: 'manualExecute', args: [BigInt(decision.action)] })
      receipt = await pub.waitForTransactionReceipt({ hash: txHash })
    } catch (e) {
      const msg = String(e.message || e).slice(0, 180)
      // The reservation is deliberately NOT rolled back: a failed attempt still consumed
      // gas and still counts against the 24h cap. That is what bounds a revert loop.
      await sendTelegram(adminChatId, `🚨 <b>Keeper autopilot FAILED</b>\n${ACTION_NAME[decision.action]} reverted: ${msg}`, token).catch(() => {})
      await persistStatus({ lastError: msg })
      return { acted: false, error: msg, status }
    }

    // manualExecute wraps the call in try/catch, so a mined transaction is NOT proof the
    // round moved. Ask the chain, don't trust the receipt.
    const after = await computeKeeperStatus()
    const moved = after.roundId !== status.roundId || after.settled !== status.settled || after.vrfPending !== status.vrfPending
    await sendTelegram(adminChatId,
      `${moved ? '🤖' : '⚠️'} <b>Keeper autopilot — ${ACTION_NAME[decision.action]}</b>\n${decision.reason}\nround ${status.roundId} → ${after.roundId} · settled ${status.settled}→${after.settled} · vrfPending ${status.vrfPending}→${after.vrfPending}\n${moved ? '' : 'NO STATE CHANGE — the keeper swallowed a revert. Investigate.\n'}tx <code>${txHash.slice(0, 16)}…</code>`,
      token).catch(() => {})

    // Reconcile the reserved row in place — a second insert would spend two slots of the
    // 24h cap on one action. Only ever by primary key; never a fuzzy match.
    const outcome = JSON.stringify({ status: moved ? 'done' : 'no_state_change', keeperAction: ACTION_NAME[decision.action], reason: decision.reason, moved, before: { round: status.roundId, settled: status.settled, vrfPending: status.vrfPending }, after: { round: after.roundId, settled: after.settled, vrfPending: after.vrfPending }, tx_hash: txHash, block: Number(receipt.blockNumber) })
    let rowId = typeof reserved === 'number' ? reserved : null
    if (rowId == null) {
      // The insert succeeded but returned no id. Recover it, so a completed action is
      // never left reading `pending` in the audit trail.
      try {
        const rows = await (await sbService('/admin_audit_log?config_key=eq.keeper_autopilot&order=id.desc&limit=1&select=id')).json()
        if (Array.isArray(rows) && typeof rows[0]?.id === 'number') rowId = rows[0].id
      } catch {}
    }
    if (rowId != null) {
      await sbService(`/admin_audit_log?id=eq.${rowId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ new_value: outcome }) }).catch(() => {})
    }
    await persistStatus({ lastActionAt: new Date().toISOString(), lastAction: ACTION_NAME[decision.action], lastTx: txHash, lastMoved: moved, reconciled: rowId != null })
    return { acted: true, action: ACTION_NAME[decision.action], moved, txHash, before: status, after }
  } finally {
    await releaseKeeperLock()
  }
}

function oauthSign(method, url, params, consumerKey, consumerSecret, tokenSecret, token) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: '1.0',
  }
  const allParams = { ...params, ...oauthParams }
  const paramStr = Object.keys(allParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`).join('&')
  const sigBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`
  const sigKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`
  const signature = crypto.createHmac('sha1', sigKey).update(sigBase).digest('base64')
  oauthParams.oauth_signature = signature
  return 'OAuth ' + Object.keys(oauthParams)
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ')
}

// ── X posting — @temptationtoken only ────────────────────────────────────────

// America/New_York day-of-week (0=Sun…6=Sat). Prevents UTC midnight drift
// where the 8pm EDT slot (00:00 UTC) would pull the next day's image.
function nyDayOfWeek() {
  const d = new Date()
  const day = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' })
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[day] ?? d.getDay()
}

const DAY_IMAGE = {
  0: 'post1_monday', 1: 'post2_tuesday', 2: 'post3_wednesday',
  3: 'post4_thursday', 4: 'post5_friday', 5: 'post6_saturday', 6: 'post7_sunday',
}

// Asserts the full 0-6 mapping at module load. Throws on any future regression.
;(function assertDayMapping() {
  const expected = [
    'post1_monday','post2_tuesday','post3_wednesday','post4_thursday',
    'post5_friday','post6_saturday','post7_sunday',
  ]
  for (let i = 0; i <= 6; i++) {
    if (DAY_IMAGE[i] !== expected[i])
      throw new Error(`DAY_IMAGE regression: index ${i} expected '${expected[i]}', got '${DAY_IMAGE[i]}'`)
  }
})()

async function uploadMediaForDay(dayOfWeek) {
  const { X_API_KEY, X_API_SECRET, TTS_X_ACCESS_TOKEN, TTS_X_ACCESS_SECRET } = process.env
  if (!X_API_KEY || !TTS_X_ACCESS_TOKEN) return null
  // DB path: post.day_of_week is Mon-first (Mon=0..Sun=6), matches DAY_IMAGE index directly — no shift needed
  // Fallback path: nyDayOfWeek() returns JS-native (Sun=0..Sat=6), shift to Mon-first via (dow+6)%7
  const imgKey = dayOfWeek != null ? dayOfWeek : (nyDayOfWeek() + 6) % 7
  const filename = DAY_IMAGE[imgKey]
  if (!filename) return null
  try {
    const imgUrl = `https://app.temptationtoken.io/social_images/${filename}.png`
    const imgResp = await fetch(imgUrl)
    if (!imgResp.ok) return null
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer())
    const mediaUrl = 'https://upload.twitter.com/1.1/media/upload.json'
    const auth = oauthSign('POST', mediaUrl, {}, X_API_KEY, X_API_SECRET, TTS_X_ACCESS_SECRET, TTS_X_ACCESS_TOKEN)
    const form = new FormData()
    form.append('media', new Blob([imgBuffer], { type: 'image/png' }), 'image.png')
    const r = await fetch(mediaUrl, { method: 'POST', headers: { Authorization: auth }, body: form })
    const body = await r.json()
    if (!r.ok) { console.error('Media upload failed:', r.status, JSON.stringify(body)); return null }
    return body.media_id_string
  } catch (e) {
    console.error('Media upload error:', e.message)
    return null
  }
}

function stripDuplicateCashtags(text) {
  const tokens = text.split(/(\s+)/)
  const seen = new Set()
  const result = []
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i]
    if (/^\$[A-Z]+$/i.test(t.trim()) && t.trim().length > 1) {
      const sym = t.trim().toUpperCase()
      if (seen.has(sym)) continue
      seen.add(sym)
    }
    result.unshift(t)
  }
  return result.join('').trim()
}

async function postTweetTTS(text, dayOfWeek) {
  text = stripDuplicateCashtags(text)
  const { X_API_KEY, X_API_SECRET, TTS_X_ACCESS_TOKEN, TTS_X_ACCESS_SECRET } = process.env
  if (!X_API_KEY || !X_API_SECRET) return { skipped: 'X app credentials not set' }
  if (!TTS_X_ACCESS_TOKEN || !TTS_X_ACCESS_SECRET) return { skipped: 'TTS X credentials not set' }
  const mediaId = await uploadMediaForDay(dayOfWeek)
  const url = 'https://api.twitter.com/2/tweets'
  const auth = oauthSign('POST', url, {}, X_API_KEY, X_API_SECRET, TTS_X_ACCESS_SECRET, TTS_X_ACCESS_TOKEN)
  const tweetBody = { text }
  if (mediaId) tweetBody.media = { media_ids: [mediaId] }
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(tweetBody)
  })
  const body = await r.json()
  if (!r.ok) {
    console.error(`X API ${r.status} (@temptationtoken):`, JSON.stringify(body))
    const err = new Error(`X API ${r.status}: ${JSON.stringify(body)}`)
    err.status = r.status
    throw err
  }
  return body
}

// ── Instagram: send handoff DM to admin ──────────────────────────────────────
// Sends 3 Telegram messages to ADMIN_CHAT_ID: photo, caption block, hashtags+button.
// Sets posted_at=now() (used as "notification sent" flag — prevents re-firing).
// Status stays 'approved' until admin confirms via button or "done" reply.

async function sendInstagramHandoff(post, broadcastToken) {
  const adminChatId = process.env.ADMIN_CHAT_ID || '-5273368658'
  if (!broadcastToken || !adminChatId) return

  const filename = post.image_hint || 'post1_monday'
  const imgUrl   = `https://app.temptationtoken.io/social_images/${filename}.png`
  const caption  = post.content || ''
  const DAYS     = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  const dayName  = DAYS[post.day_of_week] || 'Today'
  let   hashtags = ''
  try { hashtags = JSON.parse(post.instagram_captions || '[]')[0] || '' } catch {}

  const tg = (method, body) => fetch(`https://api.telegram.org/bot${broadcastToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(() => {})

  // 1 — Photo with short header
  await tg('sendPhoto', {
    chat_id: adminChatId,
    photo:   imgUrl,
    caption: `📸 Instagram · ${dayName} · ${filename}.png`,
  })

  // 2 — Caption in code block (copy-paste friendly)
  await tg('sendMessage', {
    chat_id: adminChatId,
    text: `📝 <b>Caption — copy this:</b>\n\n<code>${caption.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code>`,
    parse_mode: 'HTML',
  })

  // 3 — Hashtags + confirm button + post ID
  const confirmUrl = `https://app.temptationtoken.io/api/scheduler?action=ig_confirm&id=${post.id}`
  await tg('sendMessage', {
    chat_id: adminChatId,
    text: `#️⃣ <b>Hashtags — copy this:</b>\n\n<code>${hashtags}</code>\n\n<i>Post image + caption + hashtags to @temptationtoken Instagram.\nTap the button when posted, or reply <b>done</b> to this message.</i>\n\n<code>Post ID: ${post.id}</code>`,
    parse_mode: 'HTML',
    reply_markup: JSON.stringify({
      inline_keyboard: [[{ text: '✅ Mark as Posted', url: confirmUrl }]]
    }),
  })
}

// ── Fire a single scheduled post ─────────────────────────────────────────────

async function firePost(post) {
  const broadcastToken = process.env.BROADCAST_BOT_TOKEN

  // Instagram: send Telegram handoff. posted_at = notification timestamp (prevents re-fire).
  // Status intentionally stays 'approved' until admin confirms — ig_confirm or "done" reply.
  if (post.platform === 'instagram') {
    await sendInstagramHandoff(post, broadcastToken)
    await sbPatch('scheduled_posts', `id=eq.${post.id}`, {
      posted_at: new Date().toISOString(),  // "notified at" — NOT "posted at"
      error: `ig_notified:${new Date().toISOString()}`
    })
    return { platform: 'instagram', id: post.id, status: 'handoff_sent' }
  }

  // Resolve content — instagram uses selected_caption, others use content directly
  const content = post.content

  // Composer posts carry media. Delegate to the shared publish core so the
  // X-media-upload and Telegram sendPhoto/sendVideo paths exist in one place.
  // The hard gate is re-checked here: an asset re-classified as creator media
  // between scheduling and firing must not go out.
  if (post.media_asset_id && (post.platform === 'x_tts' || post.platform === 'telegram')) {
    const c = await import('../lib/social/composer.js')
    let asset
    try {
      asset = await c.loadAsset(post.media_asset_id)
      c.assertPublishable(asset)
    } catch (e) {
      await sbPatch('scheduled_posts', `id=eq.${post.id}`, {
        status: 'failed', posted_at: null, error: `blocked: ${e.message}`.slice(0, 300),
      })
      return { platform: post.platform, id: post.id, blocked: e.message }
    }
    const { results, anyError } = await c.publish({
      asset, caption: content,
      wantX: post.platform === 'x_tts',
      wantTG: post.platform === 'telegram',
    })
    await sbPatch('scheduled_posts', `id=eq.${post.id}`, {
      status: anyError ? 'failed' : 'posted',
      posted_at: anyError ? null : new Date().toISOString(),
      error: anyError || null,
    })
    return { platform: post.platform, id: post.id, results }
  }

  const results = {}
  let anyError = null

  // platform 'x' (legacy Jim posts) — skip; Jim posts manually from content calendar
  if (post.platform === 'x') {
    await sbPatch('scheduled_posts', `id=eq.${post.id}`, {
      status: 'posted',
      posted_at: new Date().toISOString(),
      error: 'manual — @CryptoFitJim posts manually'
    })
    return { platform: 'x', status: 'skipped (manual)', id: post.id }
  }

  if (post.platform === 'x_tts') {
    try {
      // post.day_of_week is Mon-first from DB — pass directly, no shift applied
      results.x = await postTweetTTS(content, post.day_of_week ?? null)
    } catch (e) {
      if (e.status === 429) {
        // Rate limited — reschedule 15 min later, leave status approved
        const reschedule = new Date(Date.now() + 15 * 60 * 1000).toISOString()
        await sbPatch('scheduled_posts', `id=eq.${post.id}`, {
          scheduled_at: reschedule,
          error: `Rate limited @ ${new Date().toISOString()} — retrying at ${reschedule}`
        })
        return { platform: post.platform, id: post.id, rescheduled: reschedule }
      }

      let finalErr = e

      if (e.status >= 500) {
        // Server error — silent retry once after 2 seconds
        await new Promise(r => setTimeout(r, 2000))
        try {
          results.x = await postTweetTTS(content, post.day_of_week ?? null)  // Mon-first, no shift
          finalErr = null  // retry succeeded
        } catch (e2) {
          finalErr = e2
        }
      }

      if (finalErr) {
        anyError = finalErr.message
        results.x_error = finalErr.message
        // Alert admin on any non-2xx (401, 402, 403, 422, 5xx after retry, etc.)
        const adminChatId = process.env.ADMIN_CHAT_ID || '-5273368658'
        const alertToken  = process.env.BROADCAST_BOT_TOKEN
        if (alertToken) {
          const status = finalErr.status ?? '?'
          const hint = status === 401 ? ' — Fix X credentials in Vercel env.'
            : status === 402 ? ' — X API subscription / payment issue.'
            : status === 403 ? ' — Check X app permissions or API plan.'
            : ''
          try {
            await sendTelegram(
              adminChatId,
              `🚨 X post failed (HTTP ${status})${hint}\nPost ID: ${post.id}\n${finalErr.message.slice(0, 200)}`,
              alertToken
            )
          } catch {}
        }
      }
    }
  }

  if (post.platform === 'telegram') {
    try { results.main    = await sendTelegram(MAIN_CHANNEL_ID, content, broadcastToken) }
    catch (e) { results.main_error = e.message; anyError = e.message }
    try { results.community = await sendTelegram(COMMUNITY_CHAT_ID, content, broadcastToken) }
    catch (e) { results.community_error = e.message; anyError = e.message }
  }

  await sbPatch('scheduled_posts', `id=eq.${post.id}`, {
    status: anyError ? 'failed' : 'posted',
    posted_at: anyError ? null : new Date().toISOString(),
    error: anyError || null
  })

  return { platform: post.platform, id: post.id, results }
}

// ── Main handler ──────────────────────────────────────────────────────────────


// ── Listings watcher — the CoinGecko green light ──────────────────────────────
//
// CoinGecko weights liquidity and trade frequency heavily, and a rejected application
// puts you in a cooldown. So rather than guess, this watches the Uniswap V2 pool and
// pings Telegram once there have been 14 CONSECUTIVE days of nonzero volume — the point
// at which the "is it actually traded?" objection stops applying.
//
// Method: sample the pool's cumulative price accumulators + reserves daily. Uniswap V2
// bumps price0CumulativeLast/price1CumulativeLast on every swap-bearing block, and
// blockTimestampLast only moves when the reserves change. If blockTimestampLast has
// advanced since yesterday's sample, the pool traded. That is a swap-detector that costs
// two eth_calls and needs no indexer or paid API.
//
// State lives in admin_config under a single key (JSON), so this needs no new table.
const POOL = '0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68'
const LISTINGS_KEY = 'listings_watch'
const REQUIRED_STREAK_DAYS = 14

async function readPoolState() {
  // getReserves() -> (uint112 r0, uint112 r1, uint32 blockTimestampLast)
  const data = await rpcCall('eth_call', [{ to: POOL, data: '0x0902f1ac' }, 'latest'])
  if (!data || data.length < 2 + 64 * 3) return null
  const h = data.slice(2)
  const r0 = BigInt('0x' + h.slice(0, 64))
  const r1 = BigInt('0x' + h.slice(64, 128))
  const ts = Number(BigInt('0x' + h.slice(128, 192)))
  return { r0: r0.toString(), r1: r1.toString(), blockTimestampLast: ts }
}

async function runListingsWatch() {
  const token = process.env.BROADCAST_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const adminChatId = process.env.ADMIN_CHAT_ID || '-5273368658'

  const pool = await readPoolState().catch(() => null)
  if (!pool) return { ok: false, reason: 'pool read failed' }

  let state = { streak: 0, lastTs: 0, lastSampledDay: null, notifiedAt: null }
  // admin_config is RLS-locked to the service role — sbGet uses the anon key and would
  // silently return nothing, which would reset the streak to 0 every single day.
  try {
    const rows = await (await sbService(`/admin_config?key=eq.${LISTINGS_KEY}&select=value`)).json()
    if (Array.isArray(rows) && rows[0]?.value) state = { ...state, ...JSON.parse(rows[0].value) }
  } catch {}

  const today = new Date().toISOString().slice(0, 10)
  if (state.lastSampledDay === today) {
    return { ok: true, skipped: 'already sampled today', streak: state.streak }
  }

  const traded = state.lastTs > 0 && pool.blockTimestampLast > state.lastTs
  const first = state.lastTs === 0

  // First run only establishes a baseline — we cannot know whether it traded yesterday.
  const streak = first ? 0 : (traded ? state.streak + 1 : 0)

  const next = {
    streak,
    lastTs: pool.blockTimestampLast,
    lastSampledDay: today,
    notifiedAt: state.notifiedAt || null,
  }

  // Fire once, then latch — nobody wants this every day forever.
  if (streak >= REQUIRED_STREAK_DAYS && !state.notifiedAt) {
    const msg = [
      '\u2705 <b>CoinGecko green light</b>',
      '',
      `The TTS/WETH pool has traded on <b>${streak} consecutive days</b>.`,
      'That was the blocker on the CoinGecko application — thin, stale liquidity was the most likely rejection reason, and a rejection means a cooldown.',
      '',
      'Ready to submit: <code>outputs/listings/coingecko_application.md</code> has every field filled.',
      'Run <code>node outputs/listings/circulating.mjs</code> first for a same-day supply figure.',
    ].join('\n')
    await sendTelegram(adminChatId, msg, token).catch(() => {})
    next.notifiedAt = new Date().toISOString()
  }

  await sbService('/admin_config', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify({ key: LISTINGS_KEY, value: JSON.stringify(next) }),
  }).catch(() => {})

  return { ok: true, traded, streak, required: REQUIRED_STREAK_DAYS, notified: Boolean(next.notifiedAt) }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  // ── POST /api/scheduler?action=dispatch — marketing engine dispatcher ───────
  // The Railway worker hits this every ~10 min (Vercel Hobby cron can't do intraday).
  // Bearer CRON_SECRET auth. Exactly-once via posted_events; DST-safe ET schedule.
  if (req.query?.action === 'dispatch') {
    const secret = process.env.CRON_SECRET || ''
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!secret || token !== secret) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const { runDispatch } = await import('../lib/marketing/dispatch.js')
      const { makeDeps } = await import('../lib/marketing/integration.js')
      const fired = await runDispatch(makeDeps())
      return res.status(200).json({ ok: true, fired, dryRun: (process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false' })
    } catch (e) {
      return res.status(200).json({ ok: false, error: String(e.message || e).slice(0, 200) })
    }
  }

  // ── GET /api/scheduler?action=listings-watch — daily pool-volume streak check ─
  if (req.query?.action === 'listings-watch') {
    try { return res.status(200).json(await runListingsWatch()) }
    catch (e) { return res.status(200).json({ ok: false, error: String(e.message || e).slice(0, 200) }) }
  }

  // ── /api/scheduler?action=keeper — keeper autopilot tick ────────────────────
  // Called every ~10 min by the Railway bot with the CRON_SECRET bearer. Chainlink
  // Automation on Base has been dead registry-wide since 2026-08-05; this is what
  // closes the round now. Inert unless admin_config.keeper_autopilot_enabled = true.
  if (req.query?.action === 'keeper') {
    const secret = process.env.CRON_SECRET || ''
    const auth = req.headers.authorization || ''
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!secret || bearer !== secret) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const keeper = await runKeeperAutopilot()
      // The VRF auto-funder rides the same tick. It used to run only on the Vercel cron
      // path, and vrf_autofund_status stopped advancing on 2026-08-12 — the crons are not
      // firing, so the sub-balance monitor and its top-up rule were silently dead while
      // the dashboard card showed a 10-day-old snapshot as if it were current. This ping
      // is the one driver we can prove is alive (the bot has a 10-min loop on Railway).
      // Sequential in one request, so it cannot race the keeper for the Bank nonce.
      let vrfAutoFund = null
      try { vrfAutoFund = await runVrfAutoFunder() } catch (e) { vrfAutoFund = { error: String(e.message || e).slice(0, 160) } }
      return res.status(200).json({ ...keeper, vrfAutoFund })
    }
    catch (e) { return res.status(200).json({ ok: false, error: String(e.message || e).slice(0, 200) }) }
  }

  // ── GET /api/scheduler?action=keeper-status — read-only, no writes, no alerts ─
  if (req.query?.action === 'keeper-status') {
    try { return res.status(200).json(await computeKeeperStatus()) }
    catch (e) { return res.status(200).json({ error: String(e.message || e).slice(0, 200) }) }
  }

  // ── GET /api/scheduler?action=vrf-status — read-only VRF health (no alert) ──
  // For monitoring/testing: returns the current stall + sub-funding computation
  // without sending Telegram or writing state.
  if (req.query?.action === 'vrf-status') {
    try { return res.status(200).json(await computeVrfStatus()) }
    catch (e) { return res.status(200).json({ error: String(e.message || e).slice(0, 200) }) }
  }

  // ── GET /api/scheduler?action=ig_confirm&id=UUID ──────────────────────────
  // Called by the inline Telegram button. Marks IG post as posted, returns HTML.
  if (req.method === 'GET' && req.query?.action === 'ig_confirm') {
    const id = req.query.id
    const HTML_OK = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0f4f8}
.box{text-align:center;padding:32px 24px;background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.1);max-width:320px}
.icon{font-size:52px;margin-bottom:12px}.title{font-size:20px;font-weight:700;margin:0 0 8px}.sub{color:#666;font-size:14px}</style></head>
<body><div class="box"><div class="icon">✅</div><p class="title">Instagram post confirmed!</p><p class="sub">Marked as posted in the scheduler. You can close this.</p></div></body></html>`

    const HTML_ERR = (msg) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff8f0}.box{text-align:center;padding:24px;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.1)}</style></head><body><div class="box"><p style="font-size:36px">⚠️</p><p>${msg}</p></div></body></html>`

    if (!id) {
      res.setHeader('Content-Type', 'text/html')
      return res.status(400).end(HTML_ERR('Missing post ID.'))
    }

    const posts = await sbGet('scheduled_posts', `id=eq.${id}&select=*`)
    if (!Array.isArray(posts) || posts.length === 0) {
      res.setHeader('Content-Type', 'text/html')
      return res.status(404).end(HTML_ERR('Post not found.'))
    }

    const post = posts[0]
    if (post.status === 'posted') {
      res.setHeader('Content-Type', 'text/html')
      return res.status(200).end(HTML_OK)  // idempotent — already confirmed
    }

    await sbPatch('scheduled_posts', `id=eq.${id}`, {
      status: 'posted', posted_at: new Date().toISOString(), error: null
    })

    // Telegram confirmation ping
    const broadcastToken = process.env.BROADCAST_BOT_TOKEN
    const adminChatId    = process.env.ADMIN_CHAT_ID || '-5273368658'
    if (broadcastToken) {
      await sendTelegram(adminChatId, `✅ Instagram post confirmed as posted (ID: ${id.slice(0, 8)}…)`, broadcastToken)
    }

    res.setHeader('Content-Type', 'text/html')
    return res.status(200).end(HTML_OK)
  }

  // Manual fire: POST /api/scheduler?action=fire&id=UUID
  if (req.method === 'POST' && req.query?.action === 'fire') {
    const id = req.query.id || req.body?.id
    if (!id) return res.status(400).json({ error: 'Missing post id' })
    const posts = await sbGet('scheduled_posts', `id=eq.${id}&select=*`)
    if (!Array.isArray(posts) || posts.length === 0) return res.status(404).json({ error: 'Post not found' })
    try {
      const result = await firePost(posts[0])
      return res.status(200).json({ ok: true, result })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  // ── CRON PATH AUTH ──────────────────────────────────────────────────────────
  // Everything below is the unrouted cron body, and it was reachable by anyone: a bare
  // GET https://app.temptationtoken.io/api/scheduler ran runAutoFunder() (Marketing
  // send), runVrfAutoFunder() (Bank → LINK transferAndCall), runKeeperAutopilot()
  // (Bank → manualExecute) and fired scheduled posts. The ?action= handlers above were
  // correctly fail-CLOSED behind CRON_SECRET; this path had no guard at all, so the
  // secret protected the front door while the side door stood open onto the same rooms.
  //
  // Funds were never redirectable — every destination in those jobs is hard-coded — but
  // an anonymous caller could burn Bank gas, exhaust the keeper's 24h cap, and fire
  // posts off-schedule.
  //
  // Accepts EITHER signal so a scheduled run cannot be locked out: Vercel stamps
  // `x-vercel-cron` on cron invocations, and additionally sends
  // `Authorization: Bearer $CRON_SECRET` when that variable is set (it is, in
  // Production). Fail-closed: with CRON_SECRET unset, only the Vercel cron header works.
  {
    const secret = process.env.CRON_SECRET || ''
    const auth = req.headers.authorization || ''
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    const isVercelCron = !!req.headers['x-vercel-cron']
    if (!isVercelCron && !(secret && bearer === secret)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const nowISO   = new Date().toISOString()
  const nowHour  = new Date().getUTCHours()
  const results  = { fired: [], roundStatus: null }

  // ── JOB: referral-wallet auto-funder (daily, 12:00 UTC) ──────────────────
  // Inert by default: short-circuits on auto_fund_enabled=false and refuses
  // without MARKETING_WALLET_PRIVATE_KEY. Funds ONLY from Marketing, never Bank.
  if (nowHour === 12) {
    try { results.autoFund = await runAutoFunder() } catch (e) { results.autoFund = { error: e.message } }
  }

  // ── JOB: listings watcher (daily, 00:00 UTC) ─────────────────────────────
  // Samples the Uniswap pool once a day and counts consecutive traded days. Pings
  // Telegram once at 14 — the point where CoinGecko's liquidity objection stops
  // applying. Latches after firing so it never nags. Self-guards against double
  // sampling if the cron runs twice in a UTC day.
  if (nowHour === 0) {
    try { results.listingsWatch = await runListingsWatch() } catch (e) { results.listingsWatch = { error: e.message } }
  }

  // ── JOB 1: Fire approved posts that are due ──────────────────────────────
  // Instagram posts stay status='approved' after handoff (posted_at set as notification marker).
  // Skip them here if already notified (posted_at !== null) to prevent re-sending.

  try {
    const duePosts = await sbGet(
      'scheduled_posts',
      `status=eq.approved&scheduled_at=lte.${nowISO}&select=*`
    )

    if (Array.isArray(duePosts) && duePosts.length > 0) {
      for (const post of duePosts) {
        // Skip Instagram posts that have already been notified (posted_at set)
        if (post.platform === 'instagram' && post.posted_at) continue
        try {
          const r = await firePost(post)
          results.fired.push(r)
        } catch (e) {
          await sbPatch('scheduled_posts', `id=eq.${post.id}`, {
            status: 'failed', error: e.message
          })
          results.fired.push({ id: post.id, error: e.message })
        }
      }
    }
  } catch (e) {
    results.fired_error = e.message
  }

  // ── JOB 1b: Instagram reminder (hour 15 UTC = 11am EDT) ──────────────────
  // Fires for any IG post notified today but not yet confirmed.

  if (nowHour === 15) {
    const broadcastToken = process.env.BROADCAST_BOT_TOKEN
    const adminChatId    = process.env.ADMIN_CHAT_ID || '-5273368658'
    try {
      const igApproved = await sbGet('scheduled_posts', 'platform=eq.instagram&status=eq.approved&select=*')
      if (Array.isArray(igApproved)) {
        const unconfirmed = igApproved.filter(p => p.error?.startsWith?.('ig_notified:') && p.posted_at)
        if (unconfirmed.length > 0 && broadcastToken) {
          for (const p of unconfirmed) {
            const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
            const confirmUrl = `https://app.temptationtoken.io/api/scheduler?action=ig_confirm&id=${p.id}`
            await sendTelegram(
              adminChatId,
              `⏰ <b>Instagram reminder — ${DAYS[p.day_of_week] || 'today'}</b>\n\nThis post was sent at 8am EDT and hasn't been confirmed yet.\n\nTap to confirm once posted: <a href="${confirmUrl}">Mark as Posted</a>\n\nor reply <b>done</b> to the original handoff message.\n\n<code>Post ID: ${p.id}</code>`,
              broadcastToken
            )
          }
          results.ig_reminders = unconfirmed.length
        }
      }
    } catch (e) { results.ig_reminder_error = e.message }
  }

  // ── JOB 1c: Instagram skip (hour 17 UTC = 1pm EDT) ───────────────────────
  // Marks unconfirmed IG posts as skipped 5 hours after handoff.

  if (nowHour === 17) {
    const adminChatId = process.env.ADMIN_CHAT_ID || '-5273368658'
    const skipToken   = process.env.BROADCAST_BOT_TOKEN
    try {
      const igApproved = await sbGet('scheduled_posts', 'platform=eq.instagram&status=eq.approved&select=*')
      if (Array.isArray(igApproved)) {
        const toSkip = igApproved.filter(p => p.error?.startsWith?.('ig_notified:') && p.posted_at)
        for (const p of toSkip) {
          await sbPatch('scheduled_posts', `id=eq.${p.id}`, { status: 'skipped', error: `skipped:not_confirmed_by_1pm_edt` })
          if (skipToken) {
            const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
            await sendTelegram(adminChatId, `⏭ Instagram post skipped — ${DAYS[p.day_of_week] || 'today'} (no confirmation by 1pm EDT). ID: ${p.id.slice(0, 8)}…`, skipToken)
          }
        }
        results.ig_skipped = toSkip.length
      }
    } catch (e) { results.ig_skip_error = e.message }
  }

  // ── JOB 2: Daily 2pm EST (19:00 UTC) round status update to Telegram ────────

  if (nowHour === 19) {
    const broadcastToken = process.env.BROADCAST_BOT_TOKEN
    if (broadcastToken) {
      try {
        const roundId = await getCurrentRoundId()
        if (roundId) {
          const round = await getRound(roundId)
          if (round && !round.settled) {
            const pool     = Number(round.totalRawVotes) / 1e18
            const timeLeft = formatCountdown(round.endTime)
            const text = [
              `🔥 <b>Round ${roundId} Update</b>`,
              '',
              `👥 ${round.profileCount} profiles competing`,
              `💰 ${pool.toLocaleString(undefined, { maximumFractionDigits: 0 })} $TTS in the pool`,
              `⏱ ${timeLeft} remaining`,
              '',
              'Vote now → <a href="https://app.temptationtoken.io">app.temptationtoken.io</a>',
            ].join('\n')
            try { await sendTelegram(MAIN_CHANNEL_ID, text, broadcastToken) }    catch (e) {}
            try { await sendTelegram(COMMUNITY_CHAT_ID, text, broadcastToken) }  catch (e) {}
            results.roundStatus = { roundId, pool, timeLeft }
          }
        }
      } catch (e) {
        results.roundStatus = { error: e.message }
      }
    }
  }

  // ── JOB 3: Auto-correction alerts ────────────────────────────────────────
  const adminChatId = process.env.ADMIN_CHAT_ID || '-5273368658'
  const adminToken  = process.env.TELEGRAM_BOT_TOKEN

  try {
    // Check LINK balances vs known values (warn if < 2)
    const UPKEEPS = [
      { name: 'TTS Link Reserve Monitor', known: 7.11 },
      { name: 'TTS Settle Or Rollover',   known: 6.2  },
      { name: 'TTS Midpoint Snapshot',    known: 8.2  },
      { name: 'TTS Start Round',          known: 5.9  },
    ]
    for (const u of UPKEEPS) {
      if (u.known < 2) {
        await sendTelegram(adminChatId, `⚠️ LOW LINK: ${u.name} has ${u.known.toFixed(2)} LINK — fund now at https://automation.chain.link/base`, adminToken)
      }
    }

    // Check if round is overdue (ended but not settled)
    const idHex = await rpcCall('eth_call', [{ to: VOTING_ADDRESS, data: '0x9cbe5efd' }, 'latest'])
    if (idHex && idHex !== '0x') {
      const roundId = parseInt(idHex, 16)
      const padded  = roundId.toString(16).padStart(64, '0')
      const rData   = await rpcCall('eth_call', [{ to: VOTING_ADDRESS, data: '0x8f1327c0' + padded }, 'latest'])
      if (rData && rData !== '0x') {
        const chunks = []
        for (let i = 0; i < rData.slice(2).length; i += 64) chunks.push(rData.slice(2 + i, 2 + i + 64))
        const endTime = parseInt(chunks[1], 16)
        const settled = chunks[4] !== '0'.padStart(64, '0')
        if (!settled && Math.floor(Date.now() / 1000) > endTime) {
          const settleLink = `https://basescan.org/address/0x363ce4960e3b459f5892587a37ae1ff2ed04442c#writeContract`
          await sendTelegram(adminChatId,
            `🚨 ROUND ${roundId} OVERDUE — ended ${new Date(endTime * 1000).toLocaleString()} but not settled!\n\nManual settle: ${settleLink}`,
            adminToken)
        }
      }
    }

    // Check if bot hasn't posted in 25+ hours
    const recent = await sbGet('scheduled_posts', `status=eq.posted&order=posted_at.desc&limit=1&select=posted_at`)
    if (Array.isArray(recent) && recent.length > 0 && recent[0].posted_at) {
      const lastPost = new Date(recent[0].posted_at).getTime()
      if (Date.now() - lastPost > 25 * 3600 * 1000) {
        await sendTelegram(adminChatId,
          `⚠️ No posts in 25+ hours! Last post was ${new Date(lastPost).toLocaleString()}. Check Content Calendar.`,
          adminToken)
      }
    }
  } catch (e) {
    results.alerts_error = e.message
  }

  // ── JOB 4: VRF stall + subscription-funding monitor (every run, de-duped) ──
  try { results.vrf = await checkVrfHealth(adminChatId) } catch (e) { results.vrf_error = e.message }

  // ── JOB 4b: VRF subscription auto-funder (every run = 7×/day) ──────────────
  // Tops up OUR sub from Bank if it dips below the reserve. Hard caps + solvency
  // floor + kill switch in evaluateVrfAutoFund(); destination is our subId only.
  try { results.vrfAutoFund = await runVrfAutoFunder() } catch (e) { results.vrfAutoFund_error = e.message }

  // ── JOB: keeper autopilot (every cron tick — backstop for the 10-min Railway ping)
  // Grace + min-interval + 24h cap live in the decision core, so running this on every
  // tick is safe; it is a no-op whenever checkUpkeep says nothing is due.
  try { results.keeper = await runKeeperAutopilot() } catch (e) { results.keeper_error = e.message }

  // ── JOB 4c: first-trophy-mint verifier (one-shot, every run until it fires) ──
  // When the new trophy contract mints its first token (Round 6 settlement, ~Aug 10),
  // confirm tokenURI(1) resolves to our API + the art is a valid SVG, then alert admin
  // Telegram EITHER way and mark done so it never re-fires.
  try { results.trophyMint = await checkTrophyMint() } catch (e) { results.trophyMint_error = e.message }

  // ── JOB 5: Ask TTS chatbot health check (daily, 13:00 UTC) ─────────────────
  // POST a tiny message to /api/chat; alert admin Telegram on failure so a credit
  // lapse (or any API outage) can never go unnoticed. Same channel as the VRF alert.
  if (nowHour === 13) {
    try { results.chatbot = await checkChatbotHealth() } catch (e) { results.chatbot_error = e.message }
  }

  return res.status(200).json({ ok: true, time: nowISO, ...results })
}

// Live probe of the Ask TTS assistant. Healthy = HTTP 200 with a text content block.
// A 5xx (e.g. Anthropic credit lapse) or missing content → alert ADMIN_CHAT_ID.
async function checkChatbotHealth() {
  const url = (process.env.APP_URL || 'https://app.temptationtoken.io') + '/api/chat'
  let ok = false, detail = ''
  try {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: 'You are a health check. Reply with only the word OK.', messages: [{ role: 'user', content: 'ping' }] }),
    })
    if (r.ok) {
      const d = await r.json().catch(() => ({}))
      ok = Array.isArray(d.content) && d.content.some(b => b.type === 'text')
      if (!ok) detail = `HTTP 200 but no text content: ${JSON.stringify(d).slice(0, 180)}`
    } else {
      const t = await r.text().catch(() => '')
      detail = `HTTP ${r.status}: ${t.slice(0, 220)}`
    }
  } catch (e) { detail = `request failed: ${String(e.message || e).slice(0, 180)}` }

  if (!ok) {
    const token = process.env.BROADCAST_BOT_TOKEN
    const adminChatId = process.env.ADMIN_CHAT_ID || '-5273368658'
    const safe = String(detail).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    await sendTelegram(adminChatId,
      `🚨 <b>Ask TTS chatbot health check FAILED</b>\n\n<code>${safe}</code>\n\nLikely an Anthropic credit lapse or API outage — check console.anthropic.com → Plans &amp; Billing. Users see a graceful "taking a quick break" message meanwhile.`,
      token).catch(() => {})
  }
  return { ok, detail: ok ? 'healthy' : detail }
}
