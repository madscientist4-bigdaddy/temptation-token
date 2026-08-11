// ── Shared club contact block ─────────────────────────────────────────────────
// Rendered on /clubs (application page), on /clubs/kit/<code> (unlocked kit) and on the
// "not unlocked yet" state — a club owner who is confused or stuck is most likely to
// look on exactly those screens, and previously had nowhere to turn.
//
// One component rather than three copies: the phone number and booking link are the
// kind of detail that gets updated once and forgotten in the other two places.

export const CALENDLY_URL = 'https://calendly.com/temptationtoken/phone-meeting'
export const CONTACT_EMAIL = 'jim@temptationtoken.io'

export default function ClubContact({ style, compact = false }) {
  const S = {
    card: {
      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(212,175,55,.22)',
      borderRadius: 14, padding: compact ? '14px 16px' : '18px 18px 16px',
      marginTop: 14, ...style,
    },
    label: {
      fontSize: '.66rem', textTransform: 'uppercase', letterSpacing: '.09em',
      color: '#9a9aa8', marginBottom: 10,
    },
    lead: { fontSize: '.82rem', color: '#c8c8d4', lineHeight: 1.6, margin: '0 0 12px' },
    btn: {
      display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center',
      background: 'linear-gradient(135deg,#d4af37,#b8952e)', color: '#0c0c14',
      fontWeight: 700, fontSize: '.9rem', padding: '13px 16px', borderRadius: 11,
      border: 0, textDecoration: 'none', marginBottom: 10,
      // 44px min touch target — this is opened on a phone in a dark dressing room.
      minHeight: 44,
    },
    mail: {
      display: 'block', textAlign: 'center', color: '#d4af37', textDecoration: 'none',
      fontSize: '.86rem', padding: '11px 8px', minHeight: 44, boxSizing: 'border-box',
      border: '1px solid rgba(212,175,55,.3)', borderRadius: 11,
    },
  }

  return (
    <div style={S.card}>
      <div style={S.label}>Questions, sponsorships, promo</div>
      <p style={S.lead}>
        Talk to a person — no bots, no ticket queue. Book a call or email directly.
      </p>
      <a style={S.btn} href={CALENDLY_URL} target="_blank" rel="noreferrer">
        Book a call
      </a>
      <a style={S.mail} href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Temptation Token — club enquiry')}`}>
        {CONTACT_EMAIL}
      </a>
    </div>
  )
}
