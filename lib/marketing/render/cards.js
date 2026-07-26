// Branded card rendering (ported from render/cards.ts). satori builds the SVG from
// the same BRAND tokens (single source of truth); @resvg/resvg-js rasterizes to PNG.
// Element tree is built without JSX so it runs in a plain Vercel Node function.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const BRAND = {
  bg: '#0B0B0F', panel: '#15151D', ink: '#F4F2F7',
  hot: '#FF2D6E',   // temptation magenta — CTA + rank
  gold: '#F2C14E',  // prize money only
  dim: '#8A8797',
  font: 'Archivo',
}

const _dir = dirname(fileURLToPath(import.meta.url))
// assets/ lives at repo root; from lib/marketing/render → ../../../assets
const FONT_PATH = process.env.MARKETING_FONT_PATH || join(_dir, '..', '..', '..', 'assets', 'Archivo-Bold.ttf')
let _font = null
function fontData() {
  if (!_font) _font = readFileSync(FONT_PATH)
  return _font
}

function cardTree(d) {
  const h = (type, props, ...children) => ({ type, props: { ...(props || {}), children: children.length <= 1 ? children[0] : children } })
  return h('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: BRAND.bg, color: BRAND.ink, padding: 56, fontFamily: BRAND.font } },
    h('div', { style: { fontSize: 30, letterSpacing: 6, color: BRAND.hot, display: 'flex' } }, 'TEMPTATION TOKEN'),
    h('div', { style: { fontSize: 44, marginTop: 18, color: BRAND.dim, display: 'flex' } }, d.title),
    h('div', { style: { fontSize: 118, fontWeight: 800, marginTop: 8, color: BRAND.gold, display: 'flex' } }, d.big),
    h('div', { style: { fontSize: 40, marginTop: 8, display: 'flex' } }, d.sub),
    h('div', { style: { marginTop: 'auto', fontSize: 28, color: BRAND.dim, display: 'flex', justifyContent: 'space-between' } },
      h('span', null, d.footer), h('span', { style: { color: BRAND.hot } }, 'app.temptationtoken.io')))
}

export const cards = {
  roundOpen: (round, poolUsd, profiles) => ({
    title: `ROUND ${round} IS LIVE`, big: poolUsd, sub: `${profiles} profiles competing · closes Sunday 11:59 PM ET`,
    footer: 'Vote. Win. 10% fights trafficking.' }),
  midpoint: (leader, votes) => ({
    title: 'HALFTIME STANDINGS', big: leader, sub: `${votes} votes and climbing · 4 days left`,
    footer: 'Every losing vote burns. Supply only shrinks.' }),
  winner: (name, prizeUsd, burned) => ({
    title: "THIS WEEK'S WINNER", big: name, sub: `${prizeUsd} paid on-chain · ${burned} $TTS burned forever`,
    footer: 'Provably fair · Chainlink VRF' }),
}

// Map a dispatcher card kind + round state → CardData, then render to a PNG Buffer.
function dataFor(kind, s) {
  if (kind === 'roundOpen') return cards.roundOpen(s.round, s.poolUsd, s.profiles)
  if (kind === 'midpoint') return cards.midpoint(s.leader, s.leaderVotes)
  if (kind === 'winner') return cards.winner(s.winner || '—', s.prizeUsd || '$0', s.burned || '0')
  return cards.roundOpen(s.round, s.poolUsd, s.profiles)
}

export async function renderCard(kind, state) {
  const { default: satori } = await import('satori')
  const { Resvg } = await import('@resvg/resvg-js')
  const svg = await satori(cardTree(dataFor(kind, state)), {
    width: 1200, height: 630,
    fonts: [{ name: 'Archivo', data: fontData(), weight: 700, style: 'normal' }],
  })
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()
  return Buffer.from(png)
}
