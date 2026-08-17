// Emergency repair of the homepage (page 52, Elementor).
//
//   node scripts/wp-repair-homepage.mjs            # dry run: diff only, writes nothing
//   node scripts/wp-repair-homepage.mjs --apply    # back up, write, verify live
//
// WHY THIS IS NOT A REVISION RESTORE
// The obvious move — roll page 52 back to its last revision (1750, 2026-08-08) — was
// checked first and rejected on evidence. Rev 1750 ALREADY contains "$5 in free TTS",
// "$100 worth of TTS free", the 40% split, the broken Uniswap URL and the hardcoded
// price. It additionally contains the "designed-to-reward participation" garble that the
// current copy has since lost. Restoring it would reintroduce a defect and fix none of
// the false claims. Worse, WP revisions only capture post_content — this page renders
// from _elementor_data, which revisions never touched. A restore would have looked
// successful and changed almost nothing visible.
//
// So: targeted, anchored edits. Every edit asserts an exact occurrence count, so a page
// that has drifted fails loudly instead of being silently half-patched. No bulk
// find/replace anywhere — that is what produced "It is not on Base" and
// "TARGET $TTS ambitious long-term growth goals" in the first place.

import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const B = process.env.WP_BASE
const K = process.env.TTS_WP_API_KEY
const PAGE = 52
const APPLY = process.argv.includes('--apply')

const api = (p, init = {}) =>
  fetch(`${B}${p}`, { ...init, headers: { 'X-TTS-API-Key': K, 'Content-Type': 'application/json', ...(init.headers || {}) } })

// The single truthful bonus line. Every false variant collapses to this.
const TRUE_BONUS = '500 $TTS free when you connect a wallet — no purchase needed to play'
const APP_BUY = 'https://app.temptationtoken.io/?buy=1'

// ── Edits to _elementor_data. Each MUST match `count` times exactly. ─────────
const EDITS = [
  {
    what: 'b) false "$5 in free TTS" bonus claim',
    from: 'New users receive $5 in free TTS on signup',
    to: TRUE_BONUS,
    count: 1,
  },
  {
    what: 'b) false "$100 worth of TTS free" bonus claim',
    from: 'New users receive <strong><span style="color: #f5ed07;">$100 worth of TTS free</span></strong> on signup.',
    to: `New users receive <strong><span style="color: #f5ed07;">${TRUE_BONUS}</span></strong>.`,
    count: 1,
  },
  {
    what: 'c) "40% prize pool split weekly" -> the real 35/35/10/20',
    from: 'Win — <strong><span style="color: #ecf00e;">40%</span></strong> prize pool split weekly',
    to: 'Win — <strong><span style="color: #ecf00e;">35%</span></strong> to the winning creator, 35% to her top voter, 10% to charity, 20% to the house — settled weekly on-chain',
    count: 1,
  },
  {
    what: 'd) FAQ "It is not on Base" (bulk-replace artifact)',
    from: 'It is <strong>not on Base.</strong> Any previous references to Base are outdated and should be disregarded.',
    to: 'It is <strong>not on Ethereum mainnet.</strong> Any previous references to another chain are outdated and should be disregarded.',
    count: 1,
  },
  {
    what: 'd) roadmap "TARGET $TTS ambitious long-term growth goals"',
    from: 'Q4 2026 — <span style="color: #f2ea07;">TARGET</span>  $</strong>TTS ambitious long-term growth goals.',
    to: 'Q4 2026 — <span style="color: #f2ea07;">TARGET</span></strong> — pursue $TTS long-term growth goals.',
    count: 1,
  },
  {
    what: 'd) "Women earn designed-to-reward participation just for participating"',
    from: 'Women earn designed-to-reward participation just for participating.',
    to: 'The contest is designed to reward creators for taking part, whether or not they win the round.',
    count: 1,
  },
  {
    what: 'e) nested/broken Uniswap URL -> the app\'s guarded Get-$TTS flow',
    from: 'Buy $TTS on <span style="color: #ff00ff;">Uniswap</span>: <a href="https://app.uniswap.org/swap?outputCurrency=//app.uniswap.org/swap?outputCurrency=0x5570eA97d53A53170e973894A9Fa7feb5785d3b9&amp;chain=base&amp;chain=base">https://app.uniswap.org/swap?outputCurrency=0x5570eA97d53A53170e973894A9Fa7feb5785d3b9&amp;chain=base</a>',
    to: `Get $TTS: <a href="${APP_BUY}">${APP_BUY}</a> — quoted live, with a 5% price-impact limit.`,
    count: 1,
  },
  {
    what: 'f) hardcoded "Current Price $0.01 USD" -> removed',
    // Exact bytes: the stored HTML uses \n and escaped quotes. An earlier attempt
    // anchored on a whitespace-collapsed copy taken from a console dump and matched 0
    // times — the hit-count assertion caught it rather than writing a partial patch.
    from: '<div class="tts-price-row">\n    <span class="tts-price-label">Current Price</span>\n    <span class="tts-price-value">$0.01 USD</span>\n  </div>',
    to: '',
    count: 1,
  },
  {
    what: 'f) empty "Target Price" box -> removed',
    from: '<div class="tts-info-box">\n      <div class="label">Target Price</div>\n      <div class="value"></div>\n    </div>\n    ',
    to: '',
    count: 1,
  },
  {
    what: 'f) tokenomics "Launch Price $0.01 / Target Price (empty)" -> honest',
    from: 'Launch Price: <strong><span style="color: #f2d707;">$0.01</span> </strong>USD Target Price: <strong><span style="color: #f2d707;"></span></strong> USD ',
    to: '',
    count: 1,
  },
]

// a) the hero H1 is the theme's entry-title, i.e. the POST TITLE, not Elementor.
const TITLE_FROM = 'Temptation Token ($TTS) — Vote. Win. Earn Crypto Weekly | Adult Crypto Game on Base'
const TITLE_TO = 'Temptation Token' // rev 1635, 2026-04-08 — the original

const MUST_VANISH = ['$5 in free TTS', '$100 worth of TTS free', '40% prize pool split weekly',
  'not on Base', 'designed-to-reward participation', 'Current Price', 'Target Price',
  'outputCurrency=//app.uniswap.org']
const MUST_APPEAR = ['500 $TTS free when you connect a wallet', '35%', 'app.temptationtoken.io']

// Walk every string value in the parsed Elementor tree and apply the edits there.
// Editing the RAW serialized JSON means fighting three layers of escaping (JS literal ->
// JSON string -> HTML attribute quotes), which is exactly how the first two attempts
// produced 0-match anchors. Parsing first means the anchors are plain HTML.
function walk(node, fn) {
  if (typeof node === 'string') return fn(node)
  if (Array.isArray(node)) return node.map((n) => walk(n, fn))
  if (node && typeof node === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(node)) out[k] = walk(v, fn)
    return out
  }
  return node
}

function transform(rawJson) {
  const tree = JSON.parse(rawJson)
  const counts = new Map(EDITS.map((e) => [e.what, 0]))
  const patched = walk(tree, (s) => {
    let out = s
    for (const e of EDITS) {
      const n = out.split(e.from).length - 1
      if (n > 0) {
        counts.set(e.what, counts.get(e.what) + n)
        out = out.split(e.from).join(e.to)
      }
    }
    return out
  })
  for (const e of EDITS) {
    const n = counts.get(e.what)
    // Tolerate an edit already applied by a previous run (n === 0 and the
    // replacement text is already present) — re-running the repair must be safe.
    if (n !== e.count && !(n === 0 && e.to && rawJson.includes(e.to))) {
      throw new Error(`Refusing to write: "${e.what}" matched ${n} time(s), expected ${e.count}. The page has drifted — re-inspect before applying.`)
    }
    console.log(`  ✓ ${e.what}`)
  }
  return JSON.stringify(patched)
}

const run = async () => {
  const page = await (await api(`/wp-json/wp/v2/pages/${PAGE}?context=edit`)).json()
  const el = await (await api(`/wp-json/tts/v1/elementor/${PAGE}`)).json()
  const before = typeof el.elementor_data === 'string' ? el.elementor_data : JSON.stringify(el.elementor_data)

  console.log(`Page ${PAGE} (${page.link})`)
  console.log(`  title  : ${JSON.stringify(page.title.raw)}`)
  console.log(`  el_data: ${before.length} bytes\n`)
  console.log('Planned edits:')
  const after = transform(before)
  console.log(`  ✓ a) hero H1 (post_title): ${JSON.stringify(TITLE_FROM)} -> ${JSON.stringify(TITLE_TO)}`)
  console.log(`\n  size ${before.length} -> ${after.length} (${after.length - before.length >= 0 ? '+' : ''}${after.length - before.length})`)

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply.')
    return
  }

  const dir = resolve(ROOT, 'outputs/wp_backups')
  mkdirSync(dir, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  writeFileSync(resolve(dir, `home_52_BEFORE_${ts}.json`), JSON.stringify({ title: page.title.raw, elementor_data: before }, null, 2))
  console.log(`\nBackup: outputs/wp_backups/home_52_BEFORE_${ts}.json`)

  // WordPress update_post_meta() runs wp_unslash() on the value, stripping the backslash
  // before every escaped quote and destroying the JSON. The plugin is missing the
  // matching wp_slash(). Posting the raw string corrupted this page once already — the
  // homepage rendered at 112KB instead of 169KB with sections missing. Pre-slash so the
  // server's unslash restores the original exactly.
  const slashed = after.replace(/\\/g, '\\\\')
  const r1 = await api(`/wp-json/tts/v1/elementor/${PAGE}`, { method: 'POST', body: JSON.stringify({ elementor_data: slashed }) })
  if (!r1.ok) throw new Error(`elementor write failed ${r1.status}: ${(await r1.text()).slice(0, 200)}`)

  // Read back and PARSE. A write that stores unparseable JSON leaves a blank page, so
  // this is checked before anything else and rolled back on failure.
  const rb = await (await api(`/wp-json/tts/v1/elementor/${PAGE}?cb=${Date.now()}`)).json()
  const stored = typeof rb.elementor_data === 'string' ? rb.elementor_data : JSON.stringify(rb.elementor_data)
  try {
    JSON.parse(stored)
    console.log(`  ✓ stored data parses (${stored.length} bytes)`)
  } catch (err) {
    console.error(`  ✗ STORED DATA CORRUPT (${err.message}) — rolling back`)
    await api(`/wp-json/tts/v1/elementor/${PAGE}`, { method: 'POST', body: JSON.stringify({ elementor_data: before.replace(/\\/g, '\\\\') }) })
    throw new Error('write corrupted the page; rolled back to the pre-edit data')
  }
  if (page.title.raw !== TITLE_TO) {
    const r2 = await api(`/wp-json/wp/v2/pages/${PAGE}`, { method: 'POST', body: JSON.stringify({ title: TITLE_TO }) })
    if (!r2.ok) throw new Error(`title write failed ${r2.status}: ${(await r2.text()).slice(0, 200)}`)
  }
  console.log('Wrote elementor_data + title. Verifying live…')

  await new Promise((r) => setTimeout(r, 4000))
  const live = await (await fetch(`${B}/?cb=${Date.now()}`)).text()
  let bad = 0
  for (const s of MUST_VANISH) { const hit = live.includes(s); console.log(`  ${hit ? '✗' : '✓'} gone: ${s}`); if (hit) bad++ }
  for (const s of MUST_APPEAR) { const hit = live.includes(s); console.log(`  ${hit ? '✓' : '✗'} present: ${s}`); if (!hit) bad++ }
  console.log(bad ? `\n${bad} check(s) failed — inspect before declaring success.` : '\n✅ all live checks passed')
}

run().catch((e) => { console.error('\n' + e.message); process.exit(1) })
