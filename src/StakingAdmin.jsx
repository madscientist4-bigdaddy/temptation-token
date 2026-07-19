import { useState, useEffect } from 'react'
import { createPublicClient, http, parseAbi, encodeFunctionData } from 'viem'
import {
  STAKING_ADDRESS, STAKING_CHAIN_ID, STAKING_RPC, STAKING_EXPLORER, STAKING_ABI, MANAGER_ROLE,
} from './config/staking.js'

// Staking admin: read live state + edit tier thresholds / APRs. On mainnet
// MANAGER_ROLE is the Gnosis Safe, so edits are surfaced as Safe-ready calldata
// (copy into the Safe Tx Builder). A direct "Send" path also works when the
// connected wallet holds MANAGER (e.g. the testnet deployer). Dormant until
// VITE_STAKING_ADDRESS is configured.

const ABI = parseAbi(STAKING_ABI)
const client = STAKING_ADDRESS ? createPublicClient({
  chain: { id: STAKING_CHAIN_ID, name: 'staking', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [STAKING_RPC] } } },
  transport: http(STAKING_RPC),
}) : null

const fmt = (w, dp = 0) => w == null ? '—' : (Number(w) / 1e18).toLocaleString(undefined, { maximumFractionDigits: dp })
const toWei = (s) => { const [i, f = ''] = String(s).trim().split('.'); return BigInt((i || '0') + (f + '0'.repeat(18)).slice(0, 18)) }

async function read(fn, args = []) {
  try { return await client.readContract({ address: STAKING_ADDRESS, abi: ABI, functionName: fn, args }) } catch { return null }
}

// Mirror the on-chain guards so bad input is caught before a tx is built.
function validateThresholds(v) {
  const a = v.map(x => { try { return toWei(x) } catch { return -1n } })
  if (a.some(x => x <= 0n)) return 'All thresholds must be > 0'
  for (let i = 1; i < 5; i++) if (a[i] <= a[i - 1]) return 'Must be strictly ascending (Bronze<Silver<Gold<Diamond<VIP)'
  return null
}
function validateAprs(v) {
  const a = v.map(x => Math.round(Number(x) * 100)) // percent → bps
  if (a.some(x => !Number.isFinite(x) || x <= 0)) return 'All APRs must be > 0'
  for (let i = 1; i < 5; i++) if (a[i] < a[i - 1]) return 'APRs must be non-decreasing by tier'
  if (a[4] > 20000) return 'VIP APR exceeds the 200% ceiling'
  return null
}

export default function StakingAdmin() {
  const [state, setState] = useState(null)
  const [thr, setThr] = useState(['', '', '', '', ''])
  const [apr, setApr] = useState(['', '', '', '', ''])
  const [connected, setConnected] = useState(null)
  const [isManager, setIsManager] = useState(null)
  const [msg, setMsg] = useState('')

  const load = async () => {
    if (!client) return
    const [b, s, g, d, v, ab, as_, ag, ad, av, ts, sp, pz] = await Promise.all([
      read('tierThresholdBronze'), read('tierThresholdSilver'), read('tierThresholdGold'),
      read('tierThresholdDiamond'), read('tierThresholdVIP'),
      read('aprBronze'), read('aprSilver'), read('aprGold'), read('aprDiamond'), read('aprVip'),
      read('totalStaked'), read('rewardSurplus'), read('paused'),
    ])
    setState({ thr: [b, s, g, d, v], apr: [ab, as_, ag, ad, av], totalStaked: ts, surplus: sp, paused: !!pz })
  }
  useEffect(() => { load() }, [])

  if (!STAKING_ADDRESS) {
    return (
      <div className="table-card" style={{ marginBottom: 16 }}>
        <div className="table-head"><span className="table-head-title">🥩 Staking Controls</span></div>
        <div style={{ padding: '14px 20px', fontSize: '.68rem', color: 'var(--muted)' }}>
          Not configured. Set <code>VITE_STAKING_ADDRESS</code> (+ chain/RPC) to enable the staking admin panel.
        </div>
      </div>
    )
  }

  const connect = async () => {
    if (!window.ethereum) return alert('MetaMask not found')
    const [acct] = await window.ethereum.request({ method: 'eth_requestAccounts' })
    setConnected(acct)
    const has = await read('hasRole', [MANAGER_ROLE, acct])
    setIsManager(!!has)
  }

  const calldata = (fn, args) => encodeFunctionData({ abi: ABI, functionName: fn, args })

  const send = async (fn, args, label) => {
    if (!connected) return alert('Connect wallet first')
    setMsg(`${label}: submitting…`)
    try {
      const wantHex = '0x' + STAKING_CHAIN_ID.toString(16)
      let chain = await window.ethereum.request({ method: 'eth_chainId' })
      if (chain !== wantHex) {
        try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: wantHex }] }) } catch { /**/ }
        chain = await window.ethereum.request({ method: 'eth_chainId' })
      }
      if (chain !== wantHex) return setMsg(`✕ Wrong network — switch to chain ${STAKING_CHAIN_ID}`)
      const data = calldata(fn, args)
      const hash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from: connected, to: STAKING_ADDRESS, data }] })
      setMsg(`${label}: submitted ${hash.slice(0, 12)}… awaiting confirmation`)
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2500))
        const rc = await client.getTransactionReceipt({ hash }).catch(() => null)
        if (rc) { setMsg(rc.status === 'reverted' || rc.status === '0x0' ? `✕ ${label} reverted` : `✓ ${label} confirmed`); load(); return }
      }
      setMsg(`${label}: still pending — check the explorer`)
    } catch (e) { setMsg(`✕ ${label}: ${e.shortMessage || e.message}`) }
  }

  const submitThresholds = () => {
    const err = validateThresholds(thr); if (err) return setMsg('✕ ' + err)
    send('setTierThresholds', thr.map(toWei), 'setTierThresholds')
  }
  const submitAprs = () => {
    const err = validateAprs(apr); if (err) return setMsg('✕ ' + err)
    send('setAprBps', apr.map(x => Math.round(Number(x) * 100)), 'setAprBps')
  }

  const CopyBtn = ({ fn, args, disabled }) => (
    <button className="ghost-btn" disabled={disabled}
      onClick={() => { navigator.clipboard.writeText(calldata(fn, args)); setMsg('Calldata copied — paste into Safe Tx Builder (to: ' + STAKING_ADDRESS + ')') }}
      style={{ fontSize: '.58rem', padding: '4px 10px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--muted)', borderRadius: 5, cursor: 'pointer' }}>
      Copy Safe calldata
    </button>
  )

  const names = ['Bronze', 'Silver', 'Gold', 'Diamond', 'VIP']
  const thrValid = validateThresholds(thr) === null && thr.every(x => x !== '')
  const aprValid = validateAprs(apr) === null && apr.every(x => x !== '')

  return (
    <div className="table-card" style={{ marginBottom: 16 }}>
      <div className="table-head">
        <span className="table-head-title">🥩 Staking Controls</span>
        {connected
          ? <span style={{ fontSize: '.6rem', color: isManager ? 'var(--green)' : 'var(--gold-dim)', fontFamily: 'monospace' }}>
              {connected.slice(0, 6)}…{connected.slice(-4)} {isManager ? '· MANAGER ✓' : '· not MANAGER (use Safe calldata)'}
            </span>
          : <button onClick={connect} style={{ background: 'var(--crimson)', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 6, cursor: 'pointer', fontSize: '.65rem', fontWeight: 700 }}>🦊 Connect</button>}
      </div>

      {/* Live state */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border2)', fontSize: '.66rem', color: 'var(--muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div>Total staked: <b style={{ color: 'var(--text)' }}>{fmt(state?.totalStaked)} TTS</b></div>
        <div>Reward pool: <b style={{ color: 'var(--text)' }}>{fmt(state?.surplus)} TTS</b></div>
        <div>Paused: <b style={{ color: state?.paused ? 'var(--crimson)' : 'var(--green)' }}>{state ? String(state.paused) : '—'}</b></div>
        <div><a href={`${STAKING_EXPLORER}/address/${STAKING_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-dim)' }}>contract ↗</a></div>
        <div style={{ gridColumn: '1 / 3', marginTop: 4 }}>
          Current thresholds: {state ? state.thr.map(fmt).join(' / ') : '…'} TTS
        </div>
        <div style={{ gridColumn: '1 / 3' }}>
          Current APRs: {state ? state.apr.map(x => x == null ? '—' : (Number(x) / 100) + '%').join(' / ') : '…'}
        </div>
      </div>

      {/* Thresholds editor */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ fontSize: '.7rem', fontWeight: 700, marginBottom: 8 }}>Tier Thresholds (TTS)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 8 }}>
          {names.map((n, i) => (
            <div key={n}>
              <div style={{ fontSize: '.52rem', color: 'var(--muted)', marginBottom: 2 }}>{n}</div>
              <input value={thr[i]} onChange={e => setThr(t => t.map((x, j) => j === i ? e.target.value : x))}
                placeholder="0" style={{ width: '100%', padding: '6px', fontSize: '.62rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={submitThresholds} disabled={!thrValid || !isManager}
            style={{ background: thrValid && isManager ? 'var(--crimson)' : 'var(--surface2)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 5, cursor: thrValid && isManager ? 'pointer' : 'default', fontSize: '.62rem', fontWeight: 700 }}>Send</button>
          <CopyBtn fn="setTierThresholds" args={thrValid ? thr.map(toWei) : [0n, 0n, 0n, 0n, 0n]} disabled={!thrValid} />
          <span style={{ fontSize: '.55rem', color: 'var(--muted)' }}>strict-ascending · ≤4× per-edit guard on-chain</span>
        </div>
      </div>

      {/* APR editor */}
      <div style={{ padding: '14px 20px' }}>
        <div style={{ fontSize: '.7rem', fontWeight: 700, marginBottom: 8 }}>Tier APRs (%) — reward-pool throttle</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 8 }}>
          {names.map((n, i) => (
            <div key={n}>
              <div style={{ fontSize: '.52rem', color: 'var(--muted)', marginBottom: 2 }}>{n}</div>
              <input value={apr[i]} onChange={e => setApr(a => a.map((x, j) => j === i ? e.target.value : x))}
                placeholder="%" style={{ width: '100%', padding: '6px', fontSize: '.62rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={submitAprs} disabled={!aprValid || !isManager}
            style={{ background: aprValid && isManager ? 'var(--crimson)' : 'var(--surface2)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 5, cursor: aprValid && isManager ? 'pointer' : 'default', fontSize: '.62rem', fontWeight: 700 }}>Send</button>
          <CopyBtn fn="setAprBps" args={aprValid ? apr.map(x => Math.round(Number(x) * 100)) : [0, 0, 0, 0, 0]} disabled={!aprValid} />
          <button onClick={() => send(state?.paused ? 'unpause' : 'pause', [], state?.paused ? 'unpause' : 'pause')} disabled={!isManager}
            style={{ marginLeft: 'auto', background: 'var(--surface2)', border: '1px solid var(--border)', color: state?.paused ? 'var(--green)' : 'var(--crimson)', padding: '6px 14px', borderRadius: 5, cursor: isManager ? 'pointer' : 'default', fontSize: '.62rem', fontWeight: 700 }}>
            {state?.paused ? 'Unpause' : 'Pause'}
          </button>
        </div>
      </div>

      {msg && <div style={{ padding: '10px 20px', fontSize: '.62rem', color: 'var(--gold-dim)', borderTop: '1px solid var(--border2)', wordBreak: 'break-all' }}>{msg}</div>}
    </div>
  )
}
