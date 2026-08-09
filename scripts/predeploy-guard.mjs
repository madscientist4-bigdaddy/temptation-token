#!/usr/bin/env node
/**
 * Pre-deploy guard. Makes "it built on my machine but not on Vercel" impossible.
 *
 * Two failure modes this exists to kill:
 *
 *   (a) A file the build imports exists locally but was never committed. `npm run build`
 *       passes because the file is on disk; Vercel dies with "Module not found" on a path
 *       that reproduces nowhere. Anything untracked or modified under src/ api/ lib/ is
 *       therefore a hard stop.
 *
 *   (b) The build is broken in a way `npm run build` cannot see — most often .vercelignore
 *       stripping a directory the build needs. `vercel build` honours .vercelignore and
 *       the real project settings, so it catches exactly what plain vite build misses.
 *       (A bare "lib/" pattern once stripped src/lib/ as well, because .vercelignore uses
 *       .gitignore semantics where an unanchored pattern matches at any depth.)
 *
 * Usage:  node scripts/predeploy-guard.mjs        # check only
 *         npm run deploy                          # guard, then deploy if clean
 */
import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', DIM = '\x1b[2m', OFF = '\x1b[0m'
const die = (msg) => { console.error(`\n${RED}✗ DEPLOY BLOCKED${OFF} — ${msg}\n`); process.exit(1) }
const ok = (msg) => console.log(`  ${GRN}✓${OFF} ${msg}`)

// Paths whose contents are actually shipped/imported by the build. The manifests are in
// here for the same reason as the source dirs: an uncommitted dependency in package.json,
// or a rewrite added to vercel.json, breaks the deploy in a way local `npm run build`
// never sees.
const GUARDED = ['src/', 'api/', 'lib/', 'package.json', 'package-lock.json', 'vercel.json', '.vercelignore']

console.log('\n── PRE-DEPLOY GUARD ──────────────────────────────────────────')

// ── (a) working tree clean where it matters ─────────────────────────────────
let porcelain = ''
try {
  porcelain = execSync('git status --porcelain', { encoding: 'utf8' })
} catch {
  die('could not run `git status` — refusing to deploy without knowing the tree state')
}

// Porcelain lines look like "XY path" or "XY orig -> path" (renames).
const dirty = porcelain.split('\n').filter(Boolean).map(l => {
  const status = l.slice(0, 2)
  const path = l.slice(3).split(' -> ').pop().replace(/^"|"$/g, '')
  return { status, path }
}).filter(({ path }) => GUARDED.some(d => path.startsWith(d)))

if (dirty.length) {
  console.error(`\n${RED}Uncommitted changes under ${GUARDED.join(' ')}${OFF}`)
  for (const { status, path } of dirty) {
    const what = status.includes('?') ? 'UNTRACKED' : 'MODIFIED'
    console.error(`    ${what.padEnd(10)} ${path}`)
  }
  console.error(`\n  ${DIM}An untracked file the build imports is the classic cause of a`)
  console.error(`  Vercel-only "Module not found". Commit and push these first:${OFF}`)
  console.error(`    git add ${dirty.map(d => d.path).join(' ')}`)
  console.error(`    git commit && git push`)
  die(`${dirty.length} uncommitted file(s) under guarded directories`)
}
ok(`working tree clean under ${GUARDED.join(' ')}`)

// Unpushed commits are a warning, not a failure: `vercel --prod` uploads local files, so
// the deploy will still be correct — but prod would no longer match origin/main.
try {
  const unpushed = execSync('git log --oneline @{u}..HEAD 2>/dev/null', { encoding: 'utf8' }).trim()
  if (unpushed) {
    console.log(`  ${YEL}!${OFF} ${unpushed.split('\n').length} unpushed commit(s) — prod will not match origin/main`)
  } else ok('no unpushed commits')
} catch { /* no upstream configured — not our problem */ }


// ── (c) .vercelignore must not strip anything the build needs ───────────────
//
// This check exists because (b) does NOT cover it. `vercel build` runs against the local
// filesystem — .vercelignore only controls what gets UPLOADED, so a pattern that strips a
// needed directory builds fine locally and dies only on Vercel. Verified experimentally:
// putting a bare `lib/` back in .vercelignore still gave `vercel build` exit 0, while the
// real remote build failed. So we simulate the exclusion ourselves.
//
// .vercelignore uses .gitignore semantics: a pattern with no internal slash matches at ANY
// depth, which is how a bare "lib/" also eats src/lib/.
function ignoreMatchers(patterns) {
  return patterns.map(raw => {
    const negated = raw.startsWith('!')
    const p = (negated ? raw.slice(1) : raw).replace(/\/+$/, '')
    const anchored = p.startsWith('/') || p.slice(0, -1).includes('/')
    const body = p.replace(/^\//, '')
    return { negated, body, anchored }
  })
}

function isExcluded(filePath, matchers) {
  const segs = filePath.split('/')
  // A file is excluded if the pattern matches it or any ancestor directory.
  const candidates = []
  for (let i = 1; i <= segs.length; i++) candidates.push(segs.slice(0, i).join('/'))
  let excluded = false
  for (const m of matchers) {
    const hit = m.anchored
      ? candidates.includes(m.body)
      : segs.includes(m.body) || candidates.includes(m.body)
    if (hit) excluded = !m.negated
  }
  return excluded
}

if (existsSync('.vercelignore')) {
  const raw = readFileSync('.vercelignore', 'utf8')
  const patterns = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))

  const unanchored = patterns.filter(p => !p.startsWith('/') && !p.startsWith('!'))
  if (unanchored.length) {
    console.error(`\n${RED}Unanchored .vercelignore patterns${OFF} — these match at ANY depth:`)
    for (const p of unanchored) console.error(`    ${p}`)
    console.error(`\n  ${DIM}Prefix each with "/" so it only matches at the repo root.${OFF}`)
    die('.vercelignore has unanchored patterns that could strip files under src/')
  }
  ok('.vercelignore patterns are all root-anchored')

  const matchers = ignoreMatchers(patterns)
  const tracked = execSync('git ls-files src/ api/ lib/', { encoding: 'utf8' })
    .split('\n').filter(Boolean)
    // vendored Solidity deps under lib/ are excluded on purpose
    .filter(f => !f.startsWith('lib/forge-std/') && !f.startsWith('lib/openzeppelin-contracts-upgradeable/'))

  const stripped = tracked.filter(f => isExcluded(f, matchers))
  if (stripped.length) {
    console.error(`\n${RED}.vercelignore would strip ${stripped.length} file(s) the build imports${OFF}`)
    for (const f of stripped.slice(0, 15)) console.error(`    ${f}`)
    if (stripped.length > 15) console.error(`    …and ${stripped.length - 15} more`)
    die('.vercelignore excludes required source files — Vercel would fail with "Module not found"')
  }
  ok(`.vercelignore keeps all ${tracked.length} tracked files under src/ api/ lib/`)
}

// ── (b) the build Vercel will actually run ──────────────────────────────────
// vercel build needs `uv` (it installs Python deps for the repo's requirements.txt).
const hasUv = spawnSync('sh', ['-lc', 'command -v uv'], { encoding: 'utf8' }).status === 0
if (!hasUv) {
  die('`uv` is not on PATH, so `vercel build` cannot run and this guard cannot verify the real build.\n' +
      '  Install it:  brew install uv')
}
if (!existsSync('.vercel/project.json')) {
  die('.vercel/project.json missing — run `npx vercel pull --yes --environment=production` first')
}

console.log(`  ${DIM}running \`vercel build --prod\` (honours .vercelignore + project settings)…${OFF}`)
const build = spawnSync('sh', ['-lc', 'npx vercel build --prod'], { encoding: 'utf8' })
if (build.status !== 0) {
  const out = `${build.stdout || ''}${build.stderr || ''}`
  console.error(`\n${RED}vercel build FAILED${OFF} — this is exactly what would have happened on Vercel:\n`)
  console.error(out.split('\n').slice(-25).join('\n'))
  die('`vercel build` failed locally — fix it before deploying')
}
ok('`vercel build --prod` passed')

console.log(`\n${GRN}Guard passed — safe to deploy.${OFF}\n`)
