// ── /clubs/kit/<code> — the unlocked club kit ─────────────────────────────────
//
// Gated on ON-CHAIN state, not on our database: the page reads clubWallets(code) from
// TTSVotingV3d and renders only if a non-zero payout wallet is registered. That is the
// same fact that actually routes the club's 10% at settlement, so the kit can never show
// as "live" for a club that would not actually get paid — which is exactly the failure a
// database-only check would allow.
//
// Renders on a phone (that's where a club owner opens it) and prints to one page.

import { useEffect, useState } from 'react'
import { createPublicClient, http, parseAbi } from 'viem'
import { base } from 'viem/chains'
import { clubLink, clubQrSvg, openClubOnePager } from './lib/clubKit.js'

const VOTING_ADDRESS = '0x783b8cd80b586b723188c93ef94ee1beede617b4'
const ABI = parseAbi(['function clubWallets(string) view returns (address)'])
const ZERO = '0x0000000000000000000000000000000000000000'

// Reads go through our cached RPC proxy, same as the rest of the app.
const client = createPublicClient({ chain: base, transport: http('/api/rpc') })

export default function ClubKitScreen({ code }) {
  const [state, setState] = useState({ loading: true })
  const [qr, setQr] = useState('')

  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const wallet = await client.readContract({ address: VOTING_ADDRESS, abi: ABI, functionName: 'clubWallets', args: [code] })
        if (dead) return
        if (!wallet || wallet === ZERO) { setState({ loading: false, approved: false }); return }
        // The on-chain record holds the code + wallet, not the display name, so the kit
        // titles itself from the code. That keeps the page truthful with zero extra trust.
        setState({ loading: false, approved: true, wallet, name: code.toUpperCase() })
        setQr(await clubQrSvg(code))
      } catch (e) {
        if (!dead) setState({ loading: false, error: e.message })
      }
    })()
    return () => { dead = true }
  }, [code])

  const S = {
    wrap: { minHeight: '100vh', background: '#0c0c14', color: '#f5f5f5', padding: '28px 18px 60px',
            fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif' },
    inner: { maxWidth: 460, margin: '0 auto' },
    h1: { fontSize: '1.6rem', fontWeight: 800, margin: '0 0 6px', color: '#d4af37' },
    sub: { fontSize: '.86rem', color: '#9a9aa8', lineHeight: 1.6, margin: '0 0 20px' },
    card: { background: '#14141f', border: '1px solid rgba(212,175,55,.22)', borderRadius: 12, padding: 18, marginBottom: 14 },
    btn: { width: '100%', background: 'linear-gradient(135deg,#d4af37,#f0d060)', color: '#0c0c14', border: 0,
           borderRadius: 8, padding: '15px 18px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', marginBottom: 10 },
    ghost: { width: '100%', background: 'transparent', color: '#d4af37', border: '1px solid rgba(212,175,55,.4)',
             borderRadius: 8, padding: '13px 18px', fontSize: '.9rem', fontWeight: 700, cursor: 'pointer', marginBottom: 8,
             display: 'block', textAlign: 'center', textDecoration: 'none' },
    mono: { fontFamily: 'ui-monospace,Menlo,monospace', fontSize: '.75rem', color: '#9a9aa8', wordBreak: 'break-all' },
    code: { fontFamily: 'ui-monospace,Menlo,monospace', fontSize: '1.5rem', color: '#d4af37', fontWeight: 700, letterSpacing: '.05em' },
  }

  if (state.loading) return <div style={S.wrap}><div style={S.inner}><p style={S.sub}>Loading your kit…</p></div></div>

  if (state.error) return (
    <div style={S.wrap}><div style={S.inner}>
      <h1 style={S.h1}>Couldn't load</h1>
      <p style={S.sub}>We couldn't reach the network to confirm this club. Please try again in a moment.</p>
    </div></div>
  )

  if (!state.approved) return (
    <div style={S.wrap}><div style={S.inner}>
      <h1 style={S.h1}>Not unlocked yet</h1>
      <p style={S.sub}>
        This kit unlocks once your club is approved. If you've already applied, go back to
        your application page — it updates by itself the moment you're approved.
      </p>
      <a href="/clubs" style={S.ghost}>Back to my application</a>
    </div></div>
  )

  const link = clubLink(code)
  const share = `We're a Temptation Token partner club. Enter with our code "${code}" and if you win the week, we both get paid: ${link}`

  return (
    <div style={S.wrap}><div style={S.inner}>
      <h1 style={S.h1}>Your Club Kit</h1>
      <p style={S.sub}>Print the one-pager for the dressing room, or share the link directly with your performers.</p>

      <div style={{ ...S.card, textAlign: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 12,
                      width: '100%', maxWidth: 260, marginLeft: 'auto', marginRight: 'auto', boxSizing: 'border-box' }}
             dangerouslySetInnerHTML={{ __html: qr }} />
        <div style={S.code}>{code}</div>
        <div style={{ ...S.mono, marginTop: 6 }}>{link}</div>
      </div>

      <button style={S.btn} onClick={() => openClubOnePager({ clubName: state.name, clubCode: code, walletAddress: state.wallet })}>
        Print the one-pager
      </button>

      <a style={S.ghost} href={`sms:?&body=${encodeURIComponent(share)}`}>Share by text</a>
      <a style={S.ghost} href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer">Share on WhatsApp</a>
      <a style={S.ghost} href={`https://x.com/intent/tweet?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer">Share on X</a>
      <button style={S.ghost} onClick={() => { navigator.clipboard?.writeText(link); }}>Copy my link</button>

      <div style={{ ...S.card, marginTop: 14 }}>
        <div style={{ fontSize: '.66rem', textTransform: 'uppercase', letterSpacing: '.09em', color: '#9a9aa8', marginBottom: 8 }}>Payouts go to</div>
        <div style={S.mono}>{state.wallet}</div>
        <div style={{ fontSize: '.74rem', color: '#7a7a88', marginTop: 10, lineHeight: 1.6 }}>
          Registered on-chain. When a performer who used your code wins the week, 10% of that
          week's pool is sent here automatically at settlement.
        </div>
      </div>
    </div></div>
  )
}
