#!/usr/bin/env node
/**
 * Generates the PWA icon + iOS splash set into public/pwa/ from one vector source.
 *
 * Everything is drawn here as SVG and rasterised with @resvg/resvg-js (already a repo
 * dependency — used by the OG-image path), so there is no binary design asset to keep in
 * sync and the whole set regenerates from the brand tokens below with one command.
 *
 * Run: node scripts/gen-pwa-assets.mjs
 *
 * Output (all committed — Vercel serves public/ verbatim, no build step touches them):
 *   public/pwa/icon-{192,256,384,512}.png       any-purpose icons
 *   public/pwa/maskable-{192,512}.png           Android adaptive (safe zone honoured)
 *   public/pwa/apple-touch-icon.png             180×180, iOS home screen
 *   public/pwa/splash-<w>x<h>.png               iOS startup images
 */
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'pwa')
mkdirSync(OUT, { recursive: true })

// Brand tokens — mirrored from src/index.css :root and mobile/src/theme.ts.
const VOID = '#05050a'
const DEEP = '#0c0c14'
const GOLD = '#d4af37'
const GOLD_LIGHT = '#f0d060'
const CREAM = '#f0e8d8'

/**
 * The mark: a gold-ruled rounded square over a deep radial ground, with the "TT"
 * monogram set in an italic serif — the same treatment as the web wallet bar.
 *
 * `inset` is the fraction of the canvas left empty around the mark. Android maskable
 * icons can be cropped to a circle inscribed in the middle 80%, so the maskable variant
 * passes a larger inset to keep the monogram inside that safe zone.
 */
function markSvg(size, { inset = 0.06, bleed = false } = {}) {
  const s = size
  const pad = s * inset
  const box = s - pad * 2
  const r = box * 0.22
  const fs = box * 0.46
  // Maskable icons must paint edge-to-edge — a transparent margin would be cropped to
  // show the launcher background instead of ours.
  const ground = bleed
    ? `<rect width="${s}" height="${s}" fill="${VOID}"/>`
    : `<rect width="${s}" height="${s}" rx="${s * 0.2}" fill="${VOID}"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <radialGradient id="g" cx="50%" cy="38%" r="72%">
      <stop offset="0%" stop-color="${DEEP}"/>
      <stop offset="100%" stop-color="${VOID}"/>
    </radialGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${GOLD_LIGHT}"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  ${ground}
  <rect x="${pad}" y="${pad}" width="${box}" height="${box}" rx="${r}" fill="url(#g)"/>
  <rect x="${pad + box * 0.045}" y="${pad + box * 0.045}" width="${box * 0.91}" height="${box * 0.91}"
        rx="${r * 0.82}" fill="none" stroke="url(#rule)" stroke-width="${Math.max(1, box * 0.018)}"/>
  <text x="50%" y="${pad + box * 0.615}" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-style="italic"
        font-size="${fs}" fill="${GOLD_LIGHT}" letter-spacing="${-fs * 0.04}">TT</text>
  <rect x="${s / 2 - box * 0.14}" y="${pad + box * 0.70}" width="${box * 0.28}" height="${Math.max(1, box * 0.012)}"
        fill="${GOLD}" opacity="0.85"/>
</svg>`
}

/** iOS startup image: the mark centred on the brand ground, with the wordmark beneath. */
function splashSvg(w, h) {
  const m = Math.min(w, h)
  const icon = m * 0.30
  const x = (w - icon) / 2
  const y = h / 2 - icon * 0.78
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="${DEEP}"/>
      <stop offset="100%" stop-color="${VOID}"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  ${/* Embedded as a NESTED <svg> with x/y, not a translated <g>: the mark uses percentage
       coordinates internally, and a <g> would resolve those against the outer viewport
       (flinging the monogram off-centre). A nested <svg> establishes its own viewport. */''}
  ${markSvg(icon).replace('<svg ', `<svg x="${x}" y="${y}" `)}
  <text x="50%" y="${y + icon * 1.42}" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-style="italic"
        font-size="${m * 0.062}" fill="${CREAM}">Temptation Token</text>
  <text x="50%" y="${y + icon * 1.72}" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-size="${m * 0.030}"
        fill="${GOLD}" letter-spacing="${m * 0.010}">VOTE · WIN · EARN $TTS</text>
</svg>`
}

const png = (svg, width) =>
  new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: VOID,
    font: { loadSystemFonts: true },
  }).render().asPng()

const written = []
const emit = (name, buf) => { writeFileSync(resolve(OUT, name), buf); written.push(`${name} (${(buf.length / 1024).toFixed(1)} KB)`) }

for (const size of [192, 256, 384, 512]) emit(`icon-${size}.png`, png(markSvg(size), size))
// Maskable: 20% safe-zone margin, painted edge to edge.
for (const size of [192, 512]) emit(`maskable-${size}.png`, png(markSvg(size, { inset: 0.20, bleed: true }), size))
emit('apple-touch-icon.png', png(markSvg(180, { inset: 0.0, bleed: true }), 180))

// iOS startup images. Portrait, device pixels — covers current iPhone/iPad families;
// any device without an exact match simply falls back to a white flash, which is why
// the manifest background_color is also set to the brand void.
const SPLASHES = [
  [1179, 2556], // iPhone 14/15/16 Pro
  [1290, 2796], // iPhone 14/15/16 Pro Max
  [1170, 2532], // iPhone 12/13/14
  [1284, 2778], // iPhone 12/13 Pro Max
  [1125, 2436], // iPhone X/XS/11 Pro
  [1242, 2688], // iPhone XS Max/11 Pro Max
  [828, 1792],  // iPhone XR/11
  [750, 1334],  // iPhone SE/8
  [1536, 2048], // iPad 9.7"
  [1668, 2388], // iPad Pro 11"
  [2048, 2732], // iPad Pro 12.9"
]
for (const [w, h] of SPLASHES) emit(`splash-${w}x${h}.png`, png(splashSvg(w, h), w))

console.log(`Wrote ${written.length} files to public/pwa/`)
written.forEach((f) => console.log('  ' + f))
