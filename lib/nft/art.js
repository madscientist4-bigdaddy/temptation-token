// TTS trophy art — branded, role-differentiated SVG (renders on-chain-style anywhere:
// MetaMask, OpenSea, wallets). Two modes:
//   • generateTrophySVG()  — GENERIC, ships now, permanent fallback for every token.
//   • composePhotoSVG()    — PHOTO COMPOSITE, built but DISABLED; renders only when the
//     winner opted in (nft_consent) AND PHOTO mode is enabled after legal sign-off.
// Brand tokens mirror the app: void #0B0B0F, gold #F2C14E, hot magenta #FF2D6E.

const BRAND = { void: '#0B0B0F', panel: '#15151D', ink: '#F4F2F7', gold: '#F2C14E', hot: '#FF2D6E', dim: '#8A8797' }

export const ROLES = {
  champion: { title: 'Champion', emblem: '👑', accent: BRAND.gold,  blurb: 'Winning profile' },
  topvoter: { title: 'Top Voter', emblem: '⚔️', accent: BRAND.hot,   blurb: 'Backed the winner hardest' },
  house:    { title: 'House',     emblem: '🏛️', accent: '#9b8cff', blurb: 'Blockchain Entertainment LLC' },
}
export function roleOf(key) { return ROLES[key] || ROLES.champion }

// Vector emblems (NOT emoji — emoji render as tofu/? in most SVG engines incl. wallets).
// Centered ~ (500,445) inside the medallion; filled with the role accent.
function emblemSVG(role, acc) {
  if (role === 'topvoter') {
    // 5-point star
    const cx = 500, cy = 445, ro = 74, ri = 30, pts = []
    for (let i = 0; i < 10; i++) { const a = (-90 + i * 36) * Math.PI / 180, r = i % 2 ? ri : ro; pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`) }
    return `<polygon points="${pts.join(' ')}" fill="${acc}"/>`
  }
  if (role === 'house') {
    return `<g fill="${acc}">
      <polygon points="500,378 432,424 568,424"/>
      <rect x="430" y="424" width="140" height="10"/>
      ${[444, 478, 512, 546].map((x) => `<rect x="${x}" y="438" width="16" height="66"/>`).join('')}
      <rect x="424" y="504" width="152" height="14"/></g>`
  }
  // champion — crown
  return `<g fill="${acc}">
    <polygon points="440,474 454,410 479,452 500,398 521,452 546,410 560,474"/>
    <rect x="440" y="474" width="120" height="26" rx="4"/>
    <circle cx="454" cy="408" r="8"/><circle cx="500" cy="396" r="9"/><circle cx="546" cy="408" r="8"/></g>`
}

const esc = (s) => String(s == null ? '' : s).replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch]))
const fmtDate = (unix) => {
  if (!unix) return ''
  try { return new Date(Number(unix) * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) } catch { return '' }
}

// GENERIC branded trophy. 1000×1000 for crisp wallet/OpenSea rendering.
export function generateTrophySVG({ round, role = 'champion', date, handle } = {}) {
  const r = roleOf(role)
  const acc = r.accent
  const dateStr = fmtDate(date)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <defs>
    <radialGradient id="bg" cx="50%" cy="34%" r="75%">
      <stop offset="0%" stop-color="#1a1220"/><stop offset="55%" stop-color="${BRAND.void}"/><stop offset="100%" stop-color="#050507"/>
    </radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${acc}"/><stop offset="100%" stop-color="${BRAND.hot}"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1000" height="1000" fill="url(#bg)"/>
  <rect x="26" y="26" width="948" height="948" rx="34" fill="none" stroke="#26232e" stroke-width="2"/>
  <text x="500" y="132" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="40" fill="${BRAND.ink}" letter-spacing="6">TEMPTATION TOKEN</text>
  <text x="500" y="172" text-anchor="middle" font-family="ui-monospace, monospace" font-size="20" fill="${BRAND.dim}" letter-spacing="10">ON-CHAIN TROPHY · BASE</text>
  <!-- medallion -->
  <circle cx="500" cy="470" r="216" fill="${BRAND.panel}" stroke="url(#ring)" stroke-width="8" filter="url(#glow)"/>
  <circle cx="500" cy="470" r="188" fill="none" stroke="#2a2a36" stroke-width="2"/>
  ${emblemSVG(role, acc)}
  <text x="500" y="600" text-anchor="middle" font-family="ui-monospace, monospace" font-size="30" fill="${acc}" letter-spacing="4">ROUND ${esc(round)}</text>
  <!-- role plate -->
  <text x="500" y="762" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="86" fill="${acc}">${esc(r.title)}</text>
  <text x="500" y="812" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" fill="${BRAND.dim}">${esc(r.blurb)}</text>
  ${handle ? `<text x="500" y="884" text-anchor="middle" font-family="ui-monospace, monospace" font-size="26" fill="${BRAND.ink}">${esc(handle)}</text>` : ''}
  <text x="500" y="940" text-anchor="middle" font-family="ui-monospace, monospace" font-size="20" fill="#55545f">${esc(dateStr)} · app.temptationtoken.io</text>
</svg>`
}

// PHOTO COMPOSITE (DISABLED until legal sign-off + winner consent). Places a stylized
// (poster/duotone) treatment of the winner's photo inside the trophy frame. `photoHref`
// is a data: URI or URL of the already-consented, already-stylized image.
export function composePhotoSVG({ round, role = 'champion', date, handle, photoHref } = {}) {
  const r = roleOf(role); const acc = r.accent; const dateStr = fmtDate(date)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <defs>
    <radialGradient id="bg" cx="50%" cy="34%" r="75%"><stop offset="0%" stop-color="#1a1220"/><stop offset="60%" stop-color="${BRAND.void}"/><stop offset="100%" stop-color="#050507"/></radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${acc}"/><stop offset="100%" stop-color="${BRAND.hot}"/></linearGradient>
    <clipPath id="clip"><circle cx="500" cy="452" r="196"/></clipPath>
    <!-- poster/cartoon treatment: posterize + saturate + magenta/gold duotone tint -->
    <filter id="poster">
      <feColorMatrix type="saturate" values="1.5"/>
      <feComponentTransfer><feFuncR type="discrete" tableValues="0 .28 .55 .8 1"/><feFuncG type="discrete" tableValues="0 .28 .55 .8 1"/><feFuncB type="discrete" tableValues="0 .28 .55 .8 1"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="1000" height="1000" fill="url(#bg)"/>
  <rect x="26" y="26" width="948" height="948" rx="34" fill="none" stroke="#26232e" stroke-width="2"/>
  <text x="500" y="120" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="40" fill="${BRAND.ink}" letter-spacing="6">TEMPTATION TOKEN</text>
  <circle cx="500" cy="452" r="208" fill="${BRAND.panel}" stroke="url(#ring)" stroke-width="9"/>
  ${photoHref ? `<image href="${esc(photoHref)}" x="304" y="256" width="392" height="392" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip)" filter="url(#poster)"/>` : `<circle cx="500" cy="452" r="196" fill="#111018"/>${emblemSVG(role, BRAND.dim).replace(/cy="445"/g,'cy="452"')}<text x="500" y="600" text-anchor="middle" font-family="ui-monospace, monospace" font-size="22" fill="${BRAND.dim}">PHOTO — CONSENT PENDING</text>`}
  <text x="500" y="740" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="86" fill="${acc}">${esc(roleOf(role).title)}</text>
  <text x="500" y="792" text-anchor="middle" font-family="ui-monospace, monospace" font-size="26" fill="${acc}" letter-spacing="4">ROUND ${esc(round)}</text>
  ${handle ? `<text x="500" y="850" text-anchor="middle" font-family="ui-monospace, monospace" font-size="28" fill="${BRAND.ink}">${esc(handle)}</text>` : ''}
  <text x="500" y="936" text-anchor="middle" font-family="ui-monospace, monospace" font-size="20" fill="#55545f">${esc(dateStr)} · app.temptationtoken.io</text>
</svg>`
}
