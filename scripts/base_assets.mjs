// Base ecosystem submission assets: app icon + 1200x630 cover (no Base logo),
// rendered with satori+resvg using the marketing BRAND tokens.
import { readFileSync, writeFileSync } from 'node:fs'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { BRAND } from '../lib/marketing/render/cards.js'

const font = readFileSync('assets/Archivo-Bold.ttf')
const h = (type, props, ...children) => ({ type, props: { ...(props || {}), children: children.length <= 1 ? children[0] : children } })

async function png(tree, w, hgt, out) {
  const svg = await satori(tree, { width: w, height: hgt, fonts: [{ name: 'Archivo', data: font, weight: 700, style: 'normal' }] })
  const buf = new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng()
  writeFileSync(out, buf)
  console.log(`wrote ${out} (${buf.length} bytes, ${w}x${hgt})`)
}

// App icon (1024x1024) — magenta monogram on brand bg.
await png(
  h('div', { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.bg } },
    h('div', { style: { fontSize: 520, fontWeight: 800, color: BRAND.hot, fontFamily: 'Archivo', display: 'flex' } }, 'T')),
  1024, 1024, 'marketing/base-dev/app-icon-1024.png')

// Cover 1200x630 (NO Base logo) — brand + tagline.
await png(
  h('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: BRAND.bg, color: BRAND.ink, padding: 72, fontFamily: 'Archivo' } },
    h('div', { style: { fontSize: 34, letterSpacing: 6, color: BRAND.hot, display: 'flex' } }, 'TEMPTATION TOKEN'),
    h('div', { style: { fontSize: 84, fontWeight: 800, marginTop: 16, display: 'flex' } }, 'Hot-or-Not, on-chain.'),
    h('div', { style: { fontSize: 40, marginTop: 16, color: BRAND.dim, display: 'flex' } }, 'Vote $TTS · top voter + winner split the pool · weekly on Base'),
    h('div', { style: { marginTop: 'auto', fontSize: 28, color: BRAND.hot, display: 'flex' } }, 'app.temptationtoken.io')),
  1200, 630, 'marketing/base-dev/cover-1200x630.png')

// Tagline (<=60 chars)
const tagline = 'Hot-or-Not on Base — vote $TTS, top voter wins the pool.'
writeFileSync('marketing/base-dev/tagline.txt', tagline + '\n')
console.log(`tagline (${tagline.length} chars): ${tagline}`)
