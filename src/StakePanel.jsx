import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, http, parseAbi } from 'viem'
import { useAccount, useWalletClient } from 'wagmi'
import {
  STAKING_ADDRESS, STAKING_TTS, STAKING_CHAIN_ID, STAKING_RPC, STAKING_EXPLORER,
  STAKING_ABI, TIER_NAMES, TIER_BOOSTS,
} from './config/staking.js'
import { describeTxError } from './lib/txError.js'

// Read client for whatever chain the staking contract lives on (config-driven).
const stakingClient = createPublicClient({
  chain: {
    id: STAKING_CHAIN_ID,
    name: 'staking-chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [STAKING_RPC] } },
  },
  transport: http(STAKING_RPC),
})

const TTS_MIN_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
])
const ABI = parseAbi(STAKING_ABI)

const fmt = (wei, dp = 2) => {
  if (wei == null) return '—'
  const n = Number(wei) / 1e18
  return n.toLocaleString(undefined, { maximumFractionDigits: dp })
}
const toWei = (s) => {
  // parse decimal string → 18-dec bigint without float error
  const [i, f = ''] = String(s).trim().split('.')
  const frac = (f + '0'.repeat(18)).slice(0, 18)
  return BigInt((i || '0') + frac)
}

async function read(fn, args = []) {
  try {
    return await stakingClient.readContract({ address: STAKING_ADDRESS, abi: ABI, functionName: fn, args })
  } catch { return null }
}

async function waitReceipt(hash) {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await stakingClient.getTransactionReceipt({ hash })
      if (r) {
        if (r.status === 'reverted' || r.status === '0x0') throw new Error('Transaction reverted on-chain')
        return r
      }
    } catch (e) { if (String(e.message).includes('reverted')) throw e }
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error('Receipt timeout')
}

function Countdown({ eligibleAt }) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  if (!now) return <span>…</span>
  const left = Number(eligibleAt) - now
  if (left <= 0) return <span style={{ color: 'var(--gold)' }}>Multiplier active ✓</span>
  const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600), m = Math.floor((left % 3600) / 60)
  return <span>Multiplier in {d}d {h}h {m}m</span>
}

export default function StakePanel({ showToast }) {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [details, setDetails] = useState(null) // getStakeDetails tuple
  const [balance, setBalance] = useState(null)
  const [surplus, setSurplus] = useState(null)
  const [totalStaked, setTotalStaked] = useState(null)
  const [paused, setPaused] = useState(false)
  const [amt, setAmt] = useState('')
  const [busy, setBusy] = useState('')

  const refresh = useCallback(async () => {
    const [ts, sp, pz] = await Promise.all([read('totalStaked'), read('rewardSurplus'), read('paused')])
    setTotalStaked(ts); setSurplus(sp); setPaused(!!pz)
    if (address) {
      const d = await read('getStakeDetails', [address])
      setDetails(d)
      try {
        const b = await stakingClient.readContract({ address: STAKING_TTS, abi: TTS_MIN_ABI, functionName: 'balanceOf', args: [address] })
        setBalance(b)
      } catch { /* ignore */ }
    }
  }, [address])

  useEffect(() => { refresh(); const id = setInterval(refresh, 15000); return () => clearInterval(id) }, [refresh])

  const ensureChain = async () => {
    if (!walletClient) throw new Error('Connect your wallet first')
    try { await walletClient.switchChain({ id: STAKING_CHAIN_ID }) } catch { /* user may already be on it */ }
  }

  const doWrite = async (fn, args = [], label = 'Transaction') => {
    setBusy(fn)
    try {
      await ensureChain()
      const hash = await walletClient.writeContract({ address: STAKING_ADDRESS, abi: ABI, functionName: fn, args, chainId: STAKING_CHAIN_ID })
      showToast?.(`${label} submitted…`)
      await waitReceipt(hash)
      showToast?.(`${label} confirmed ✓`)
      await refresh()
    } catch (e) {
      showToast?.(describeTxError ? describeTxError(e) : (e.shortMessage || e.message || 'Failed'))
    } finally { setBusy('') }
  }

  const onStake = async () => {
    if (!amt || Number(amt) <= 0) return showToast?.('Enter an amount')
    const wei = toWei(amt)
    setBusy('stake')
    try {
      await ensureChain()
      // approve if needed
      const allowance = await stakingClient.readContract({ address: STAKING_TTS, abi: TTS_MIN_ABI, functionName: 'allowance', args: [address, STAKING_ADDRESS] })
      if (allowance < wei) {
        const ah = await walletClient.writeContract({ address: STAKING_TTS, abi: TTS_MIN_ABI, functionName: 'approve', args: [STAKING_ADDRESS, wei], chainId: STAKING_CHAIN_ID })
        showToast?.('Approval submitted…'); await waitReceipt(ah)
      }
      const hash = await walletClient.writeContract({ address: STAKING_ADDRESS, abi: ABI, functionName: 'stake', args: [wei], chainId: STAKING_CHAIN_ID })
      showToast?.('Stake submitted…'); await waitReceipt(hash)
      showToast?.('Staked ✓ — 7-day multiplier clock started'); setAmt(''); await refresh()
    } catch (e) {
      showToast?.(describeTxError ? describeTxError(e) : (e.shortMessage || e.message || 'Failed'))
    } finally { setBusy('') }
  }

  const principal = details?.[0], eligibleAt = details?.[1]
  const tierByAmount = details ? Number(details[3]) : -1, aprBps = details ? Number(details[4]) : 0
  const pending = details?.[5], claimable = details?.[6]
  const hasStake = principal != null && principal > 0n

  return (
    <div className="stk-live">
      {paused && (
        <div style={{ background: '#3a1a1a', border: '1px solid #a44', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '.72rem', color: '#f7b' }}>
          Staking is paused. Your principal is always withdrawable via Emergency Withdraw.
        </div>
      )}

      {/* Position summary */}
      <div className="stk-info" style={{ marginBottom: 14 }}>
        <div className="stk-title" style={{ marginBottom: 10 }}>Your Position</div>
        <Row l="Staked principal" v={`${fmt(principal)} $TTS`} />
        <Row l="Tier" v={tierByAmount >= 0 ? `${TIER_NAMES[tierByAmount]} · ${TIER_BOOSTS[tierByAmount]} · ${(aprBps / 100).toFixed(0)}% APR` : (hasStake ? 'Below Bronze' : '—')} />
        <Row l="Multiplier status" v={hasStake ? <Countdown eligibleAt={eligibleAt} /> : '—'} />
        <Row l="Pending rewards" v={`${fmt(pending, 4)} $TTS`} />
        <Row l="Wallet balance" v={`${fmt(balance)} $TTS`} />
      </div>

      {/* Stake */}
      <label className="flabel">Amount to stake</label>
      <input className="finput" type="number" placeholder="0.00" value={amt} onChange={e => setAmt(e.target.value)} />
      <button className="pbtn" disabled={!isConnected || !!busy || paused} onClick={onStake}>
        {busy === 'stake' ? 'Working…' : 'Stake $TTS'}
      </button>

      {/* Manage existing */}
      {hasStake && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="sbtn" style={{ flex: 1 }} disabled={!!busy || paused || !claimable || claimable === 0n}
            onClick={() => doWrite('claim', [], 'Claim')}>
            {busy === 'claim' ? '…' : `Claim ${fmt(claimable, 2)}`}
          </button>
          <button className="sbtn" style={{ flex: 1 }} disabled={!!busy || paused}
            onClick={() => { const a = amt && Number(amt) > 0 ? toWei(amt) : principal; doWrite('unstake', [a], 'Unstake') }}>
            {busy === 'unstake' ? '…' : (amt && Number(amt) > 0 ? 'Unstake amount' : 'Unstake all')}
          </button>
        </div>
      )}
      {hasStake && (
        <button className="sbtn" style={{ width: '100%', marginTop: 8, borderColor: '#a44', color: '#f7b' }}
          disabled={busy === 'emergencyWithdraw'} onClick={() => doWrite('emergencyWithdraw', [], 'Emergency withdraw')}>
          {busy === 'emergencyWithdraw' ? '…' : 'Emergency Withdraw (principal, anytime)'}
        </button>
      )}

      {/* Global + tiers */}
      <div className="stk-info" style={{ marginTop: 16 }}>
        <div className="stk-title" style={{ marginBottom: 8 }}>Staking Tiers</div>
        <TierTable />
        <div className="sub-note" style={{ marginTop: 10 }}>
          Principal is withdrawable anytime. The vote multiplier activates 7 days after your last stake.
          Total staked {fmt(totalStaked, 0)} · reward pool {fmt(surplus, 0)} $TTS ·{' '}
          <a href={`${STAKING_EXPLORER}/address/${STAKING_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted)' }}>contract</a>
        </div>
      </div>
    </div>
  )
}

function Row({ l, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '.78rem' }}>
      <span style={{ color: 'var(--muted)' }}>{l}</span>
      <span style={{ fontWeight: 600 }}>{v}</span>
    </div>
  )
}

function TierTable() {
  const [thr, setThr] = useState(null)
  useEffect(() => {
    (async () => {
      const [b, s, g, d, v] = await Promise.all([
        read('tierThresholdBronze'), read('tierThresholdSilver'), read('tierThresholdGold'),
        read('tierThresholdDiamond'), read('tierThresholdVIP'),
      ])
      setThr([b, s, g, d, v])
    })()
  }, [])
  const aprs = ['8%', '12%', '18%', '32%', '45%']
  return (
    <div className="stk-tiers">
      {TIER_NAMES.map((name, i) => (
        <div key={name} className="stk-tier">
          <div>
            <div className={`tn ${name}`}>{name}</div>
            <div className="tr2">{thr && thr[i] != null ? `${fmt(thr[i], 0)}+ $TTS` : '…'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="tboost">{TIER_BOOSTS[i]} Votes</div>
            <div className="tapr">{aprs[i]} APR</div>
          </div>
        </div>
      ))}
    </div>
  )
}
