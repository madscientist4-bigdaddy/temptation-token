// Generates public/social_images/post1_monday.png through post7_sunday.png
// Zero emoji — all decorative elements are SVG primitives or U+25xx Geometric Shapes.
// Run: node generate_social_images.js

const { Resvg } = require('@resvg/resvg-js')
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, 'public', 'social_images')
fs.mkdirSync(OUT, { recursive: true })

// ─── Shared SVG fragments ────────────────────────────────────────────────────

const HEADER = `
  <text x="54" y="88" font-family="Georgia, serif" font-size="28" font-weight="700" fill="#c9a84c" letter-spacing="3">TEMPTATION TOKEN</text>
  <text x="54" y="112" font-family="Arial, sans-serif" font-size="16" fill="#888" letter-spacing="2">$TTS  ·  BASE BLOCKCHAIN</text>`

const BORDER_GOLD = `<rect x="24" y="24" width="1032" height="1032" rx="20" fill="none" stroke="#c9a84c" stroke-width="2" opacity="0.4"/>`
const BORDER_RED  = `<rect x="24" y="24" width="1032" height="1032" rx="20" fill="none" stroke="#e8405a" stroke-width="3" opacity="0.6"/>`
const BORDER_GREEN= `<rect x="24" y="24" width="1032" height="1032" rx="20" fill="none" stroke="#2ecc71" stroke-width="2" opacity="0.5"/>`

const FOOTER = `
  <text x="540" y="1010" font-family="Arial, sans-serif" font-size="24" fill="#c9a84c" text-anchor="middle" letter-spacing="2">app.temptationtoken.io</text>`

const CTA_GOLD = (label) => `
  <rect x="290" y="860" width="500" height="72" rx="36" fill="#c9a84c"/>
  <text x="540" y="904" font-family="Arial, sans-serif" font-size="28" font-weight="800" fill="#0d0d0d" text-anchor="middle">${label}</text>`

const CTA_RED = (label) => `
  <rect x="290" y="860" width="500" height="72" rx="36" fill="#e8405a"/>
  <text x="540" y="904" font-family="Arial, sans-serif" font-size="28" font-weight="800" fill="#fff" text-anchor="middle">${label}</text>`

const CTA_GREEN = (label) => `
  <rect x="290" y="860" width="500" height="72" rx="36" fill="#2ecc71"/>
  <text x="540" y="904" font-family="Arial, sans-serif" font-size="26" font-weight="800" fill="#0d0d0d" text-anchor="middle">${label}</text>`

// SVG diamond burst — replaces fire/flame emoji
const DIAMOND_BURST = `
  <polygon points="540,185 570,280 540,310 510,280" fill="#e8405a" opacity="0.95"/>
  <polygon points="540,205 562,268 540,292 518,268" fill="#f0a030" opacity="0.9"/>
  <polygon points="524,240 540,220 556,240 540,260" fill="#f5e060" opacity="0.85"/>
  <polygon points="490,245 540,195 590,245 540,295" fill="none" stroke="#c9a84c" stroke-width="1.5" opacity="0.5"/>`

// SVG alert shape — replaces siren/alarm emoji
const ALERT_SHAPE = `
  <polygon points="540,235 640,400 440,400" fill="#e8405a"/>
  <polygon points="540,255 622,395 458,395" fill="#c0001a"/>
  <text x="540" y="385" font-family="Arial, sans-serif" font-size="88" font-weight="900" fill="#fff" text-anchor="middle">!</text>`

// SVG bar chart — replaces chart emoji
const BAR_CHART = `
  <rect x="464" y="205" width="26" height="50" rx="3" fill="#c9a84c" opacity="0.7"/>
  <rect x="500" y="175" width="26" height="80" rx="3" fill="#c9a84c" opacity="0.85"/>
  <rect x="536" y="188" width="26" height="67" rx="3" fill="#f0d060"/>
  <rect x="572" y="160" width="26" height="95" rx="3" fill="#c9a84c"/>
  <line x1="455" y1="260" x2="607" y2="260" stroke="#555" stroke-width="2"/>`

// SVG lock icon — replaces lock emoji
const LOCK_ICON = (cx, cy) => `
  <rect x="${cx-22}" y="${cy}" width="44" height="32" rx="5" fill="#2ecc71"/>
  <path d="M${cx-14},${cy} a14,14 0 0,1 28,0" fill="none" stroke="#2ecc71" stroke-width="6" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${cy+16}" r="6" fill="#0d0d0d"/>`

// SVG audit icon — magnifying glass
const AUDIT_ICON = (cx, cy) => `
  <circle cx="${cx-4}" cy="${cy-4}" r="18" fill="none" stroke="#2ecc71" stroke-width="5"/>
  <line x1="${cx+9}" y1="${cy+9}" x2="${cx+22}" y2="${cy+22}" stroke="#2ecc71" stroke-width="5" stroke-linecap="round"/>`

// SVG shield icon
const SHIELD_ICON = (cx, cy) => `
  <path d="M${cx},${cy-24} L${cx+22},${cy-10} L${cx+22},${cy+12} Q${cx+22},${cy+24} ${cx},${cy+28} Q${cx-22},${cy+24} ${cx-22},${cy+12} L${cx-22},${cy-10} Z" fill="none" stroke="#2ecc71" stroke-width="4"/>
  <text x="${cx}" y="${cy+10}" font-family="Arial" font-size="18" font-weight="900" fill="#2ecc71" text-anchor="middle">OK</text>`

// SVG chain links
const CHAIN_ICON = (cx, cy) => `
  <rect x="${cx-28}" y="${cy-12}" width="24" height="24" rx="8" fill="none" stroke="#2ecc71" stroke-width="4"/>
  <rect x="${cx+4}"  y="${cy-12}" width="24" height="24" rx="8" fill="none" stroke="#2ecc71" stroke-width="4"/>
  <line x1="${cx-4}" y1="${cy}" x2="${cx+4}" y2="${cy}" stroke="#2ecc71" stroke-width="3"/>`

// SVG crown (replaces crown emoji)
const CROWN_SVG = (cx, cy) => `
  <polygon points="${cx-80},${cy+10} ${cx-80},${cy-20} ${cx-40},${cy-50} ${cx},${cy-20} ${cx+40},${cy-50} ${cx+80},${cy-20} ${cx+80},${cy+10}" fill="#c9a84c"/>
  <rect x="${cx-80}" y="${cy+10}" width="160" height="14" rx="4" fill="#c9a84c"/>`

// SVG star (safe, from polygon — no font dependency)
const STAR_SVG = (cx, cy, r, fill) => {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2
    const radius = i % 2 === 0 ? r : r * 0.42
    pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`)
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`
}

// ─── SVG definitions ──────────────────────────────────────────────────────────

const svgs = {

  // ── Monday ─ VOTE IS LIVE ───────────────────────────────────────────────────
  'post1_monday': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d0d0d"/><stop offset="100%" style="stop-color:#1a0d1f"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#c9a84c"/><stop offset="100%" style="stop-color:#f0d060"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  ${BORDER_GOLD}
  ${HEADER}
  <rect x="850" y="50" width="176" height="52" rx="26" fill="#c9a84c"/>
  <text x="938" y="82" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="#0d0d0d" text-anchor="middle">ROUND LIVE</text>
  ${DIAMOND_BURST}
  <text x="540" y="490" font-family="Georgia, serif" font-size="88" font-weight="700" fill="#f5f5f5" text-anchor="middle">VOTE IS</text>
  <text x="540" y="588" font-family="Georgia, serif" font-size="88" font-weight="700" fill="url(#gold)" text-anchor="middle">LIVE</text>
  <text x="540" y="668" font-family="Arial, sans-serif" font-size="36" fill="#aaa" text-anchor="middle">14 Profiles  ·  Ends Sunday 11:59 PM EDT</text>
  <rect x="160" y="720" width="280" height="90" rx="12" fill="#1a1a1a" stroke="#2a2a2a" stroke-width="1"/>
  <text x="300" y="760" font-family="Arial, sans-serif" font-size="14" fill="#888" text-anchor="middle" letter-spacing="2">PRIZE POOL</text>
  <text x="300" y="795" font-family="Georgia, serif" font-size="32" font-weight="700" fill="#c9a84c" text-anchor="middle">GROWING</text>
  <rect x="640" y="720" width="280" height="90" rx="12" fill="#1a1a1a" stroke="#2a2a2a" stroke-width="1"/>
  <text x="780" y="760" font-family="Arial, sans-serif" font-size="14" fill="#888" text-anchor="middle" letter-spacing="2">PAYOUT</text>
  <text x="780" y="795" font-family="Georgia, serif" font-size="32" font-weight="700" fill="#c9a84c" text-anchor="middle">35% TOP VOTER</text>
  ${CTA_GOLD('VOTE NOW  →')}
  ${FOOTER}
</svg>`,

  // ── Tuesday ─ HOW IT WORKS ──────────────────────────────────────────────────
  'post2_tuesday': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d0d0d"/><stop offset="100%" style="stop-color:#0d1a0d"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  ${BORDER_GOLD}
  ${HEADER}
  <text x="540" y="300" font-family="Georgia, serif" font-size="72" font-weight="700" fill="#f5f5f5" text-anchor="middle">VOTE $TTS.</text>
  <text x="540" y="400" font-family="Georgia, serif" font-size="72" font-weight="700" fill="#c9a84c" text-anchor="middle">WIN CRYPTO.</text>
  <!-- Card 1: BUY -->
  <rect x="80" y="460" width="280" height="200" rx="16" fill="#1a1a1a" stroke="#2a2a2a" stroke-width="1"/>
  <text x="220" y="530" font-family="Georgia, serif" font-size="64" font-weight="700" fill="#c9a84c" text-anchor="middle">$</text>
  <text x="220" y="575" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#f5f5f5" text-anchor="middle">BUY $TTS</text>
  <text x="220" y="603" font-family="Arial, sans-serif" font-size="15" fill="#888" text-anchor="middle">Uniswap on Base</text>
  <text x="220" y="628" font-family="Arial, sans-serif" font-size="15" fill="#888" text-anchor="middle">pennies per vote</text>
  <!-- Card 2: VOTE -->
  <rect x="400" y="460" width="280" height="200" rx="16" fill="#1a1a1a" stroke="#2a2a2a" stroke-width="1"/>
  <rect x="512" y="488" width="56" height="52" rx="6" fill="none" stroke="#c9a84c" stroke-width="3"/>
  <line x1="526" y1="488" x2="520" y2="473" stroke="#c9a84c" stroke-width="3" stroke-linecap="round"/>
  <line x1="554" y1="488" x2="560" y2="473" stroke="#c9a84c" stroke-width="3" stroke-linecap="round"/>
  <line x1="525" y1="510" x2="555" y2="510" stroke="#c9a84c" stroke-width="2" opacity="0.5"/>
  <line x1="525" y1="524" x2="548" y2="524" stroke="#c9a84c" stroke-width="2" opacity="0.5"/>
  <text x="540" y="575" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#f5f5f5" text-anchor="middle">VOTE ON PROFILES</text>
  <text x="540" y="603" font-family="Arial, sans-serif" font-size="15" fill="#888" text-anchor="middle">Pick your winner</text>
  <text x="540" y="628" font-family="Arial, sans-serif" font-size="15" fill="#888" text-anchor="middle">Min. 5 TTS</text>
  <!-- Card 3: WIN -->
  <rect x="720" y="460" width="280" height="200" rx="16" fill="#1a1a1a" stroke="#2a2a2a" stroke-width="1"/>
  ${STAR_SVG(860, 515, 38, '#c9a84c')}
  <text x="860" y="575" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#f5f5f5" text-anchor="middle">WIN 35% POOL</text>
  <text x="860" y="603" font-family="Arial, sans-serif" font-size="15" fill="#888" text-anchor="middle">Top voter wins big</text>
  <text x="860" y="628" font-family="Arial, sans-serif" font-size="15" fill="#888" text-anchor="middle">Paid automatically</text>
  <text x="540" y="740" font-family="Arial, sans-serif" font-size="32" fill="#aaa" text-anchor="middle">Provably fair  ·  Chainlink VRF  ·  Base</text>
  <text x="540" y="790" font-family="Arial, sans-serif" font-size="28" fill="#888" text-anchor="middle">Rounds close Sunday 11:59 PM EDT</text>
  ${CTA_GOLD('START PLAYING  →')}
  ${FOOTER}
</svg>`,

  // ── Wednesday ─ LEADERBOARD ─────────────────────────────────────────────────
  'post3_wednesday': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <rect width="1080" height="1080" fill="#0d0d0d"/>
  ${BORDER_GOLD}
  ${HEADER}
  ${BAR_CHART}
  <text x="540" y="330" font-family="Georgia, serif" font-size="70" font-weight="700" fill="#f5f5f5" text-anchor="middle">MIDWEEK</text>
  <text x="540" y="415" font-family="Georgia, serif" font-size="70" font-weight="700" fill="#c9a84c" text-anchor="middle">LEADERBOARD</text>
  <!-- Row 1 -->
  <rect x="120" y="460" width="840" height="70" rx="10" fill="#1a1a1a" stroke="#c9a84c" stroke-width="1"/>
  <text x="160" y="503" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#c9a84c">#1</text>
  <polygon points="220,491 232,503 220,515 208,503" fill="#c9a84c"/>
  <text x="243" y="503" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#f5f5f5">Leading Profile</text>
  <text x="900" y="503" font-family="Georgia, serif" font-size="24" font-weight="700" fill="#c9a84c" text-anchor="end">LEADING</text>
  <!-- Row 2 -->
  <rect x="120" y="545" width="840" height="70" rx="10" fill="#141414" stroke="#2a2a2a" stroke-width="1"/>
  <text x="160" y="588" font-family="Arial, sans-serif" font-size="24" fill="#aaa">#2</text>
  <text x="220" y="588" font-family="Arial, sans-serif" font-size="24" fill="#f5f5f5">Profile 2</text>
  <text x="900" y="588" font-family="Georgia, serif" font-size="24" fill="#888" text-anchor="end">CLOSE RACE</text>
  <!-- Row 3 -->
  <rect x="120" y="628" width="840" height="70" rx="10" fill="#141414" stroke="#2a2a2a" stroke-width="1"/>
  <text x="160" y="671" font-family="Arial, sans-serif" font-size="24" fill="#aaa">#3</text>
  <text x="220" y="671" font-family="Arial, sans-serif" font-size="24" fill="#f5f5f5">Profile 3</text>
  <text x="900" y="671" font-family="Georgia, serif" font-size="24" fill="#888" text-anchor="end">TRAILING</text>
  <text x="540" y="770" font-family="Arial, sans-serif" font-size="30" fill="#aaa" text-anchor="middle">4 days left  ·  Ends Sunday 11:59 PM EDT</text>
  <text x="540" y="815" font-family="Arial, sans-serif" font-size="26" fill="#888" text-anchor="middle">Vote now to change the standings</text>
  ${CTA_GOLD('CHECK STANDINGS  →')}
  ${FOOTER}
</svg>`,

  // ── Thursday ─ PROFILE SPOTLIGHT ───────────────────────────────────────────
  'post4_thursday': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a0d1f"/><stop offset="100%" style="stop-color:#0d0d0d"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  ${BORDER_GOLD}
  ${HEADER}
  <!-- Crown badge -->
  <rect x="340" y="150" width="400" height="56" rx="28" fill="#c9a84c"/>
  ${CROWN_SVG(540, 193)}
  <text x="540" y="188" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="#0d0d0d" text-anchor="middle">PROFILE SPOTLIGHT</text>
  <!-- Profile card -->
  <rect x="240" y="240" width="600" height="500" rx="24" fill="#1a1a1a" stroke="#c9a84c" stroke-width="2"/>
  <!-- Avatar placeholder — geometric circles -->
  <circle cx="540" cy="410" r="130" fill="#2a2a2a" stroke="#c9a84c" stroke-width="2"/>
  <circle cx="540" cy="378" r="44" fill="#3a3a3a"/>
  <ellipse cx="540" cy="478" rx="72" ry="50" fill="#3a3a3a"/>
  ${STAR_SVG(540, 380, 22, '#c9a84c')}
  <!-- Profile info -->
  <text x="540" y="592" font-family="Georgia, serif" font-size="36" font-weight="700" fill="#f5f5f5" text-anchor="middle">THIS WEEK'S SPOTLIGHT</text>
  <text x="540" y="637" font-family="Arial, sans-serif" font-size="22" fill="#aaa" text-anchor="middle">Competing in Round 1  ·  Cast your vote</text>
  <!-- Vote indicator -->
  <rect x="320" y="665" width="440" height="50" rx="25" fill="#0d0d0d" stroke="#c9a84c" stroke-width="1"/>
  <polygon points="365,682 377,690 365,698 353,690" fill="#c9a84c"/>
  <text x="392" y="697" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#c9a84c">VOTE ON THIS PROFILE</text>
  <text x="540" y="800" font-family="Arial, sans-serif" font-size="28" fill="#aaa" text-anchor="middle">Top voter wins 35% of the prize pool</text>
  ${CTA_GOLD('VOTE NOW  →')}
  ${FOOTER}
</svg>`,

  // ── Friday ─ FINAL WEEKEND PUSH ────────────────────────────────────────────
  'post5_friday': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <rect width="1080" height="1080" fill="#0d0d0d"/>
  ${BORDER_RED}
  ${HEADER}
  <!-- Urgent badge -->
  <rect x="380" y="150" width="320" height="56" rx="12" fill="#e8405a"/>
  <polygon points="458,164 474,178 458,192" fill="#fff"/>
  <text x="484" y="186" font-family="Arial, sans-serif" font-size="24" font-weight="800" fill="#fff">48 HOURS LEFT</text>
  ${ALERT_SHAPE}
  <text x="540" y="450" font-family="Georgia, serif" font-size="80" font-weight="700" fill="#f5f5f5" text-anchor="middle">FINAL</text>
  <text x="540" y="548" font-family="Georgia, serif" font-size="80" font-weight="700" fill="#e8405a" text-anchor="middle">WEEKEND PUSH</text>
  <text x="540" y="648" font-family="Arial, sans-serif" font-size="36" fill="#aaa" text-anchor="middle">Round 1 closes Sunday 11:59 PM EDT</text>
  <text x="540" y="706" font-family="Arial, sans-serif" font-size="28" fill="#888" text-anchor="middle">Don't let someone else take the prize</text>
  <!-- Prize reminder -->
  <rect x="160" y="755" width="760" height="80" rx="12" fill="#1a1a1a" stroke="#e8405a" stroke-width="1"/>
  ${STAR_SVG(197, 795, 13, '#c9a84c')}
  <text x="218" y="804" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#f5f5f5">Top voter wins 35% of the entire prize pool</text>
  ${CTA_RED('VOTE BEFORE IT CLOSES  →')}
  ${FOOTER}
</svg>`,

  // ── Saturday ─ TRUST / SECURITY ────────────────────────────────────────────
  'post6_saturday': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <rect width="1080" height="1080" fill="#0d0d0d"/>
  ${BORDER_GREEN}
  ${HEADER}
  <text x="540" y="230" font-family="Georgia, serif" font-size="64" font-weight="700" fill="#f5f5f5" text-anchor="middle">AUDITED.</text>
  <text x="540" y="320" font-family="Georgia, serif" font-size="64" font-weight="700" fill="#2ecc71" text-anchor="middle">LOCKED.</text>
  <text x="540" y="410" font-family="Georgia, serif" font-size="64" font-weight="700" fill="#c9a84c" text-anchor="middle">FAIR.</text>
  <!-- Security grid — 4 cards with SVG icons -->
  <rect x="80"  y="460" width="200" height="200" rx="16" fill="#1a1a1a" stroke="#2ecc71" stroke-width="1"/>
  ${AUDIT_ICON(180, 542)}
  <text x="180" y="600" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#2ecc71" text-anchor="middle">AUDITED</text>
  <text x="180" y="625" font-family="Arial, sans-serif" font-size="14" fill="#888" text-anchor="middle">Solidproof</text>
  <rect x="300" y="460" width="200" height="200" rx="16" fill="#1a1a1a" stroke="#2ecc71" stroke-width="1"/>
  ${LOCK_ICON(400, 530)}
  <text x="400" y="600" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#2ecc71" text-anchor="middle">LP LOCKED</text>
  <text x="400" y="625" font-family="Arial, sans-serif" font-size="14" fill="#888" text-anchor="middle">12 months</text>
  <rect x="520" y="460" width="200" height="200" rx="16" fill="#1a1a1a" stroke="#2ecc71" stroke-width="1"/>
  ${CHAIN_ICON(620, 548)}
  <text x="620" y="600" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#2ecc71" text-anchor="middle">VRF FAIR</text>
  <text x="620" y="625" font-family="Arial, sans-serif" font-size="14" fill="#888" text-anchor="middle">Chainlink</text>
  <rect x="740" y="460" width="200" height="200" rx="16" fill="#1a1a1a" stroke="#2ecc71" stroke-width="1"/>
  ${SHIELD_ICON(840, 540)}
  <text x="840" y="600" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#2ecc71" text-anchor="middle">MULTISIG</text>
  <text x="840" y="625" font-family="Arial, sans-serif" font-size="14" fill="#888" text-anchor="middle">Gnosis Safe</text>
  <text x="540" y="740" font-family="Arial, sans-serif" font-size="28" fill="#aaa" text-anchor="middle">Your crypto. Your rules. On-chain forever.</text>
  <text x="540" y="790" font-family="Arial, sans-serif" font-size="24" fill="#888" text-anchor="middle">Every transaction verifiable on BaseScan</text>
  ${CTA_GREEN('READ THE AUDIT  →')}
  ${FOOTER}
</svg>`,

  // ── Sunday ─ LAST CHANCE ────────────────────────────────────────────────────
  'post7_sunday': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a0000"/><stop offset="100%" style="stop-color:#0d0d0d"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  ${BORDER_RED}
  ${HEADER}
  ${DIAMOND_BURST}
  <text x="540" y="375" font-family="Georgia, serif" font-size="90" font-weight="700" fill="#f5f5f5" text-anchor="middle">LAST</text>
  <text x="540" y="475" font-family="Georgia, serif" font-size="90" font-weight="700" fill="#e8405a" text-anchor="middle">CHANCE</text>
  <text x="540" y="575" font-family="Georgia, serif" font-size="90" font-weight="700" fill="#f5f5f5" text-anchor="middle">TONIGHT</text>
  <text x="540" y="668" font-family="Arial, sans-serif" font-size="36" fill="#aaa" text-anchor="middle">Round 1 closes 11:59 PM EDT</text>
  <text x="540" y="726" font-family="Arial, sans-serif" font-size="30" fill="#888" text-anchor="middle">Settlement + winner payout in minutes after</text>
  <!-- Countdown box -->
  <rect x="160" y="762" width="760" height="75" rx="12" fill="#1a0000" stroke="#e8405a" stroke-width="2"/>
  <polygon points="190,793 208,809 190,825" fill="#e8405a"/>
  <text x="218" y="812" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#e8405a">ROUND CLOSES TONIGHT — GET YOUR VOTES IN</text>
  ${CTA_RED('VOTE NOW — FINAL HOURS  →')}
  ${FOOTER}
</svg>`,
}

// ─── Render ───────────────────────────────────────────────────────────────────

for (const [name, svgStr] of Object.entries(svgs)) {
  const resvg = new Resvg(svgStr, {
    fitTo: { mode: 'width', value: 1200 },
    background: '#0d0d0d',
    font: { loadSystemFonts: true },
  })
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const outPath = path.join(OUT, `${name}.png`)
  fs.writeFileSync(outPath, pngBuffer)

  // Verify: check for ? tofu by scanning for 0x3F in suspicious positions
  // (quick heuristic: if PNG text chunks contain literal 0x3F bytes we flag it)
  // More reliably: re-read SVG and assert no emoji codepoints remain
  const emojiRe = /[\u{1F000}-\u{1FFFF}]/u
  if (emojiRe.test(svgStr)) {
    console.error(`  FAIL: ${name}.svg still contains emoji — FIX BEFORE SHIP`)
  } else {
    const kb = Math.round(pngBuffer.length / 1024)
    console.log(`  OK   ${name}.png  ${kb} KB  (no emoji in SVG source)`)
  }
}

console.log(`\nDone. Files written to ${OUT}`)
