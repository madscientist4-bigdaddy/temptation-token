// ── /clubs — self-serve partner onboarding ────────────────────────────────────
//
// Target: a club owner completes this from a barstool in under two minutes, with no
// email, no text, and no gas. They give a name + city and a payout address — either a
// wallet they already have, or one created inline with a passkey (Face ID / Touch ID).
//
// Club owners NEVER transact. The only on-chain write is setClubWallet, signed by Bank
// when an admin approves. So there is nothing to sponsor here and no paymaster involved.
//
// After applying, the screen parks on "Application received" and polls its own status.
// The moment an admin approves, it swaps to the unlocked kit link without a refresh.

import { useState, useEffect, useCallback } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import ClubContact from './ClubContact.jsx'

const POLL_MS = 8000

export default function ClubsScreen() {
  const { address, isConnected } = useAccount()
  const { connectors, connect, isPending: connecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { open } = useAppKit()

  const [clubName, setClubName] = useState('')
  const [city, setCity] = useState('')
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [app, setApp] = useState(null)   // { clubCode, status }

  // The smart-wallet connector — this is the "create one now with Face ID" path.
  const smartWallet = connectors.find(c => /coinbase/i.test(c.name || c.id))

  // If this wallet already applied (or is already a partner), pick that up on connect so
  // a returning owner sees their status instead of a blank form they'd fill in twice.
  const refresh = useCallback(async (silent) => {
    if (!address) return
    try {
      const r = await fetch(`/api/clubs/status?wallet=${address}`)
      const d = await r.json()
      if (d.ok && d.found) setApp({ clubCode: d.clubCode, status: d.status, clubName: d.clubName, city: d.city })
    } catch { if (!silent) setErr('Could not reach the server. Check your connection.') }
  }, [address])

  useEffect(() => { if (isConnected) refresh(true) }, [isConnected, refresh])

  // Live-update while pending — this is what makes approval feel instant to the owner.
  useEffect(() => {
    if (!app || app.status !== 'pending') return
    const t = setInterval(() => refresh(true), POLL_MS)
    return () => clearInterval(t)
  }, [app, refresh])

  const submit = async () => {
    setErr('')
    if (clubName.trim().length < 2) return setErr('Please enter your club name.')
    if (city.trim().length < 2) return setErr('Please enter your city.')
    if (contact.trim().length < 3) return setErr('Please add a best contact — phone, email or IG.')
    if (!isConnected || !address) return setErr('Connect or create a wallet first — this is where your payouts go.')
    setBusy(true)
    try {
      const r = await fetch('/api/clubs/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubName: clubName.trim(), city: city.trim(), contact: contact.trim(), walletAddress: address }),
      })
      const d = await r.json()
      if (!d.ok) setErr(d.error || 'Something went wrong. Please try again.')
      else setApp({ clubCode: d.clubCode, status: d.status || 'pending', clubName: clubName.trim(), city: city.trim() })
    } catch {
      setErr('Could not reach the server. Check your connection and try again.')
    }
    setBusy(false)
  }

  const S = {
    wrap: { minHeight: '100vh', background: '#0c0c14', color: '#f5f5f5', padding: '28px 18px 60px',
            fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif' },
    inner: { maxWidth: 460, margin: '0 auto' },
    h1: { fontSize: '1.7rem', fontWeight: 800, margin: '0 0 6px', color: '#d4af37', letterSpacing: '-.01em' },
    sub: { fontSize: '.86rem', color: '#9a9aa8', lineHeight: 1.6, margin: '0 0 22px' },
    card: { background: '#14141f', border: '1px solid rgba(212,175,55,.22)', borderRadius: 12, padding: 18, marginBottom: 14 },
    label: { fontSize: '.66rem', textTransform: 'uppercase', letterSpacing: '.09em', color: '#9a9aa8', marginBottom: 6, display: 'block' },
    input: { width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(212,175,55,.3)',
             borderRadius: 8, color: '#f5f5f5', padding: '13px 14px', fontSize: '1rem', marginBottom: 14, boxSizing: 'border-box' },
    btn: { width: '100%', background: 'linear-gradient(135deg,#d4af37,#f0d060)', color: '#0c0c14', border: 0,
           borderRadius: 8, padding: '15px 18px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer' },
    ghost: { width: '100%', background: 'transparent', color: '#d4af37', border: '1px solid rgba(212,175,55,.4)',
             borderRadius: 8, padding: '13px 18px', fontSize: '.9rem', fontWeight: 700, cursor: 'pointer', marginTop: 10 },
    err: { color: '#ff6b81', fontSize: '.8rem', marginBottom: 12, lineHeight: 1.5 },
    pill: { display: 'inline-block', background: 'rgba(212,175,55,.12)', border: '1px solid rgba(212,175,55,.3)',
            color: '#d4af37', borderRadius: 999, padding: '5px 12px', fontSize: '.7rem', fontWeight: 700, marginBottom: 12 },
    mono: { fontFamily: 'ui-monospace,Menlo,monospace', fontSize: '.75rem', color: '#9a9aa8', wordBreak: 'break-all' },
    li: { fontSize: '.86rem', color: '#c9c9d4', lineHeight: 1.65, marginBottom: 8 },
  }

  // ── Post-application states ─────────────────────────────────────────────────
  if (app) {
    const approved = app.status === 'approved'
    const denied = app.status === 'denied'
    return (
      <div style={S.wrap}><div style={S.inner}>
        <h1 style={S.h1}>{approved ? "You're a Partner Club" : denied ? 'Application closed' : 'Application received'}</h1>
        {denied ? (
          <p style={S.sub}>
            We weren't able to approve this application. If you think that's a mistake,
            reply to whoever gave you this link and we'll take another look.
          </p>
        ) : approved ? (
          <>
            <p style={S.sub}>Your kit is unlocked. Print it, put it in the dressing room, and your performers can join by scanning it.</p>
            <div style={S.card}>
              <span style={S.pill}>CODE · {app.clubCode}</span>
              <a href={`/clubs/kit/${app.clubCode}`} style={{ ...S.btn, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                Open my club kit
              </a>
            </div>
          </>
        ) : (
          <>
            <p style={S.sub}>
              Your kit unlocks as soon as we approve you — usually the same day. Leave this
              page open and it'll update by itself. Nothing else is needed from you.
            </p>
            <div style={S.card}>
              <span style={S.pill}>PENDING REVIEW</span>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>{app.clubName || clubName}</div>
              <div style={{ fontSize: '.82rem', color: '#9a9aa8', marginBottom: 12 }}>{app.city || city}</div>
              <div style={S.label}>Your code</div>
              <div style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: '1.2rem', color: '#d4af37', fontWeight: 700, marginBottom: 12 }}>{app.clubCode}</div>
              <div style={S.label}>Payouts go to</div>
              <div style={S.mono}>{address}</div>
            </div>
            <p style={{ ...S.sub, fontSize: '.78rem' }}>
              Bookmark this page — reconnecting the same wallet always brings you back here.
            </p>
          </>
        )}
      </div></div>
    )
  }

  // ── Application form ────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}><div style={S.inner}>
      <h1 style={S.h1}>Become a Partner Club</h1>
      <p style={S.sub}>
        When a performer who used your code wins the week, your club is paid <strong style={{ color: '#d4af37' }}>10%
        of that week's prize pool</strong> — automatically, straight to your wallet. It's free to join,
        free for your performers, and takes about a minute.
      </p>

      <div style={S.card}>
        <label style={S.label}>Club name</label>
        <input style={S.input} value={clubName} onChange={e => setClubName(e.target.value)}
               placeholder="The Dollhouse" autoComplete="organization" />
        <label style={S.label}>City</label>
        <input style={S.input} value={city} onChange={e => setCity(e.target.value)}
               placeholder="Tampa, FL" autoComplete="address-level2" />

        <label style={S.label}>Best contact (phone, email, or IG)</label>
        <input style={S.input} value={contact} onChange={e => setContact(e.target.value)}
               placeholder="(813) 555-0134 · manager@club.com · @thedollhouse"
               autoComplete="tel" inputMode="text" />
        <p style={{ fontSize: '.7rem', color: '#7a7a88', margin: '-6px 0 14px', lineHeight: 1.5 }}>
          How we reach you about your application, payouts and promo. Whatever you actually answer.
        </p>

        <label style={S.label}>Where your payouts go</label>
        {isConnected ? (
          <div style={{ marginBottom: 14 }}>
            <div style={S.mono}>{address}</div>
            <button style={{ ...S.ghost, marginTop: 8 }} onClick={() => disconnect()}>Use a different wallet</button>
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            {smartWallet && (
              <button style={S.btn} disabled={connecting}
                      onClick={() => connect({ connector: smartWallet })}>
                {connecting ? 'Opening…' : 'Create a wallet with Face ID'}
              </button>
            )}
            <button style={S.ghost} onClick={() => open()}>I already have a wallet</button>
            <p style={{ fontSize: '.72rem', color: '#7a7a88', marginTop: 10, lineHeight: 1.55 }}>
              No crypto experience needed. Creating a wallet takes a few seconds with Face ID
              or Touch ID — there's nothing to buy, download or fund.
            </p>
          </div>
        )}

        {err && <div style={S.err}>{err}</div>}
        <button style={{ ...S.btn, opacity: busy ? .6 : 1 }} disabled={busy} onClick={submit}>
          {busy ? 'Sending…' : 'Apply to become a partner'}
        </button>
      </div>

      <div style={S.card}>
        <div style={{ ...S.label, marginBottom: 10 }}>What happens next</div>
        <div style={S.li}>1. We review your application — usually the same day.</div>
        <div style={S.li}>2. Your club kit unlocks: a printable one-pager with your QR code.</div>
        <div style={S.li}>3. Your performers scan it, enter, and you earn when they win.</div>
      </div>

      <ClubContact />

      <p style={{ fontSize: '.7rem', color: '#6a6a78', lineHeight: 1.6 }}>
        Entrants must be 18+ and pass a one-time ID check. Photos must be clothed and SFW.
        10% of every weekly pool goes to the Polaris Project. Operated by Blockchain
        Entertainment LLC.
      </p>
    </div></div>
  )
}
