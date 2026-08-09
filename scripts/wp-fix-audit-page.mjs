// Fix the stale contract table on https://temptationtoken.io/audit (page 1738).
//
// The live page lists TTSVotingV3b (superseded) and the retired TTSStaking proxy
// (drained to zero 2026-08-07). A CoinGecko/Blockaid reviewer who checks those
// addresses finds they don't match the live deployment — worse than a 404,
// because it reads as an audit that doesn't cover what's running.
//
//   node scripts/wp-fix-audit-page.mjs            # dry run: show the diff, write nothing
//   node scripts/wp-fix-audit-page.mjs --apply    # back up, write, verify live
//   node scripts/wp-fix-audit-page.mjs --verify   # check the live page only
//
// Safety: --apply reads content.raw (context=edit, needs auth) and never writes
// back content.rendered. wpautop rewrites rendered HTML, so round-tripping it
// would corrupt the page.

import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WPClient } from './wp/client.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PAGE_ID = 1738

// Each edit is anchored on the old address, which is unique on the page, and
// asserts an expected hit count so a silently-changed page fails loudly.
const EDITS = [
  {
    what: 'voting contract row: V3b (superseded) → V3d (canonical)',
    subs: [
      { from: '0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6', to: '0x783b8cd80b586b723188c93ef94ee1beede617b4', expect: 1 },
      { from: 'TTSVotingV3b (Active)', to: 'TTSVotingV3d (Active)', expect: 1 },
    ],
  },
  {
    what: 'staking row: retired proxy → live proxy',
    subs: [
      { from: '0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc', to: '0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d', expect: 1 },
    ],
  },
]

const MUST_APPEAR = ['0x783b8cd80b586b723188c93ef94ee1beede617b4', '0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d']
const MUST_VANISH = ['0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6', '0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc']
// The token proxy is correct already and must survive untouched.
const MUST_PERSIST = ['0x5570eA97d53A53170e973894A9Fa7feb5785d3b9']

function transform (html) {
  let out = html
  const applied = []
  for (const edit of EDITS) {
    for (const s of edit.subs) {
      const hits = out.split(s.from).length - 1
      if (hits !== s.expect) {
        throw new Error(
          `Refusing to edit: expected ${s.expect} occurrence(s) of "${s.from}" but found ${hits}. ` +
          `The live page changed since this script was written — re-inspect before applying.`,
        )
      }
      out = out.split(s.from).join(s.to)
      applied.push(`${edit.what} :: ${s.from} → ${s.to} (${hits}x)`)
    }
  }
  return { out, applied }
}

function diffLines (before, after) {
  const b = before.split('\n')
  const a = after.split('\n')
  const rows = []
  for (let i = 0; i < Math.max(b.length, a.length); i++) {
    if (b[i] !== a[i]) {
      if (b[i] !== undefined) rows.push(`  - ${b[i].trim()}`)
      if (a[i] !== undefined) rows.push(`  + ${a[i].trim()}`)
    }
  }
  return rows.join('\n')
}

async function fetchLiveRendered () {
  const res = await fetch(`https://temptationtoken.io/wp-json/wp/v2/pages/${PAGE_ID}?context=view&_fields=content,modified`)
  if (!res.ok) throw new Error(`live fetch -> ${res.status}`)
  return res.json()
}

async function verifyLive () {
  const page = await fetchLiveRendered()
  const html = page.content.rendered
  const problems = []
  for (const s of MUST_APPEAR) if (!html.includes(s)) problems.push(`MISSING expected address ${s}`)
  for (const s of MUST_VANISH) if (html.includes(s)) problems.push(`STALE address still present ${s}`)
  for (const s of MUST_PERSIST) if (!html.includes(s)) problems.push(`CLOBBERED address ${s} (should not have changed)`)
  return { ok: problems.length === 0, problems, modified: page.modified }
}

const args = new Set(process.argv.slice(2))

if (args.has('--verify')) {
  const v = await verifyLive()
  console.log(v.ok ? `✅ live /audit is correct (page modified ${v.modified})` : `❌ live /audit is wrong:\n  ${v.problems.join('\n  ')}`)
  process.exit(v.ok ? 0 : 1)
}

const client = new WPClient()
const pre = await client.preflight()

if (!pre.canWriteVia) {
  console.error('✋ Cannot write to WordPress. Preflight:\n')
  console.error(JSON.stringify(pre, null, 2))
  console.error('\nBlocked because:\n  - ' + pre.blockedBecause.join('\n  - '))
  console.error('\nDry-run of the intended change still follows, from the public (rendered) copy.\n')
}

// Dry run works unauthenticated off the rendered copy; --apply demands raw.
let source, sourceKind
if (args.has('--apply') && pre.canWriteVia) {
  const page = await client.getPage(PAGE_ID, { context: 'edit' })
  source = page.content.raw
  sourceKind = 'content.raw (authenticated)'
} else {
  source = (await fetchLiveRendered()).content.rendered
  sourceKind = 'content.rendered (public — preview only, NEVER written back)'
}

console.log(`Source: ${sourceKind}\nPage:   ${PAGE_ID} (/audit)\n`)

const { out, applied } = transform(source)
console.log('Planned edits:')
for (const a of applied) console.log('  • ' + a)
console.log('\nDiff:\n' + diffLines(source, out) + '\n')

if (!args.has('--apply')) {
  console.log('Dry run — nothing written. Re-run with --apply once preflight passes.')
  process.exit(pre.canWriteVia ? 0 : 1)
}

if (!pre.canWriteVia) process.exit(1)

const backupDir = resolve(ROOT, 'outputs/wp_backups')
mkdirSync(backupDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = resolve(backupDir, `audit_${PAGE_ID}_${stamp}.html`)
writeFileSync(backup, source, 'utf8')
console.log(`Backup written: ${backup}`)

await client.updatePageContent(PAGE_ID, out)
console.log('Wrote page. Verifying live…')

// LiteSpeed caches; give the purge a beat, then re-check.
await new Promise(r => setTimeout(r, 5000))
const v = await verifyLive()
console.log(v.ok ? `✅ verified live (modified ${v.modified})` : `❌ verify FAILED:\n  ${v.problems.join('\n  ')}`)
process.exit(v.ok ? 0 : 1)
