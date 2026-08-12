// "Get $TTS" — the modal that fires when a user runs out of free $TTS, and from the
// Buy tab. Two routes: SWAP (they already hold ETH/USDC) and CARD (they don't).
//
// The whole design is shaped by one fact: the TTS pool is thin, so we refuse purchases
// over 5% price impact — about $47 today. That makes the card route dangerous by
// default, because Transak's minimum is ~$30 and a user who buys $100 of USDC would be
// left holding USDC they cannot swap. So the card tab is only offered while
// buyWindowUsd().open is true, and the amount is clamped to what the pool can absorb.
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { usePublicClient, useWalletClient, useAccount, useBalance } from 'wagmi'
import { formatUnits, parseEther, parseUnits } from 'viem'
import {
  BUY_ENABLED, SWAP_ENABLED, TRANSAK_ENV, BUY_DISCLOSURE,
  transakUrl, buyWindowUsd, assertBuyConfigured,
} from '../config/buy.js'
import {
  quote, executeSwap, reserves, maxSpendUnderCeiling, fmtTTS, USDC, ERC20_ABI,
} from '../lib/swap.js'

const ETH_USD_FALLBACK = 1900

export default function GetTtsModal({ open, onClose, onFunded, reason }) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [tab, setTab] = useState('swap')
  const [asset, setAsset] = useState('ETH')
  const [amount, setAmount] = useState('0.01')
  const [q, setQ] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)
  const [ethUsd, setEthUsd] = useState(ETH_USD_FALLBACK)
  const [capUsd, setCapUsd] = useState(0)

  const { data: ethBal } = useBalance({ address, query: { enabled: !!address && open } })

  // Live pool depth -> the largest spend we will allow, in USD. Drives both the swap
  // hint and whether the card tab may be shown at all.
  useEffect(() => {
    if (!open || !publicClient) return
    let live = true
    ;(async () => {
      try {
        const res = await reserves(publicClient)
        const capWeth = maxSpendUnderCeiling(res)
        if (live) setCapUsd(Number(formatUnits(capWeth, 18)) * ethUsd)
      } catch { /* leave cap at 0 -> card tab stays closed, which is the safe default */ }
    })()
    return () => { live = false }
  }, [open, publicClient, ethUsd])

  const parsed = useMemo(() => {
    try {
      return asset === 'ETH' ? parseEther(amount || '0') : parseUnits(amount || '0', 6)
    } catch { return 0n }
  }, [amount, asset])

  // Re-quote as the user types, debounced.
  useEffect(() => {
    if (!open || !publicClient || parsed <= 0n) { setQ(null); return }
    let live = true
    setQuoting(true)
    const t = setTimeout(async () => {
      try {
        const res = await quote(publicClient, { from: asset, amountIn: parsed })
        if (live) { setQ(res); setErr('') }
      } catch (e) {
        if (live) setErr(e.message || 'Could not get a quote.')
      } finally {
        if (live) setQuoting(false)
      }
    }, 350)
    return () => { live = false; clearTimeout(t) }
  }, [open, publicClient, parsed, asset])

  const window_ = buyWindowUsd({ maxSpendWethUsd: capUsd })

  const doSwap = useCallback(async () => {
    setErr(''); setBusy(true)
    try {
      const r = await executeSwap({
        publicClient, walletClient, account: address, from: asset, amountIn: parsed,
      })
      setDone({ hash: r.hash, tts: r.quote.ttsOut })
      onFunded?.(r)
    } catch (e) {
      setErr(e.message || 'The swap failed. Nothing was charged.')
    } finally { setBusy(false) }
  }, [publicClient, walletClient, address, asset, parsed, onFunded])

  const openCard = useCallback(() => {
    if (!assertBuyConfigured()) { setErr('Card purchases are not configured.'); return }
    const suggested = Math.max(window_.minUsd, Math.min(window_.maxUsd, 40))
    const url = transakUrl({ walletAddress: address, fiatAmount: suggested, cryptoCurrency: 'USDC' })
    // A popup, not an iframe: Transak's checkout embeds 3-D Secure flows from the card
    // issuer, and those refuse to render inside a third-party frame.
    window.open(url, 'transak', 'width=500,height=720,menubar=no,toolbar=no')
    setTab('swap')
    setAsset('USDC')
    setErr('')
  }, [address, window_])

  if (!open) return null

  return (
    <>
      <style>{CSS}</style>
      <div className="gtts-back" onClick={onClose}>
        <div className="gtts" onClick={(e) => e.stopPropagation()}>
          <button className="gtts-x" onClick={onClose} aria-label="Close">×</button>
          <h2>Get $TTS</h2>
          {reason && <p className="gtts-reason">{reason}</p>}

          {!isConnected && <div className="gtts-note">Connect your wallet first.</div>}

          {isConnected && (
            <>
              <div className="gtts-tabs">
                <button className={tab === 'swap' ? 'on' : ''} onClick={() => setTab('swap')}>
                  I have ETH / USDC
                </button>
                {/* Rendered only when the card leg is genuinely available. A visible-
                    but-disabled tab advertises a payment method we cannot honour, and
                    invites support questions we have no answer to. assertBuyConfigured()
                    additionally refuses a STAGING key inside a production build. */}
                {BUY_ENABLED && assertBuyConfigured() && (
                  <button className={tab === 'card' ? 'on' : ''} onClick={() => setTab('card')}>
                    Pay by card
                  </button>
                )}
              </div>

              {tab === 'swap' && SWAP_ENABLED && (
                <>
                  <div className="gtts-row">
                    <select value={asset} onChange={(e) => setAsset(e.target.value)}>
                      <option value="ETH">ETH</option>
                      <option value="USDC">USDC</option>
                    </select>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      inputMode="decimal"
                      placeholder="0.0"
                    />
                  </div>
                  {asset === 'ETH' && ethBal && (
                    <div className="gtts-bal">balance {Number(ethBal.formatted).toFixed(5)} ETH</div>
                  )}

                  {quoting && <div className="gtts-note">getting a quote…</div>}

                  {q?.ok && (
                    <div className="gtts-quote">
                      <div className="gtts-out">≈ {fmtTTS(q.ttsOut)} <span>$TTS</span></div>
                      <div className="gtts-meta">
                        price impact {(q.impact / 100).toFixed(2)}% · you receive at least{' '}
                        {fmtTTS(q.minOut)} $TTS or the swap reverts
                      </div>
                      {q.impact > 200 && (
                        <div className="gtts-warn">
                          Heads up: this trade moves the price {(q.impact / 100).toFixed(1)}%.
                          A smaller amount costs you less per token.
                        </div>
                      )}
                    </div>
                  )}

                  {q && !q.ok && <div className="gtts-refuse">{q.message}</div>}
                  {err && <div className="gtts-refuse">{err}</div>}

                  {done ? (
                    <div className="gtts-done">
                      Done — {fmtTTS(done.tts)} $TTS is in your wallet.
                      <a href={`https://basescan.org/tx/${done.hash}`} target="_blank" rel="noopener">
                        View on Basescan →
                      </a>
                    </div>
                  ) : (
                    <button
                      className="gtts-go"
                      disabled={!q?.ok || busy || !walletClient}
                      onClick={doSwap}
                    >
                      {busy ? 'Swapping…' : `Swap for $TTS`}
                    </button>
                  )}
                </>
              )}

              {tab === 'card' && (
                <>
                  {!window_.open ? (
                    <div className="gtts-refuse">{window_.reason}</div>
                  ) : (
                    <>
                      <p className="gtts-body">
                        Your card buys <strong>USDC</strong> into your own wallet on Base, then you
                        swap it for $TTS here. No one sells $TTS directly for cash.
                      </p>
                      <div className="gtts-note">
                        Right now you can buy between <strong>${window_.minUsd}</strong> and{' '}
                        <strong>${window_.maxUsd}</strong>. Above that, the swap would move the
                        $TTS price more than 5% and we'd block it — leaving you holding USDC.
                      </div>
                      <button className="gtts-go" onClick={openCard}>
                        Continue to card checkout →
                      </button>
                      {TRANSAK_ENV === 'STAGING' && (
                        <div className="gtts-staging">
                          STAGING — test cards only, no real money moves.
                        </div>
                      )}
                    </>
                  )}
                  <p className="gtts-fine">{BUY_DISCLOSURE}</p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

const CSS = `
.gtts-back{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:9500;display:flex;
align-items:center;justify-content:center;padding:20px}
.gtts{width:100%;max-width:420px;background:var(--surface,#12121e);border:1px solid var(--border,rgba(212,175,55,.18));
border-radius:16px;padding:24px;position:relative;max-height:90vh;overflow-y:auto}
.gtts h2{font-family:var(--font-d,serif);font-style:italic;font-weight:400;font-size:1.7rem;
color:var(--text,#f0e8d8);margin-bottom:6px;text-align:center}
.gtts-x{position:absolute;top:12px;right:14px;background:none;border:none;color:var(--muted,#8a8580);
font-size:1.5rem;cursor:pointer;min-height:44px;min-width:44px}
.gtts-reason{font-size:.76rem;color:var(--gold,#d4af37);text-align:center;margin-bottom:16px;line-height:1.5}
.gtts-tabs{display:flex;gap:8px;margin:16px 0 18px}
.gtts-tabs button{flex:1;min-width:0;background:none;border:1px solid var(--border2,rgba(255,255,255,.07));
color:var(--muted,#8a8580);border-radius:8px;padding:11px;font-size:.72rem;cursor:pointer;min-height:44px;font-family:inherit}
.gtts-tabs button.on{border-color:var(--gold,#d4af37);color:var(--gold,#d4af37)}
.gtts-tabs button:disabled{opacity:.35;cursor:not-allowed}
.gtts-row{display:flex;gap:8px}
.gtts-row select,.gtts-row input{background:var(--void,#05050a);border:1px solid var(--border2,rgba(255,255,255,.07));
border-radius:8px;color:var(--text,#f0e8d8);padding:13px;font-size:1rem;min-height:48px;font-family:inherit}
.gtts-row select{flex:0 0 96px}.gtts-row input{flex:1;min-width:0}
.gtts-bal{font-size:.65rem;color:var(--muted,#8a8580);margin-top:6px;text-align:right}
.gtts-quote{margin-top:16px;padding:14px;background:rgba(212,175,55,.06);
border:1px solid var(--border,rgba(212,175,55,.18));border-radius:10px}
.gtts-out{font-size:1.5rem;font-weight:800;color:var(--gold-light,#f0d060);text-align:center}
.gtts-out span{font-size:.8rem;color:var(--gold-dim,rgba(212,175,55,.6))}
.gtts-meta{font-size:.65rem;color:var(--muted,#8a8580);text-align:center;margin-top:6px;line-height:1.5}
.gtts-warn{margin-top:10px;font-size:.68rem;color:var(--gold,#d4af37);line-height:1.5}
.gtts-refuse{margin-top:14px;padding:13px;background:rgba(232,64,90,.08);
border:1px solid rgba(232,64,90,.3);border-radius:10px;font-size:.72rem;color:#e8405a;line-height:1.6}
.gtts-note{margin-top:12px;font-size:.7rem;color:var(--muted,#8a8580);line-height:1.6}
.gtts-body{font-size:.76rem;color:var(--text,#f0e8d8);line-height:1.6;margin-top:6px}
.gtts-go{width:100%;margin-top:16px;background:var(--crimson-glow,#c0253a);color:#fff;border:none;
border-radius:8px;padding:15px;font-size:.8rem;font-weight:700;letter-spacing:.05em;cursor:pointer;
min-height:50px;font-family:inherit;text-transform:uppercase}
.gtts-go:disabled{opacity:.4;cursor:not-allowed}
.gtts-done{margin-top:16px;padding:14px;background:rgba(46,204,113,.08);border:1px solid rgba(46,204,113,.3);
border-radius:10px;font-size:.76rem;color:#2ecc71;line-height:1.7;text-align:center}
.gtts-done a{display:block;margin-top:8px;color:#2ecc71}
.gtts-staging{margin-top:10px;font-size:.62rem;color:var(--gold,#d4af37);text-align:center;letter-spacing:.06em}
.gtts-fine{margin-top:14px;font-size:.62rem;color:var(--muted,#8a8580);line-height:1.6}
`
