// Base RPC proxy + ERC-7677 paymaster proxy.
//
// The paymaster lives here rather than in its own api/*.js file because Vercel Hobby caps
// us at 12 functions and we are exactly at 12. Routed via ?action=paymaster, with
// /api/paymaster rewritten to it in vercel.json.

const cache = {};
const CACHE_TTL = 30000; // 30 seconds

// ── Gasless / sponsorship config ──────────────────────────────────────────────
// Fail-closed by default: with no GASLESS_ENABLED and no CDP URL, every sponsorship
// request is declined and the wallet falls back to user-paid gas. Nothing breaks.
const GASLESS_ENABLED = String(process.env.GASLESS_ENABLED || 'false').toLowerCase() === 'true';
const CDP_PAYMASTER_URL = process.env.CDP_PAYMASTER_URL || '';

// Caps. Per-wallet keeps one user from draining the budget; global is the circuit breaker.
const MAX_OPS_PER_WALLET_PER_DAY = Number(process.env.GASLESS_MAX_OPS_PER_WALLET_PER_DAY || 10);
const MAX_OPS_GLOBAL_PER_DAY = Number(process.env.GASLESS_MAX_OPS_GLOBAL_PER_DAY || 2000);

// Only these contracts may be sponsored. Anything else is somebody using our paymaster as
// a free relay. CDP can also enforce an allowlist server-side — configure it there too;
// this is defence in depth, not a substitute.
const SPONSORED_CONTRACTS = new Set([
  '0x5570ea97d53a53170e973894a9fa7feb5785d3b9', // TTS token (approve / submission fee transfer)
  '0x783b8cd80b586b723188c93ef94ee1beede617b4', // TTSVotingV3d (vote)
  '0x7848cceeb8613375d36ba3f50dd577b4e6bcfc0d', // TTSStaking (stake/unstake/claim)
]);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

function sb(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
}

// ── userOp call-target extraction ─────────────────────────────────────────────
// Coinbase Smart Wallet wraps the real calls in execute()/executeBatch(). We decode the
// target address(es) so the allowlist means something. If we cannot confidently decode,
// we DENY — an undecodable op is exactly the shape an abuser would send.
const SEL_EXECUTE = 'b61d27f6';      // execute(address,uint256,bytes)
const SEL_EXECUTE_BATCH = '34fcd5be'; // executeBatch((address,uint256,bytes)[])

function word(hex, i) { return hex.slice(i * 64, i * 64 + 64); }
function addrFromWord(w) { return ('0x' + w.slice(24)).toLowerCase(); }

function extractTargets(callData) {
  if (typeof callData !== 'string' || !callData.startsWith('0x')) return null;
  const body = callData.slice(2);
  if (body.length < 8) return null;
  const sel = body.slice(0, 8).toLowerCase();
  const args = body.slice(8);

  if (sel === SEL_EXECUTE) {
    if (args.length < 64) return null;
    return [addrFromWord(word(args, 0))];
  }

  if (sel === SEL_EXECUTE_BATCH) {
    try {
      const arrOff = parseInt(word(args, 0), 16) * 2;      // byte offset -> hex chars
      const lenHex = args.slice(arrOff, arrOff + 64);
      const n = parseInt(lenHex, 16);
      if (!Number.isFinite(n) || n < 0 || n > 32) return null;
      const elemsBase = arrOff + 64;
      const out = [];
      for (let i = 0; i < n; i++) {
        const elemOff = parseInt(args.slice(elemsBase + i * 64, elemsBase + i * 64 + 64), 16) * 2;
        const p = elemsBase + elemOff;                      // struct start
        const t = args.slice(p, p + 64);
        if (t.length < 64) return null;
        out.push(addrFromWord(t));
      }
      return out.length ? out : null;
    } catch { return null; }
  }

  return null; // unknown wrapper -> deny
}

// ── Daily sponsorship counters ────────────────────────────────────────────────
// Fail CLOSED on any counter error: if we cannot prove a wallet is under its cap, we do
// not sponsor. A missing table therefore disables sponsorship rather than uncapping it.
async function checkAndCountQuota(sender) {
  if (!SUPABASE_KEY) return { ok: false, reason: 'sponsorship accounting unavailable' };
  const day = new Date().toISOString().slice(0, 10);
  const wallet = String(sender || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(wallet)) return { ok: false, reason: 'bad sender' };

  try {
    const r = await sb(`/gasless_sponsorships?day=eq.${day}&select=wallet,ops`);
    if (!r.ok) return { ok: false, reason: 'sponsorship accounting unavailable' };
    const rows = await r.json();
    const mine = rows.find(x => String(x.wallet).toLowerCase() === wallet);
    const used = mine ? Number(mine.ops || 0) : 0;
    const globalUsed = rows.reduce((a, x) => a + Number(x.ops || 0), 0);

    if (used >= MAX_OPS_PER_WALLET_PER_DAY) {
      return { ok: false, reason: `daily sponsored-transaction limit reached (${MAX_OPS_PER_WALLET_PER_DAY}/day)` };
    }
    if (globalUsed >= MAX_OPS_GLOBAL_PER_DAY) {
      return { ok: false, reason: 'daily sponsorship budget exhausted' };
    }

    // Count on the real grant only (pm_getPaymasterData), not the stub.
    return {
      ok: true,
      commit: async () => {
        if (mine) {
          await sb(`/gasless_sponsorships?day=eq.${day}&wallet=eq.${wallet}`, {
            method: 'PATCH', body: JSON.stringify({ ops: used + 1, updated_at: new Date().toISOString() }),
          });
        } else {
          await sb('/gasless_sponsorships', {
            method: 'POST', body: JSON.stringify({ day, wallet, ops: 1, updated_at: new Date().toISOString() }),
          });
        }
      },
    };
  } catch {
    return { ok: false, reason: 'sponsorship accounting unavailable' };
  }
}

function rpcError(res, id, code, message) {
  return res.status(200).json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
}

async function handlePaymaster(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { id, method, params } = body || {};

  if (!GASLESS_ENABLED) return rpcError(res, id, -32001, 'gasless sponsorship is disabled');
  if (!CDP_PAYMASTER_URL) return rpcError(res, id, -32001, 'paymaster not configured');

  if (method !== 'pm_getPaymasterStubData' && method !== 'pm_getPaymasterData') {
    return rpcError(res, id, -32601, `unsupported method ${method}`);
  }

  const userOp = Array.isArray(params) ? params[0] : null;
  const chainId = Array.isArray(params) ? params[2] : null;
  if (!userOp || typeof userOp !== 'object') return rpcError(res, id, -32602, 'missing userOperation');

  // Base mainnet only. chainId arrives as hex per ERC-7677.
  const cid = typeof chainId === 'string' ? parseInt(chainId, 16) : Number(chainId);
  if (cid && cid !== 8453) return rpcError(res, id, -32602, `unsupported chain ${cid}`);

  const targets = extractTargets(userOp.callData);
  if (!targets) return rpcError(res, id, -32602, 'could not decode call targets');
  const bad = targets.find(t => !SPONSORED_CONTRACTS.has(t));
  if (bad) return rpcError(res, id, -32003, `contract not eligible for sponsorship: ${bad}`);

  const quota = await checkAndCountQuota(userOp.sender);
  if (!quota.ok) return rpcError(res, id, -32004, quota.reason);

  try {
    const upstream = await fetch(CDP_PAYMASTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: id ?? 1, method, params }),
    });
    const data = await upstream.json();
    if (data && data.result && method === 'pm_getPaymasterData') {
      try { await quota.commit(); } catch { /* never fail a granted op on a counter write */ }
    }
    return res.status(200).json(data);
  } catch (e) {
    return rpcError(res, id, -32000, `paymaster upstream error: ${e.message}`);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = (req.query && req.query.action) || '';
  if (action === 'paymaster') return handlePaymaster(req, res);

  try {
    const key = JSON.stringify(req.body);
    const now = Date.now();
    if (cache[key] && now - cache[key].ts < CACHE_TTL) {
      return res.status(200).json(cache[key].data);
    }
    const response = await fetch('https://mainnet.base.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    cache[key] = { data, ts: now };
    res.status(200).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
